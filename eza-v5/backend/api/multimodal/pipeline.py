# -*- coding: utf-8 -*-
"""
Multimodal Pipeline - Unified analysis pipeline for video/audio/image
"""

import uuid
from datetime import datetime
from typing import List
from .base_models import (
    MultimodalAnalysisResult,
    MultimodalScoreBreakdown,
    MultimodalContextNode,
    MultimodalContextEdge,
)
from .preprocessing import (
    extract_video_frames,
    run_asr_on_video,
    run_ocr_on_video,
    analyze_audio_emotions,
    preprocess_audio,
    preprocess_image,
)
from .video_engine import analyze_video_frames
from .audio_engine import analyze_audio_segments
from .image_engine import analyze_image_ocr


def build_multimodal_context_graph(
    frames: List,
    asr_segments: List,
    ocr_segments: List,
    audio_emotions: List,
) -> tuple[List[MultimodalContextNode], List[MultimodalContextEdge]]:
    """
    Build context graph from multimodal data.
    Creates nodes and edges representing relationships.
    """
    nodes = []
    edges = []
    
    # Add frame nodes
    for i, frame in enumerate(frames):
        node_id = f"frame_{i}"
        nodes.append(MultimodalContextNode(
            id=node_id,
            type="video_frame",
            label=f"Frame {i} ({frame.timestamp_sec:.1f}s)",
            risk_level=frame.risk_level
        ))
    
    # Add ASR nodes
    for i, segment in enumerate(asr_segments):
        node_id = f"asr_{i}"
        nodes.append(MultimodalContextNode(
            id=node_id,
            type="asr",
            label=f"Speech: {segment.text[:30]}...",
            risk_level=segment.risk_level
        ))
        # Link to nearest frame
        if frames:
            nearest_frame_idx = min(range(len(frames)), 
                                   key=lambda x: abs(frames[x].timestamp_sec - segment.start_sec))
            edges.append(MultimodalContextEdge(
                source=f"frame_{nearest_frame_idx}",
                target=node_id,
                relation="contains_speech"
            ))
    
    # Add OCR nodes
    for i, segment in enumerate(ocr_segments):
        node_id = f"ocr_{i}"
        nodes.append(MultimodalContextNode(
            id=node_id,
            type="ocr",
            label=f"Text: {segment.text[:30]}...",
            risk_level=segment.risk_level
        ))
    
    # Add audio emotion nodes
    for i, emotion in enumerate(audio_emotions):
        node_id = f"emotion_{i}"
        nodes.append(MultimodalContextNode(
            id=node_id,
            type="audio_emotion",
            label=f"{emotion.emotion} ({emotion.intensity:.2f})",
            risk_level=emotion.risk_level
        ))
    
    return nodes, edges


def compute_multimodal_score(
    frames: List,
    asr_segments: List,
    ocr_segments: List,
    audio_emotions: List,
) -> MultimodalScoreBreakdown:
    """
    Compute EZA multimodal score from all analysis components.
    """
    # Count risk levels
    risk_scores = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    
    for frame in frames:
        risk_scores[frame.risk_level] = risk_scores.get(frame.risk_level, 0) + 1
    
    for segment in asr_segments:
        risk_scores[segment.risk_level] = risk_scores.get(segment.risk_level, 0) + 1
    
    for segment in ocr_segments:
        risk_scores[segment.risk_level] = risk_scores.get(segment.risk_level, 0) + 1
    
    for emotion in audio_emotions:
        risk_scores[emotion.risk_level] = risk_scores.get(emotion.risk_level, 0) + 1
    
    # Calculate weighted score
    total_items = sum(risk_scores.values()) or 1
    risk_penalty = (
        risk_scores.get("critical", 0) * 0.9 +
        risk_scores.get("high", 0) * 0.6 +
        risk_scores.get("medium", 0) * 0.3
    ) / total_items
    
    overall_score = max(0, min(100, (1.0 - risk_penalty) * 100))
    
    # Individual scores (simplified)
    text_score = overall_score * 0.3 if asr_segments or ocr_segments else None
    visual_score = overall_score * 0.4 if frames else None
    audio_score = overall_score * 0.3 if audio_emotions else None
    
    return MultimodalScoreBreakdown(
        overall_score=overall_score,
        text_score=text_score,
        visual_score=visual_score,
        audio_score=audio_score,
        legal_risk_score=None  # TODO: Add legal risk analysis
    )


def determine_global_risk_level(score: float) -> str:
    """Determine global risk level from overall score."""
    if score >= 80:
        return "low"
    elif score >= 60:
        return "medium"
    elif score >= 40:
        return "high"
    else:
        return "critical"


def generate_recommended_actions(
    risk_level: str,
    frames: List,
    asr_segments: List,
    ocr_segments: List,
) -> List[str]:
    """Generate recommended actions based on analysis."""
    actions = []
    
    if risk_level == "critical":
        actions.append("Block content immediately")
        actions.append("Flag for human review")
    elif risk_level == "high":
        actions.append("Require human review before publication")
        actions.append("Add content warning")
    elif risk_level == "medium":
        actions.append("Monitor content closely")
        actions.append("Consider additional moderation")
    else:
        actions.append("Standard monitoring")
    
    # Add specific actions based on detected issues
    high_risk_frames = [f for f in frames if f.risk_level in ["high", "critical"]]
    if high_risk_frames:
        actions.append(f"Review {len(high_risk_frames)} high-risk frames")
    
    return actions


def run_video_multimodal_pipeline(file_path: str, filename: str | None = None) -> MultimodalAnalysisResult:
    """
    Run full multimodal analysis pipeline for video.
    """
    request_id = str(uuid.uuid4())
    
    # 1. Preprocessing
    frames = extract_video_frames(file_path, max_frames=30)
    asr_segments = run_asr_on_video(file_path)
    ocr_segments = run_ocr_on_video(file_path)
    audio_emotions = analyze_audio_emotions(file_path)
    
    # 2. Safety analysis
    frames = analyze_video_frames(frames)
    audio_emotions = analyze_audio_segments(audio_emotions)
    
    # 3. Build context graph
    context_nodes, context_edges = build_multimodal_context_graph(
        frames, asr_segments, ocr_segments, audio_emotions
    )
    
    # 4. Compute score
    score_breakdown = compute_multimodal_score(
        frames, asr_segments, ocr_segments, audio_emotions
    )
    
    # 5. Determine global risk
    global_risk = determine_global_risk_level(score_breakdown.overall_score)
    
    # 6. Generate recommendations
    recommended_actions = generate_recommended_actions(
        global_risk, frames, asr_segments, ocr_segments
    )
    
    # Estimate duration (placeholder)
    duration_sec = frames[-1].timestamp_sec if frames else None
    
    return MultimodalAnalysisResult(
        request_id=request_id,
        content_type="video",
        filename=filename,
        duration_sec=duration_sec,
        language="en",  # TODO: Detect language
        asr_segments=asr_segments,
        ocr_segments=ocr_segments,
        video_frames=frames,
        audio_emotions=audio_emotions,
        context_nodes=context_nodes,
        context_edges=context_edges,
        eza_multimodal_score=score_breakdown,
        global_risk_level=global_risk,
        recommended_actions=recommended_actions,
        meta={
            "total_frames": len(frames),
            "total_asr_segments": len(asr_segments),
            "total_ocr_segments": len(ocr_segments),
        }
    )


def run_audio_multimodal_pipeline(file_path: str, filename: str | None = None) -> MultimodalAnalysisResult:
    """
    Run full multimodal analysis pipeline for audio.
    """
    request_id = str(uuid.uuid4())
    
    # 1. Preprocessing
    audio_emotions = preprocess_audio(file_path)
    
    # 2. Safety analysis
    audio_emotions = analyze_audio_segments(audio_emotions)
    
    # 3. Build context graph (audio only)
    nodes = []
    edges = []
    for i, emotion in enumerate(audio_emotions):
        node_id = f"emotion_{i}"
        nodes.append(MultimodalContextNode(
            id=node_id,
            type="audio_emotion",
            label=f"{emotion.emotion} ({emotion.intensity:.2f})",
            risk_level=emotion.risk_level
        ))
    
    # 4. Compute score
    score_breakdown = compute_multimodal_score(
        [], [], [], audio_emotions
    )
    
    # 5. Determine global risk
    global_risk = determine_global_risk_level(score_breakdown.overall_score)
    
    # 6. Generate recommendations
    recommended_actions = generate_recommended_actions(
        global_risk, [], [], []
    )
    
    # Estimate duration
    duration_sec = audio_emotions[-1].end_sec if audio_emotions else None
    
    return MultimodalAnalysisResult(
        request_id=request_id,
        content_type="audio",
        filename=filename,
        duration_sec=duration_sec,
        language="en",
        asr_segments=[],
        ocr_segments=[],
        video_frames=[],
        audio_emotions=audio_emotions,
        context_nodes=nodes,
        context_edges=edges,
        eza_multimodal_score=score_breakdown,
        global_risk_level=global_risk,
        recommended_actions=recommended_actions,
        meta={
            "total_emotion_segments": len(audio_emotions),
        }
    )


def run_image_multimodal_pipeline(file_path: str, filename: str | None = None) -> MultimodalAnalysisResult:
    """
    Run full multimodal analysis pipeline for image.
    """
    request_id = str(uuid.uuid4())
    
    # 1. Preprocessing
    ocr_segments = preprocess_image(file_path)
    
    # 2. Safety analysis
    ocr_segments = analyze_image_ocr(ocr_segments)
    
    # 3. Build context graph (image only)
    nodes = []
    edges = []
    for i, segment in enumerate(ocr_segments):
        node_id = f"ocr_{i}"
        nodes.append(MultimodalContextNode(
            id=node_id,
            type="ocr",
            label=f"Text: {segment.text[:30]}...",
            risk_level=segment.risk_level
        ))
    
    # 4. Compute score
    score_breakdown = compute_multimodal_score(
        [], [], ocr_segments, []
    )
    
    # 5. Determine global risk
    global_risk = determine_global_risk_level(score_breakdown.overall_score)
    
    # 6. Generate recommendations
    recommended_actions = generate_recommended_actions(
        global_risk, [], [], ocr_segments
    )
    
    return MultimodalAnalysisResult(
        request_id=request_id,
        content_type="image",
        filename=filename,
        duration_sec=None,
        language="en",
        asr_segments=[],
        ocr_segments=ocr_segments,
        video_frames=[],
        audio_emotions=[],
        context_nodes=nodes,
        context_edges=edges,
        eza_multimodal_score=score_breakdown,
        global_risk_level=global_risk,
        recommended_actions=recommended_actions,
        meta={
            "total_ocr_segments": len(ocr_segments),
        }
    )

