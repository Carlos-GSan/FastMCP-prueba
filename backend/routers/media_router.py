import logging

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from ..services.media_service import media_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["Media"])

# Map short names to Pillow format + MIME type
_FORMAT_MAP = {
    "jpg": ("jpeg", "image/jpeg"),
    "jpeg": ("jpeg", "image/jpeg"),
    "png": ("png", "image/png"),
}


@router.get("/convert/{image_path:path}")
async def convert_image(
    image_path: str,
    format: str = Query("jpg", description="Target format: jpg or png"),
):
    """Convert a CDN image (typically WebP) to JPG or PNG.

    Usage examples:
        GET /media/convert/media/trips/cancun.webp          → JPG (default)
        GET /media/convert/media/trips/cancun.webp?format=png → PNG

    Twilio/WhatsApp can use this URL as `media_url` to receive
    compatible images instead of unsupported WebP.
    """
    fmt_info = _FORMAT_MAP.get(format.lower())
    if not fmt_info:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{format}'. Use 'jpg' or 'png'.",
        )

    pillow_format, mime_type = fmt_info

    try:
        image_bytes = await media_service.convert(image_path, target_format=pillow_format)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 404:
            raise HTTPException(status_code=404, detail=f"Image not found on CDN: {image_path}")
        raise HTTPException(status_code=502, detail=f"CDN returned status {status}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"[Media] Conversion failed for {image_path}")
        raise HTTPException(status_code=500, detail="Image conversion failed")

    return Response(
        content=image_bytes,
        media_type=mime_type,
        headers={
            "Cache-Control": "public, max-age=86400",  # 24h cache
            "Content-Disposition": f"inline; filename={image_path.rsplit('/', 1)[-1].rsplit('.', 1)[0]}.{format}",
        },
    )
