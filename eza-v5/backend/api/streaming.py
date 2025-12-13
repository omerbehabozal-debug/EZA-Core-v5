# -*- coding: utf-8 -*-
"""
Streaming utilities for EZA Standalone
"""

import json
import re
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
    query: str,
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
        input_analysis = analyze_input(query)
        input_risk_score = input_analysis.get("risk_score", 0.0)
        # More precise user score calculation - use 1 decimal place instead of rounding to integer
        # This preserves small differences in risk scores
        user_score_raw = (1.0 - input_risk_score) * 100.0
        # Round to 1 decimal place for display, but keep precision in calculation
        user_score = max(0.0, min(100.0, round(user_score_raw, 1)))
        
        # Step 2: Stream LLM response
        if safe_only:
            # SAFE-only mode: Get full response first, then rewrite and stream
            raw_llm_output = await _get_llm_response(query, settings)
            # Ensure raw_llm_output is a clean string
            if not isinstance(raw_llm_output, str):
                raw_llm_output = str(raw_llm_output)
            # Clean any potential token debug strings
            raw_llm_output = re.sub(r'\["token"\s*:\s*"[^"]*"\]', '', raw_llm_output)
            raw_llm_output = re.sub(r'\{"token"\s*:\s*"[^"]*"\}', '', raw_llm_output)
            raw_llm_output = raw_llm_output.strip()
            
            # Analyze output and alignment for safe_rewrite
            output_analysis = analyze_output(raw_llm_output, input_analysis)
            alignment = compute_alignment(input_analysis, output_analysis)
            
            # Call safe_rewrite with all required parameters
            # safe_rewrite always returns a non-empty response
            safe_answer = safe_rewrite(
                user_message=query,
                llm_output=raw_llm_output,
                input_analysis=input_analysis,
                output_analysis=output_analysis,
                alignment=alignment
            )
            # Ensure safe_answer is a clean string (should never be empty due to safe_rewrite logic)
            if not isinstance(safe_answer, str):
                safe_answer = str(safe_answer)
            # Final safety check - should never trigger but just in case
            if not safe_answer or safe_answer.strip() == "":
                safe_answer = raw_llm_output if raw_llm_output and raw_llm_output.strip() else "Üzgünüm, şu anda yanıt veremiyorum."
            
            # Determine safety level based on input risk
            input_risk_level = input_analysis.get("risk_level", "low")
            input_risk = input_analysis.get("risk_score", 0.0)
            
            # Map risk level to safety badge
            if input_risk >= 0.7 or input_risk_level == "high" or input_risk_level == "critical":
                safety = "Blocked"
            elif input_risk >= 0.3 or input_risk_level == "medium":
                safety = "Warning"
            else:
                safety = "Safe"
            
            # Stream safe answer word by word (only if not empty)
            if safe_answer and safe_answer.strip():
                words = safe_answer.split()
                for word in words:
                    # Use json.dumps to properly escape JSON
                    token_data = {"token": f"{word} "}
                    yield f'data: {json.dumps(token_data)}\n\n'
            
            # Send completion with SAFE badge info, safety level, and user score
            completion_data = {
                "done": True,
                "mode": "safe-only",
                "safety": safety,
                "user_score": user_score  # Include user score even in safe-only mode
            }
            yield f'data: {json.dumps(completion_data)}\n\n'
        else:
            # Score mode: Stream raw LLM tokens directly and accumulate for scoring
            accumulated_text = ""
            async for token in _stream_llm_response(query, settings):
                accumulated_text += token
                # Use json.dumps to properly escape JSON (prevents token debug garbage)
                token_data = {"token": token}
                yield f'data: {json.dumps(token_data)}\n\n'
            
            # After streaming completes, compute scores using accumulated text
            assistant_score = None
            if accumulated_text:
                # Clean accumulated text (remove any potential token debug info)
                clean_text = accumulated_text.strip()
                # Remove patterns like ["token": "..."] or {"token": "..."}
                clean_text = re.sub(r'\["token"\s*:\s*"[^"]*"\]', '', clean_text)
                clean_text = re.sub(r'\{"token"\s*:\s*"[^"]*"\}', '', clean_text)
                clean_text = clean_text.strip()
                
                if clean_text:
                    try:
                        output_analysis = analyze_output(clean_text, input_analysis)
                        alignment = compute_alignment(input_analysis, output_analysis)
                        eza_score_data = compute_eza_score_v21(
                            input_analysis=input_analysis,
                            output_analysis=output_analysis,
                            alignment=alignment
                        )
                        final_score = eza_score_data.get("final_score")
                        if final_score is not None:
                            # Round to 1 decimal place instead of integer to preserve precision
                            assistant_score = max(0.0, min(100.0, round(final_score, 1)))
                    except Exception as e:
                        # If score calculation fails, don't fail the request
                        # assistant_score will remain None
                        assistant_score = None
            
            # Build completion data - always include scores
            completion_data = {"done": True}
            # Always include user_score (it's always calculated)
            completion_data["user_score"] = user_score
            # Include assistant_score if calculated
            if assistant_score is not None:
                completion_data["assistant_score"] = assistant_score
            
            # Send completion with scores
            yield f'data: {json.dumps(completion_data)}\n\n'
    
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

