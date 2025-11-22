# -*- coding: utf-8 -*-
"""
Multimodal Base Models - Pydantic schemas for video/audio/image analysis
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal


class VideoFrameInfo(BaseModel):
    index: int
    timestamp_sec: float
    risk_level: str  # low/medium/high/critical
    labels: List[str] = []
    summary: Optional[str] = None


class ASRSegment(BaseModel):
    start_sec: float
    end_sec: float
    text: str
    risk_level: str = "low"


class OCRSegment(BaseModel):
    timestamp_sec: float
    text: str
    risk_level: str = "low"


class AudioEmotionSegment(BaseModel):
    start_sec: float
    end_sec: float
    emotion: str
    intensity: float
    risk_level: str = "low"


class MultimodalContextNode(BaseModel):
    id: str
    type: str  # "video", "audio", "asr", "ocr", "risk", "person", etc.
    label: str
    risk_level: str = "low"


class MultimodalContextEdge(BaseModel):
    source: str
    target: str
    relation: str


class MultimodalScoreBreakdown(BaseModel):
    overall_score: float
    text_score: Optional[float] = None
    visual_score: Optional[float] = None
    audio_score: Optional[float] = None
    legal_risk_score: Optional[float] = None


class MultimodalAnalysisResult(BaseModel):
    request_id: str
    content_type: Literal["video", "audio", "image"]
    filename: Optional[str] = None
    duration_sec: Optional[float] = None
    language: Optional[str] = None

    asr_segments: List[ASRSegment] = []
    ocr_segments: List[OCRSegment] = []
    video_frames: List[VideoFrameInfo] = []
    audio_emotions: List[AudioEmotionSegment] = []

    context_nodes: List[MultimodalContextNode] = []
    context_edges: List[MultimodalContextEdge] = []

    eza_multimodal_score: MultimodalScoreBreakdown
    global_risk_level: str  # low/medium/high/critical
    recommended_actions: List[str] = []

    meta: Dict[str, Any] = {}

