from __future__ import annotations

from typing import Any, Optional


class AppError(Exception):
    """Base application error that maps directly to an HTTP response."""

    def __init__(
        self,
        detail: str,
        status_code: int = 500,
        extra: Optional[Any] = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code
        self.extra = extra

    def __repr__(self) -> str:  # pragma: no cover
        return f"{self.__class__.__name__}(status_code={self.status_code}, detail={self.detail!r})"


class StorageError(AppError):
    """Raised when an object-storage operation fails."""

    def __init__(self, detail: str = "Storage operation failed", **kwargs: Any) -> None:
        super().__init__(detail=detail, status_code=502, **kwargs)


class SegmentationError(AppError):
    """Raised when background removal / segmentation fails."""

    def __init__(self, detail: str = "Image segmentation failed", **kwargs: Any) -> None:
        super().__init__(detail=detail, status_code=422, **kwargs)


class ClassificationError(AppError):
    """Raised when CLIP classification fails."""

    def __init__(self, detail: str = "Image classification failed", **kwargs: Any) -> None:
        super().__init__(detail=detail, status_code=422, **kwargs)


class TryOnError(AppError):
    """Raised when the Replicate try-on pipeline fails."""

    def __init__(self, detail: str = "Try-on job failed", **kwargs: Any) -> None:
        super().__init__(detail=detail, status_code=502, **kwargs)


class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""

    def __init__(self, detail: str = "Resource not found", **kwargs: Any) -> None:
        super().__init__(detail=detail, status_code=404, **kwargs)


class AuthenticationError(AppError):
    """Raised when JWT validation fails."""

    def __init__(self, detail: str = "Could not validate credentials", **kwargs: Any) -> None:
        super().__init__(detail=detail, status_code=401, **kwargs)


class ValidationError(AppError):
    """Raised when input validation fails beyond Pydantic's scope."""

    def __init__(self, detail: str = "Validation error", **kwargs: Any) -> None:
        super().__init__(detail=detail, status_code=422, **kwargs)
