# -*- coding: utf-8 -*-
"""
Streaming utilities for EZA Standalone
"""

import json
import httpx
from typing import AsyncGenerator, Optional, Dict, Any
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.safe_rewrite import safe_rewrite
from backend.core.engines.eza_score import compute_eza_score_v21
from backend.config import get_settings
from backend.core.engines.model_router import LLM_API_KEY, LLM_MODEL, OPENAI_BASE_URL


async def stream_standalone_response(
    user_input: str,
    safe_only: bool = False
) -> AsyncGenerator[str, None]:
    """
    Stream standalone response with token-by-token output
    
    Format:
    - data: {"token": "<word>"}
    - data: {"token": "<word>"}
    - ...
    - data: {"done": true, "assistant_score": 42, "user_score": 85}
    """
    settings = get_settings()
    
    try:
        # Step 1: Input analysis (fast, non-blocking)
        input_analysis = analyze_input(user_input)
        input_risk_score = input_analysis.get("risk_score", 0.0)
        user_score = max(0, min(100, round((1.0 - input_risk_score) * 100)))
        
        # Step 2: Stream LLM response
        if safe_only:
            # SAFE-only mode: Get full response first, then rewrite and stream
            raw_llm_output = await _get_llm_response(user_input, settings)
            safe_answer = safe_rewrite(raw_llm_output, input_analysis)
            
            # Stream safe answer word by word
            words = safe_answer.split()
            for word in words:
                yield f'data: {{"token": "{word} "}}\n\n'
            
            # Send completion with SAFE badge info
            yield f'data: {{"done": true, "mode": "safe-only"}}\n\n'
        else:
            # Score mode: Stream raw LLM tokens directly and accumulate for scoring
            accumulated_text = ""
            async for token in _stream_llm_response(user_input, settings):
                accumulated_text += token
                yield f'data: {{"token": "{token}"}}\n\n'
            
            # After streaming completes, compute scores using accumulated text
            if accumulated_text:
                output_analysis = analyze_output(accumulated_text, input_analysis)
                alignment = compute_alignment(input_analysis, output_analysis)
                eza_score_data = compute_eza_score_v21(
                    input_analysis=input_analysis,
                    output_analysis=output_analysis,
                    alignment=alignment
                )
                assistant_score = max(0, min(100, round(eza_score_data.get("eza_score", 0.0))))
            else:
                assistant_score = 0
            
            # Send completion with scores
            yield f'data: {{"done": true, "assistant_score": {assistant_score}, "user_score": {user_score}}}\n\n'
    
    except Exception as e:
        # Send error
        error_msg = str(e).replace('"', '\\"')
        yield f'data: {{"error": "{error_msg}"}}\n\n'


async def _stream_llm_response(prompt: str, settings) -> AsyncGenerator[str, None]:
    """
    Stream LLM response token by token using OpenAI streaming API
    """
    if not LLM_API_KEY:
        raise Exception("OPENAI_API_KEY not configured")
    
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": settings.STANDALONE_MAX_TOKENS if hasattr(settings, 'STANDALONE_MAX_TOKENS') else 180,
        "stream": True  # Enable streaming
    }
    
    timeout = httpx.Timeout(30.0, connect=5.0)
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream('POST', OPENAI_BASE_URL, headers=headers, json=payload) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                raise Exception(f"OpenAI API error: {response.status_code} - {error_text.decode()}")
            
            buffer = ""
            async for chunk in response.aiter_text():
                buffer += chunk
                
                # Process complete lines
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    line = line.strip()
                    
                    if not line or not line.startswith('data: '):
                        continue
                    
                    # Remove "data: " prefix
                    data_str = line[6:]
                    
                    # Skip [DONE] marker
                    if data_str == '[DONE]':
                        return
                    
                    try:
                        data = json.loads(data_str)
                        choices = data.get('choices', [])
                        if choices:
                            delta = choices[0].get('delta', {})
                            content = delta.get('content', '')
                            if content:
                                yield content
                    except json.JSONDecodeError:
                        continue


async def _get_llm_response(prompt: str, settings) -> str:
    """
    Get full LLM response (non-streaming, for SAFE-only mode or scoring)
    """
    if not LLM_API_KEY:
        raise Exception("OPENAI_API_KEY not configured")
    
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": settings.STANDALONE_MAX_TOKENS if hasattr(settings, 'STANDALONE_MAX_TOKENS') else 180,
    }
    
    timeout = httpx.Timeout(30.0, connect=5.0)
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(OPENAI_BASE_URL, headers=headers, json=payload)
        
        if response.status_code != 200:
            raise Exception(f"OpenAI API error: {response.status_code}")
        
        data = response.json()
        return data["choices"][0]["message"]["content"]

