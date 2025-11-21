# -*- coding: utf-8 -*-
"""
Statistics Module
Tracks learning statistics and model performance
"""

from typing import Dict, Any
from backend.core.utils.dependencies import get_redis


async def track_analysis(
    pattern_type: str,
    risk_score: float,
    alignment_score: float
):
    """Track analysis statistics"""
    from backend.core.utils.dependencies import get_redis
    redis = await get_redis()
    
    # Increment counters
    await redis.incr(f"stats:analysis:count")
    await redis.incr(f"stats:pattern:{pattern_type}:count")
    
    # Update averages
    await redis.lpush(f"stats:risk_scores", risk_score)
    await redis.lpush(f"stats:alignment_scores", alignment_score)
    
    # Keep only last 1000 scores
    await redis.ltrim(f"stats:risk_scores", 0, 999)
    await redis.ltrim(f"stats:alignment_scores", 0, 999)


async def get_statistics() -> Dict[str, Any]:
    """Get aggregated statistics"""
    from backend.core.utils.dependencies import get_redis
    redis = await get_redis()
    
    total_analyses = await redis.get("stats:analysis:count") or 0
    
    # Get recent scores
    risk_scores = await redis.lrange("stats:risk_scores", 0, 999)
    alignment_scores = await redis.lrange("stats:alignment_scores", 0, 999)
    
    avg_risk = sum(float(s) for s in risk_scores) / len(risk_scores) if risk_scores else 0.0
    avg_alignment = sum(float(s) for s in alignment_scores) / len(alignment_scores) if alignment_scores else 0.0
    
    return {
        "total_analyses": int(total_analyses),
        "average_risk_score": avg_risk,
        "average_alignment_score": avg_alignment,
        "recent_samples": len(risk_scores)
    }

