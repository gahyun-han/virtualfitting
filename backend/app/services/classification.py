from __future__ import annotations

import asyncio
import io
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

from app.models.wardrobe import ClipAttributes, ClothingCategory
from app.utils.errors import ClassificationError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt taxonomy
# ---------------------------------------------------------------------------

CATEGORY_PROMPTS: Dict[ClothingCategory, List[str]] = {
    ClothingCategory.top: [
        "a shirt with collar and sleeves, no pants",
        "a t-shirt upper garment with short sleeves",
        "a blouse or sweater for the chest and shoulders only",
        "an upper body garment ending at the waist",
        "a top with sleeves and a neckline, no skirt",
    ],
    ClothingCategory.bottom: [
        "pants with two separate leg tubes and a waistband",
        "denim jeans with two leg openings and a zipper",
        "shorts with two leg holes and a waistband",
        "a skirt hanging below the waist without a top attached",
        "trousers with left leg and right leg separated by a crotch seam",
    ],
    ClothingCategory.dress: [
        "a dress with bodice on top and skirt on bottom as one piece",
        "a one-piece garment connecting the chest and the skirt together",
        "a jumpsuit with top and pants sewn together as one garment",
        "a dress that hangs from the shoulders all the way down",
        "a romper or dress where the top and bottom cannot be separated",
    ],
    ClothingCategory.shoes: [
        "a pair of sneakers or athletic shoes",
        "boots or ankle boots footwear",
        "high heels or platform shoes",
        "sandals or open toe shoes",
        "a pair of shoes for the feet",
    ],
    ClothingCategory.outerwear: [
        "a jacket or coat worn as an outer layer over other clothes",
        "a blazer or suit jacket",
        "a winter coat or trench coat",
        "a hoodie or zip-up sweatshirt",
        "outerwear like a puffer jacket or windbreaker",
    ],
    ClothingCategory.accessory: [
        "a handbag, purse, or backpack",
        "a hat, cap, or beanie",
        "a belt, scarf, or tie",
        "sunglasses or jewelry accessory",
        "a fashion accessory worn with clothing",
    ],
}

# Flat list used for scoring
_ALL_CATEGORY_PROMPTS: List[str] = [
    prompt for prompts in CATEGORY_PROMPTS.values() for prompt in prompts
]

COLOR_PROMPTS: List[str] = [
    "red", "blue", "green", "black", "white", "gray",
    "yellow", "pink", "purple", "orange", "brown", "navy",
]

STYLE_PROMPTS: List[str] = [
    "casual style",
    "formal style",
    "sporty style",
    "streetwear style",
    "vintage style",
]

PATTERN_PROMPTS: List[str] = [
    "solid color",
    "striped pattern",
    "floral pattern",
    "plaid pattern",
    "graphic print",
]

# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

_model: Optional[Any] = None   # CLIPModel
_processor: Optional[Any] = None  # CLIPProcessor
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="clip")


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------


def load_clip_model(model_name: str = "openai/clip-vit-base-patch32") -> None:
    """Load CLIP model and processor.  Call once at application startup."""
    global _model, _processor
    try:
        from transformers import CLIPModel, CLIPProcessor  # type: ignore[import]

        logger.info("Loading CLIP model %s …", model_name)
        _model = CLIPModel.from_pretrained(model_name)
        _processor = CLIPProcessor.from_pretrained(model_name)
        _model.eval()
        logger.info("CLIP model loaded successfully.")
    except Exception as exc:
        logger.error("Failed to load CLIP model: %s", exc)
        raise ClassificationError(f"CLIP model init failed: {exc}") from exc


def _get_model_and_processor() -> Tuple[Any, Any]:
    if _model is None or _processor is None:
        raise ClassificationError("CLIP model has not been initialised. Call load_clip_model() at startup.")
    return _model, _processor


# ---------------------------------------------------------------------------
# Synchronous inference helpers
# ---------------------------------------------------------------------------


def _softmax(scores: List[float]) -> List[float]:
    import math

    max_score = max(scores)
    exp_scores = [math.exp(s - max_score) for s in scores]
    total = sum(exp_scores)
    return [s / total for s in exp_scores]


def _classify_single(image: Image.Image, prompts: List[str]) -> Tuple[int, float]:
    """Return (best_index, confidence) for *prompts* applied to *image*."""
    import torch

    model, processor = _get_model_and_processor()
    inputs = processor(text=prompts, images=image, return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits_per_image[0].tolist()
    probs = _softmax(logits)
    best_idx = int(max(range(len(probs)), key=lambda i: probs[i]))
    return best_idx, probs[best_idx]


def _detect_category(image: Image.Image) -> Tuple[ClothingCategory, float]:
    """Detect category by running all prompts together in one CLIP call.

    This avoids the per-category softmax bias that inflates scores for
    categories with fewer prompts (e.g. dress has 3 vs top/bottom with 5).
    """
    # Build ordered list: [(category, prompt), ...]
    prompt_map: List[Tuple[ClothingCategory, str]] = [
        (cat, prompt)
        for cat, prompts in CATEGORY_PROMPTS.items()
        for prompt in prompts
    ]
    all_prompts = [p for _, p in prompt_map]

    best_idx, confidence = _classify_single(image, all_prompts)
    best_category = prompt_map[best_idx][0]
    return best_category, confidence


def _run_classification(image_bytes: bytes) -> ClipAttributes:
    """Full CLIP classification pipeline (CPU-bound)."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # ---- Category --------------------------------------------------------
    best_category, category_confidence = _detect_category(image)

    # ---- Color -----------------------------------------------------------
    color_idx, _ = _classify_single(image, COLOR_PROMPTS)
    detected_color = COLOR_PROMPTS[color_idx]

    # ---- Style -----------------------------------------------------------
    style_idx, _ = _classify_single(image, STYLE_PROMPTS)
    detected_style = STYLE_PROMPTS[style_idx]

    # ---- Pattern ---------------------------------------------------------
    pattern_idx, _ = _classify_single(image, PATTERN_PROMPTS)
    detected_pattern = PATTERN_PROMPTS[pattern_idx]

    return ClipAttributes(
        color=detected_color,
        style=detected_style,
        pattern=detected_pattern,
        confidence=round(category_confidence, 4),
    )


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------


async def classify_clothing(image_bytes: bytes) -> ClipAttributes:
    """Classify clothing image using CLIP zero-shot inference.

    Returns a :class:`ClipAttributes` instance.  Inference is dispatched to
    a thread-pool so the event loop is never blocked.
    """
    loop = asyncio.get_event_loop()
    try:
        result: ClipAttributes = await loop.run_in_executor(
            _executor,
            _run_classification,
            image_bytes,
        )
        return result
    except ClassificationError:
        raise
    except Exception as exc:
        logger.exception("CLIP classification failed")
        raise ClassificationError(f"Classification failed: {exc}") from exc
