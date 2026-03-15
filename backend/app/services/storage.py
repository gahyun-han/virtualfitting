from __future__ import annotations

import abc
import mimetypes
from functools import lru_cache
from typing import Optional

from app.config import get_settings
from app.utils.errors import StorageError


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------


class StorageService(abc.ABC):
    """Common interface for all storage back-ends."""

    @abc.abstractmethod
    async def upload(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload *data* to *bucket/path* and return the public URL."""

    @abc.abstractmethod
    async def get_signed_url(
        self,
        bucket: str,
        path: str,
        expires: int = 3600,
    ) -> str:
        """Return a time-limited signed URL for *bucket/path*."""

    @abc.abstractmethod
    async def delete(self, bucket: str, path: str) -> None:
        """Delete the object at *bucket/path*."""

    @abc.abstractmethod
    async def get_public_url(self, bucket: str, path: str) -> str:
        """Return the permanent public URL for *bucket/path*."""


# ---------------------------------------------------------------------------
# Supabase implementation
# ---------------------------------------------------------------------------


class SupabaseStorageService(StorageService):
    def __init__(self) -> None:
        from supabase import create_client

        settings = get_settings()
        self._client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        self._storage = self._client.storage

    async def upload(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        try:
            self._storage.from_(bucket).upload(
                path=path,
                file=data,
                file_options={"content-type": content_type, "upsert": "true"},
            )
            return await self.get_public_url(bucket, path)
        except Exception as exc:
            raise StorageError(f"Supabase upload failed: {exc}") from exc

    async def get_signed_url(
        self,
        bucket: str,
        path: str,
        expires: int = 3600,
    ) -> str:
        try:
            response = self._storage.from_(bucket).create_signed_url(path, expires)
            signed_url: str = response["signedURL"]
            return signed_url
        except Exception as exc:
            raise StorageError(f"Supabase signed-URL generation failed: {exc}") from exc

    async def delete(self, bucket: str, path: str) -> None:
        try:
            self._storage.from_(bucket).remove([path])
        except Exception as exc:
            raise StorageError(f"Supabase delete failed: {exc}") from exc

    async def get_public_url(self, bucket: str, path: str) -> str:
        try:
            response = self._storage.from_(bucket).get_public_url(path)
            # supabase-py returns either a string or a dict
            if isinstance(response, dict):
                return response.get("publicUrl") or response.get("publicURL", "")
            return str(response)
        except Exception as exc:
            raise StorageError(f"Supabase public-URL generation failed: {exc}") from exc


# ---------------------------------------------------------------------------
# S3 stub implementation
# ---------------------------------------------------------------------------


class S3StorageService(StorageService):
    """AWS S3 / S3-compatible storage back-end."""

    def __init__(self) -> None:
        import boto3

        settings = get_settings()
        self._bucket = settings.AWS_BUCKET_NAME or ""
        self._region = settings.AWS_REGION
        self._s3 = boto3.client(
            "s3",
            region_name=self._region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

    async def upload(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        try:
            self._s3.put_object(
                Bucket=bucket,
                Key=path,
                Body=data,
                ContentType=content_type,
            )
            return await self.get_public_url(bucket, path)
        except Exception as exc:
            raise StorageError(f"S3 upload failed: {exc}") from exc

    async def get_signed_url(
        self,
        bucket: str,
        path: str,
        expires: int = 3600,
    ) -> str:
        try:
            url: str = self._s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": path},
                ExpiresIn=expires,
            )
            return url
        except Exception as exc:
            raise StorageError(f"S3 signed-URL generation failed: {exc}") from exc

    async def delete(self, bucket: str, path: str) -> None:
        try:
            self._s3.delete_object(Bucket=bucket, Key=path)
        except Exception as exc:
            raise StorageError(f"S3 delete failed: {exc}") from exc

    async def get_public_url(self, bucket: str, path: str) -> str:
        return f"https://{bucket}.s3.{self._region}.amazonaws.com/{path}"


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_storage_service() -> StorageService:
    """Return the configured storage service (singleton)."""
    settings = get_settings()
    backend = settings.STORAGE_BACKEND.lower()

    if backend == "s3":
        return S3StorageService()
    if backend == "supabase":
        return SupabaseStorageService()

    raise ValueError(f"Unknown STORAGE_BACKEND: {backend!r}. Choose 'supabase' or 's3'.")
