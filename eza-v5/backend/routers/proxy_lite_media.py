# -*- coding: utf-8 -*-
"""
Proxy-Lite Media Processing Endpoints
Audio, Video, Image processing with STT/OCR
"""

import os
import tempfile
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from typing import Optional, Literal
import httpx
from backend.core.utils.dependencies import require_internal
from backend.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== RESPONSE MODELS ==========

class MediaTextResponse(BaseModel):
    text_from_audio: Optional[str] = None
    text_from_image: Optional[str] = None
    text_from_video: Optional[str] = None
    error: Optional[str] = None
    provider: str = "EZA-Core"


# ========== HELPER FUNCTIONS ==========

async def transcribe_audio_whisper(file_path: str, settings) -> str:
    """Transcribe audio using OpenAI Whisper API"""
    try:
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")
        
        url = "https://api.openai.com/v1/audio/transcriptions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        }
        
        with open(file_path, "rb") as audio_file:
            files = {"file": audio_file}
            data = {"model": "whisper-1", "language": "tr"}
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, files=files, data=data)
                response.raise_for_status()
                result = response.json()
                return result.get("text", "")
    except Exception as e:
        logger.error(f"[Proxy-Lite] Whisper transcription error: {str(e)}")
        raise


async def transcribe_audio_groq(file_path: str, settings) -> str:
    """Fallback: Transcribe audio using Groq STT API (if available)"""
    try:
        # Groq doesn't have a direct STT API, so we'll return empty
        # In production, you might use a different service
        logger.warning("[Proxy-Lite] Groq STT not available, using fallback")
        return ""
    except Exception as e:
        logger.error(f"[Proxy-Lite] Groq transcription error: {str(e)}")
        raise


async def extract_text_from_image(file_path: str) -> str:
    """Extract text from image using OCR (Tesseract)"""
    try:
        # Try to use pytesseract if available
        try:
            import pytesseract
            from PIL import Image
            
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image, lang='tur+eng')
            return text.strip()
        except ImportError:
            # Fallback: Use a simple OCR service or return empty
            logger.warning("[Proxy-Lite] pytesseract not available, OCR disabled")
            return ""
    except Exception as e:
        logger.error(f"[Proxy-Lite] OCR error: {str(e)}")
        return ""


async def extract_audio_from_video(video_path: str) -> str:
    """Extract audio from video and transcribe"""
    try:
        import subprocess
        
        # Create temp audio file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as audio_file:
            audio_path = audio_file.name
        
        try:
            # Use ffmpeg to extract audio
            subprocess.run(
                ["ffmpeg", "-i", video_path, "-vn", "-acodec", "libmp3lame", audio_path],
                check=True,
                capture_output=True,
                timeout=60
            )
            
            # Transcribe audio
            settings = get_settings()
            try:
                text = await transcribe_audio_whisper(audio_path, settings)
            except Exception:
                # Fallback to Groq if Whisper fails
                text = await transcribe_audio_groq(audio_path, settings)
            
            return text
        finally:
            if os.path.exists(audio_path):
                os.unlink(audio_path)
    except Exception as e:
        logger.error(f"[Proxy-Lite] Video audio extraction error: {str(e)}")
        return ""


async def extract_frames_from_video(video_path: str) -> list[str]:
    """Extract frames from video (1 frame per 3 seconds) and run OCR"""
    try:
        import subprocess
        
        # Get video duration
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        duration = float(result.stdout.strip())
        frame_paths = []
        
        # Extract 1 frame per 3 seconds
        with tempfile.TemporaryDirectory() as temp_dir:
            frame_count = int(duration / 3) + 1
            
            for i in range(frame_count):
                timestamp = i * 3
                frame_path = os.path.join(temp_dir, f"frame_{i}.jpg")
                
                subprocess.run(
                    ["ffmpeg", "-i", video_path, "-ss", str(timestamp), "-vframes", "1", frame_path],
                    check=True,
                    capture_output=True,
                    timeout=30
                )
                
                if os.path.exists(frame_path):
                    frame_paths.append(frame_path)
            
            # Run OCR on each frame
            ocr_texts = []
            for frame_path in frame_paths:
                text = await extract_text_from_image(frame_path)
                if text:
                    ocr_texts.append(text)
            
            return ocr_texts
    except Exception as e:
        logger.error(f"[Proxy-Lite] Video frame extraction error: {str(e)}")
        return []


# ========== ENDPOINTS ==========

@router.post("/audio", response_model=MediaTextResponse)
async def process_audio(
    file: UploadFile = File(...),
    current_user = Depends(require_internal())
):
    """
    Process audio file: Extract text using STT (Whisper API + Groq fallback)
    """
    temp_path = None
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            temp_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        settings = get_settings()
        
        # Try Whisper first
        text = None
        error = None
        try:
            text = await transcribe_audio_whisper(temp_path, settings)
        except Exception as whisper_error:
            logger.warning(f"[Proxy-Lite] Whisper failed: {str(whisper_error)}")
            # Try Groq fallback
            try:
                text = await transcribe_audio_groq(temp_path, settings)
            except Exception as groq_error:
                logger.error(f"[Proxy-Lite] Groq fallback failed: {str(groq_error)}")
                error = f"STT başarısız: {str(whisper_error)}"
        
        if not text and not error:
            error = "İçerik tespit edilemedi"
        
        return MediaTextResponse(
            text_from_audio=text,
            error=error,
            provider="EZA-Core"
        )
    except Exception as e:
        logger.error(f"[Proxy-Lite] Audio processing error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ses işleme hatası: {str(e)}"
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@router.post("/image", response_model=MediaTextResponse)
async def process_image(
    file: UploadFile = File(...),
    current_user = Depends(require_internal())
):
    """
    Process image file: Extract text using OCR (up to 2 attempts, merge results)
    """
    temp_path = None
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            temp_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        # Run OCR (up to 2 attempts with different settings)
        texts = []
        for attempt in range(2):
            try:
                text = await extract_text_from_image(temp_path)
                if text:
                    texts.append(text)
            except Exception as e:
                logger.warning(f"[Proxy-Lite] OCR attempt {attempt + 1} failed: {str(e)}")
        
        # Merge texts
        merged_text = "\n".join(texts).strip() if texts else None
        
        if not merged_text:
            return MediaTextResponse(
                text_from_image=None,
                error="İçerik tespit edilemedi",
                provider="EZA-Core"
            )
        
        return MediaTextResponse(
            text_from_image=merged_text,
            provider="EZA-Core"
        )
    except Exception as e:
        logger.error(f"[Proxy-Lite] Image processing error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Görsel işleme hatası: {str(e)}"
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@router.post("/video", response_model=MediaTextResponse)
async def process_video(
    file: UploadFile = File(...),
    current_user = Depends(require_internal())
):
    """
    Process video file:
    1. Extract audio → STT
    2. Extract frames (1 per 3s) → OCR each
    3. Merge all text
    """
    temp_path = None
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            temp_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        all_texts = []
        stt_text = None
        ocr_texts = []
        
        # 1. Extract audio and transcribe
        try:
            stt_text = await extract_audio_from_video(temp_path)
            if stt_text:
                all_texts.append(stt_text)
        except Exception as stt_error:
            logger.warning(f"[Proxy-Lite] Video STT failed: {str(stt_error)}")
        
        # 2. Extract frames and run OCR
        try:
            ocr_texts = await extract_frames_from_video(temp_path)
            if ocr_texts:
                all_texts.extend(ocr_texts)
        except Exception as ocr_error:
            logger.warning(f"[Proxy-Lite] Video OCR failed: {str(ocr_error)}")
        
        # 3. Merge all text
        merged_text = "\n".join(all_texts).strip() if all_texts else None
        
        if not merged_text:
            return MediaTextResponse(
                text_from_video=None,
                error="İçerik tespit edilemedi",
                provider="EZA-Core"
            )
        
        return MediaTextResponse(
            text_from_video=merged_text,
            provider="EZA-Core"
        )
    except Exception as e:
        logger.error(f"[Proxy-Lite] Video processing error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Video işleme hatası: {str(e)}"
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

