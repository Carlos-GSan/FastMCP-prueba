import hashlib
import logging
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image

from ..config import settings

logger = logging.getLogger(__name__)


class MediaService:
    """Handles image format conversion and caching for channel compatibility.

    Twilio/WhatsApp do not support WebP images. This service downloads
    images from the CDN, converts them to JPG, and caches the result
    on disk to avoid repeated conversions.
    """

    def __init__(self):
        self._cache_dir = Path(settings.MEDIA_CACHE_DIR)
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def _cache_key(self, image_path: str, fmt: str) -> str:
        """Generate a deterministic cache key from path + format."""
        raw = f"{image_path}:{fmt}"
        return hashlib.md5(raw.encode()).hexdigest()

    def _get_cached(self, cache_key: str, fmt: str) -> bytes | None:
        """Return cached bytes if they exist, else None."""
        path = self._cache_dir / f"{cache_key}.{fmt}"
        if path.exists():
            logger.debug(f"[Media] Cache hit: {cache_key}.{fmt}")
            return path.read_bytes()
        return None

    def _save_cache(self, cache_key: str, fmt: str, data: bytes) -> None:
        """Persist converted image bytes to disk cache."""
        path = self._cache_dir / f"{cache_key}.{fmt}"
        path.write_bytes(data)
        logger.debug(f"[Media] Cached: {cache_key}.{fmt} ({len(data)} bytes)")

    async def convert(self, image_path: str, target_format: str = "jpeg") -> bytes:
        """Download an image from the CDN and convert it to the target format.

        Args:
            image_path: Relative path on the CDN (e.g. "media/trips/photo.webp").
            target_format: Output format — "jpeg" or "png".

        Returns:
            The converted image bytes.

        Raises:
            httpx.HTTPStatusError: If the CDN returns a non-2xx status.
            ValueError: If the target format is not supported.
        """
        if target_format not in ("jpeg", "png"):
            raise ValueError(f"Unsupported target format: {target_format}. Use 'jpeg' or 'png'.")

        cache_key = self._cache_key(image_path, target_format)

        # 1. Check disk cache
        cached = self._get_cached(cache_key, target_format)
        if cached is not None:
            return cached

        # 2. Download from CDN
        cdn_url = f"{settings.CDN_BASE_URL}/{image_path.lstrip('/')}"
        logger.info(f"[Media] Downloading: {cdn_url}")

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(cdn_url)
            response.raise_for_status()

        # 3. Convert with Pillow
        img = Image.open(BytesIO(response.content))

        # JPG does not support transparency — flatten to RGB
        if target_format == "jpeg" and img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")

        output = BytesIO()
        save_kwargs = {"format": target_format.upper()}
        if target_format == "jpeg":
            save_kwargs["quality"] = settings.MEDIA_JPG_QUALITY
        img.save(output, **save_kwargs)
        converted_bytes = output.getvalue()

        # 4. Cache and return
        self._save_cache(cache_key, target_format, converted_bytes)
        logger.info(f"[Media] Converted {image_path} → {target_format} ({len(converted_bytes)} bytes)")

        return converted_bytes


# Singleton
media_service = MediaService()
