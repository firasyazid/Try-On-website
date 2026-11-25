import logging
import os
from contextlib import asynccontextmanager
from io import BytesIO
from secrets import compare_digest
from threading import Lock

from fastapi import Depends, FastAPI, Header, HTTPException, Request, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)
generation = Lock()
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 36_000_000


@asynccontextmanager
async def lifespan(app: FastAPI):
    from fashn_vton import TryOnPipeline

    app.state.token = os.environ["FASHN_INFERENCE_TOKEN"].encode()
    if not app.state.token:
        raise RuntimeError("Set FASHN_INFERENCE_TOKEN before starting the worker.")

    app.state.pipeline = TryOnPipeline(
        weights_dir=os.environ.get("FASHN_WEIGHTS_DIR", "weights"),
        device="cuda",
    )
    yield


app = FastAPI(lifespan=lifespan)


def authenticate(request: Request, authorization: str = Header(default="")):
    expected = b"Bearer " + request.app.state.token
    if not compare_digest(authorization.encode(), expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def read_image(upload: UploadFile) -> Image.Image:
    if upload.size is not None and upload.size > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large")

    try:
        with Image.open(upload.file) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"} or source.width * source.height > MAX_PIXELS:
                raise ValueError("Unsupported image")
            image = ImageOps.exif_transpose(source).convert("RGBA")
            image.thumbnail((1536, 2048), Image.Resampling.LANCZOS)
            white = Image.new("RGBA", image.size, "white")
            return Image.alpha_composite(white, image).convert("RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Upload a readable JPEG, PNG, or WebP image") from exc


@app.post("/try-on", dependencies=[Depends(authenticate)])
def try_on(request: Request, person: UploadFile, garment: UploadFile):
    if not generation.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Another try-on is in progress")

    try:
        person_image = read_image(person)
        garment_image = read_image(garment)
        try:
            output = request.app.state.pipeline(
                person_image=person_image,
                garment_image=garment_image,
                category="tops",
                garment_photo_type="flat-lay",
                num_timesteps=20,
            )
            preview = BytesIO()
            output.images[0].save(preview, format="PNG")
        except Exception as exc:
            logger.exception("FASHN inference failed")
            raise HTTPException(status_code=500, detail="Could not generate preview") from exc
    finally:
        generation.release()

    return Response(preview.getvalue(), media_type="image/png", headers={"Cache-Control": "no-store"})
