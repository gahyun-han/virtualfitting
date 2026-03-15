"""Tests for the segmentation service.

Verifies that segment_clothing() returns valid RGBA PNG bytes without
requiring a real rembg model by patching the CPU-bound inference call.
"""
from __future__ import annotations

import io
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.utils.errors import SegmentationError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_rgba_png(width: int = 64, height: int = 64) -> bytes:
    """Create a minimal in-memory RGBA PNG for use as fake rembg output."""
    img = Image.new("RGBA", (width, height), color=(255, 0, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_rgb_jpeg(width: int = 64, height: int = 64) -> bytes:
    """Create a minimal JPEG image to use as fake input."""
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSegmentClothing:
    """Tests for app.services.segmentation.segment_clothing."""

    @pytest.mark.asyncio
    async def test_returns_bytes(self) -> None:
        """segment_clothing should return bytes."""
        fake_png = _make_rgba_png()

        with patch("app.services.segmentation.get_rembg_session", return_value=MagicMock()):
            with patch("app.services.segmentation._run_segmentation", return_value=fake_png):
                from app.services.segmentation import segment_clothing

                result = await segment_clothing(_make_rgb_jpeg())

        assert isinstance(result, bytes)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_output_is_valid_png(self) -> None:
        """The returned bytes must be a valid PNG file."""
        fake_png = _make_rgba_png()

        with patch("app.services.segmentation.get_rembg_session", return_value=MagicMock()):
            with patch("app.services.segmentation._run_segmentation", return_value=fake_png):
                from app.services.segmentation import segment_clothing

                result = await segment_clothing(_make_rgb_jpeg())

        # PNG magic bytes: \x89PNG
        assert result[:4] == b"\x89PNG", "Output is not a valid PNG"

    @pytest.mark.asyncio
    async def test_output_is_rgba(self) -> None:
        """The returned PNG must have an alpha channel (RGBA mode)."""
        fake_png = _make_rgba_png()

        with patch("app.services.segmentation.get_rembg_session", return_value=MagicMock()):
            with patch("app.services.segmentation._run_segmentation", return_value=fake_png):
                from app.services.segmentation import segment_clothing

                result = await segment_clothing(_make_rgb_jpeg())

        img = Image.open(io.BytesIO(result))
        assert img.mode == "RGBA", f"Expected RGBA image, got {img.mode}"

    @pytest.mark.asyncio
    async def test_raises_segmentation_error_on_failure(self) -> None:
        """segment_clothing must wrap unexpected exceptions in SegmentationError."""
        with patch("app.services.segmentation.get_rembg_session", return_value=MagicMock()):
            with patch(
                "app.services.segmentation._run_segmentation",
                side_effect=RuntimeError("model crashed"),
            ):
                from app.services.segmentation import segment_clothing

                with pytest.raises(SegmentationError):
                    await segment_clothing(_make_rgb_jpeg())

    @pytest.mark.asyncio
    async def test_segmentation_error_propagates_unchanged(self) -> None:
        """A SegmentationError raised inside the executor must bubble up as-is."""
        with patch("app.services.segmentation.get_rembg_session", return_value=MagicMock()):
            with patch(
                "app.services.segmentation._run_segmentation",
                side_effect=SegmentationError("deliberate failure"),
            ):
                from app.services.segmentation import segment_clothing

                with pytest.raises(SegmentationError, match="deliberate failure"):
                    await segment_clothing(_make_rgb_jpeg())

    def test_get_rembg_session_raises_when_not_initialised(self) -> None:
        """get_rembg_session should raise SegmentationError if session is None."""
        import app.services.segmentation as seg_module

        original = seg_module._session
        try:
            seg_module._session = None
            with pytest.raises(SegmentationError, match="not been initialised"):
                seg_module.get_rembg_session()
        finally:
            seg_module._session = original

    def test_load_rembg_session_stores_session(self) -> None:
        """load_rembg_session should populate the module-level _session."""
        import app.services.segmentation as seg_module

        fake_session = MagicMock()
        with patch("app.services.segmentation.new_session", return_value=fake_session, create=True):
            # Patch the import inside the function
            with patch.dict(
                "sys.modules",
                {"rembg": MagicMock(new_session=lambda model: fake_session)},
            ):
                seg_module._session = None  # reset
                seg_module.load_rembg_session("u2net")

        # Session should now be set (either to fake_session or the mock return value)
        assert seg_module._session is not None

    @pytest.mark.asyncio
    async def test_output_dimensions_match_input(self) -> None:
        """Output image dimensions should match the input image."""
        width, height = 128, 96
        fake_png = _make_rgba_png(width=width, height=height)

        with patch("app.services.segmentation.get_rembg_session", return_value=MagicMock()):
            with patch("app.services.segmentation._run_segmentation", return_value=fake_png):
                from app.services.segmentation import segment_clothing

                result = await segment_clothing(_make_rgb_jpeg(width=width, height=height))

        img = Image.open(io.BytesIO(result))
        assert img.size == (width, height)
