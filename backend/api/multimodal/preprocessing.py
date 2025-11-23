# -*- coding: utf-8 -*-
"""
Multimodal Preprocessing - Placeholder implementations
TODO: Replace with real ML models (ffmpeg, whisper, OCR, etc.) in production
"""

from typing import List
from .base_models import VideoFrameInfo, ASRSegment, OCRSegment, AudioEmotionSegment


def extract_video_frames(file_path: str, max_frames: int = 30) -> List[VideoFrameInfo]:
    """
    Extract frames from video file.
    
    STUB: Currently returns synthetic frames.
    TODO: Replace with ffmpeg-based frame extraction + vision model analysis.
    """
    frames = []
    # Simulate 10 frames evenly distributed
    num_frames = min(max_frames, 10)
    for i in range(num_frames):
        frames.append(VideoFrameInfo(
            index=i,
            timestamp_sec=i * 2.0,  # Assume 2 sec intervals
            risk_level="low",
            labels=[],
            summary=None
        ))
    return frames


def run_asr_on_video(file_path: str) -> List[ASRSegment]:
    """
    Run Automatic Speech Recognition on video.
    
    STUB: Returns mock ASR segments.
    TODO: Replace with Whisper or similar ASR model.
    """
    return [
        ASRSegment(
            start_sec=0.0,
            end_sec=10.0,
            text="Sample transcribed speech from video.",
            risk_level="low"
        )
    ]


def run_ocr_on_video(file_path: str) -> List[OCRSegment]:
    """
    Run OCR on video frames to extract text.
    
    STUB: Returns empty list.
    TODO: Replace with Tesseract OCR or vision-language model.
    """
    return []


def analyze_audio_emotions(file_path: str) -> List[AudioEmotionSegment]:
    """
    Analyze audio emotions/sentiment.
    
    STUB: Returns mock emotion segment.
    TODO: Replace with audio emotion recognition model.
    """
    return [
        AudioEmotionSegment(
            start_sec=0.0,
            end_sec=10.0,
            emotion="neutral",
            intensity=0.5,
            risk_level="low"
        )
    ]


def preprocess_audio(file_path: str) -> List[AudioEmotionSegment]:
    """
    Preprocess audio-only file.
    
    STUB: Returns mock emotion segments.
    TODO: Replace with real audio analysis pipeline.
    """
    return [
        AudioEmotionSegment(
            start_sec=0.0,
            end_sec=30.0,
            emotion="neutral",
            intensity=0.5,
            risk_level="low"
        )
    ]


def preprocess_image(file_path: str) -> List[OCRSegment]:
    """
    Preprocess image file (OCR + basic labels).
    
    STUB: Returns mock OCR segments.
    TODO: Replace with real OCR + vision model.
    """
    return [
        OCRSegment(
            timestamp_sec=0.0,
            text="Sample text extracted from image",
            risk_level="low"
        )
    ]

