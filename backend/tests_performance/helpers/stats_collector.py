# -*- coding: utf-8 -*-
"""Stats collector for performance tests"""
import time
from typing import List, Dict, Any

def collect_stats(results: List[Dict[str, Any]], start_time: float) -> Dict[str, Any]:
    """Collect performance statistics"""
    end_time = time.time()
    duration = end_time - start_time
    
    successful = sum(1 for r in results if r.get("ok"))
    failed = len(results) - successful
    
    scores = [r.get("eza_score", 0.0) for r in results if r.get("eza_score")]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    
    return {
        "total_requests": len(results),
        "successful": successful,
        "failed": failed,
        "duration_seconds": duration,
        "requests_per_second": len(results) / duration if duration > 0 else 0,
        "average_score": avg_score
    }

