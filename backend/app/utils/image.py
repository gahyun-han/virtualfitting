from __future__ import annotations

import io
from typing import Tuple

from PIL import Image, ImageFilter

# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------


def resize_image(img: Image.Image, max_size: int = 1024) -> Image.Image:
    """Resize *img* so that neither width nor height exceeds *max_size*.

    Aspect ratio is preserved.  If the image is already within bounds it is
    returned unchanged (no copy is made).
    """
    w, h = img.size
    if w <= max_size and h <= max_size:
        return img

    ratio = min(max_size / w, max_size / h)
    new_w = max(1, int(w * ratio))
    new_h = max(1, int(h * ratio))
    return img.resize((new_w, new_h), Image.LANCZOS)


def image_to_bytes(img: Image.Image, format: str = "PNG") -> bytes:
    """Encode a PIL image to *bytes* in the requested *format*."""
    buf = io.BytesIO()
    # JPEG does not support alpha – convert to RGB first if needed
    if format.upper() in ("JPEG", "JPG") and img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGB")
    img.save(buf, format=format)
    return buf.getvalue()


def bytes_to_image(data: bytes) -> Image.Image:
    """Decode raw image *bytes* into a PIL Image."""
    return Image.open(io.BytesIO(data))


def create_thumbnail(img: Image.Image, size: int = 256) -> Image.Image:
    """Create a square *size*×*size* thumbnail on a white background.

    Transparent PNGs (RGBA / LA) are composited onto white so that thumbnails
    always look clean on any background colour.
    """
    thumb = img.copy()
    thumb.thumbnail((size, size), Image.LANCZOS)

    background = Image.new("RGBA", (size, size), (255, 255, 255, 255))

    if thumb.mode in ("RGBA", "LA"):
        # Centre the thumbnail on the white canvas
        offset_x = (size - thumb.width) // 2
        offset_y = (size - thumb.height) // 2
        background.paste(thumb, (offset_x, offset_y), thumb.convert("RGBA"))
    else:
        thumb_rgba = thumb.convert("RGBA")
        offset_x = (size - thumb.width) // 2
        offset_y = (size - thumb.height) // 2
        background.paste(thumb_rgba, (offset_x, offset_y))

    return background.convert("RGB")


def validate_image(data: bytes) -> bool:
    """Return *True* if *data* can be decoded as a valid PIL image."""
    try:
        img = bytes_to_image(data)
        img.verify()  # checks header integrity without full decode
        return True
    except Exception:
        # Second attempt – verify() consumes the stream; try a full open
        try:
            img = bytes_to_image(data)
            img.load()
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# Convenience: get image dimensions without full decode
# ---------------------------------------------------------------------------


def get_image_size(data: bytes) -> Tuple[int, int]:
    """Return *(width, height)* of the image encoded in *data*."""
    img = bytes_to_image(data)
    return img.size
