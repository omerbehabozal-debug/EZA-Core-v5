# -*- coding: utf-8 -*-
"""Load driver for performance tests"""
import asyncio
from typing import List, Dict, Any
from backend.api.pipeline_runner import run_full_pipeline

async def run_concurrent_requests(
    input_text: str,
    count: int,
    mode: str = "standalone"
) -> List[Dict[str, Any]]:
    """Run concurrent requests"""
    tasks = [run_full_pipeline(input_text, mode) for _ in range(count)]
    return await asyncio.gather(*tasks)

