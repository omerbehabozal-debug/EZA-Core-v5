# -*- coding: utf-8 -*-
"""
Multimodal Router - Video/Audio/Image analysis endpoints
"""

import os
import tempfile
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from backend.core.utils.dependencies import require_internal
from backend.api.multimodal.pipeline import (
    run_video_multimodal_pipeline,
    run_audio_multimodal_pipeline,
    run_image_multimodal_pipeline,
)

router = APIRouter(prefix="/api/multimodal", tags=["multimodal"])

# Feature flag
MULTIMODAL_ENABLED = os.getenv("EZA_MULTIMODAL_ENABLED", "true").lower() == "true"


def save_temp_file(upload_file: UploadFile) -> str:
    """
    Save uploaded file to temporary location and return path.
    """
    suffix = ""
    if upload_file.filename:
        suffix = os.path.splitext(upload_file.filename)[1]
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        shutil.copyfileobj(upload_file.file, tmp_file)
        return tmp_file.name


@router.post("/video/run")
async def analyze_video(
    file: UploadFile = File(...),
    current_user = Depends(require_internal())
):
    """
    Analyze video file using multimodal pipeline.
    Returns full MultimodalAnalysisResult.
    """
    if not MULTIMODAL_ENABLED:
        raise HTTPException(status_code=503, detail="Multimodal analysis not enabled in this environment")
    
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    try:
        temp_path = save_temp_file(file)
        result = run_video_multimodal_pipeline(temp_path, filename=file.filename)
        # Cleanup temp file
        try:
            os.unlink(temp_path)
        except:
            pass
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video analysis failed: {str(e)}")


@router.post("/audio/run")
async def analyze_audio(
    file: UploadFile = File(...),
    current_user = Depends(require_internal())
):
    """
    Analyze audio file using multimodal pipeline.
    Returns full MultimodalAnalysisResult.
    """
    if not MULTIMODAL_ENABLED:
        raise HTTPException(status_code=503, detail="Multimodal analysis not enabled in this environment")
    
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    try:
        temp_path = save_temp_file(file)
        result = run_audio_multimodal_pipeline(temp_path, filename=file.filename)
        # Cleanup temp file
        try:
            os.unlink(temp_path)
        except:
            pass
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")


@router.post("/image/run")
async def analyze_image(
    file: UploadFile = File(...),
    current_user = Depends(require_internal())
):
    """
    Analyze image file using multimodal pipeline.
    Returns full MultimodalAnalysisResult.
    """
    if not MULTIMODAL_ENABLED:
        raise HTTPException(status_code=503, detail="Multimodal analysis not enabled in this environment")
    
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        temp_path = save_temp_file(file)
        result = run_image_multimodal_pipeline(temp_path, filename=file.filename)
        # Cleanup temp file
        try:
            os.unlink(temp_path)
        except:
            pass
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")

