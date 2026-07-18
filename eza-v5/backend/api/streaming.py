# -*- coding: utf-8 -*-
"""
Streaming utilities for EZA Standalone
"""

import asyncio
import json
import logging
import re
import httpx
from typing import AsyncGenerator, Optional, Dict, Any, List
from backend.api.standalone_chat_memory import (
    build_standalone_llm_messages,
    flatten_history_to_prompt,
)
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.safe_rewrite import safe_rewrite
from backend.core.engines.eza_score import compute_eza_score_v21
from backend.core.engines.redirect_engine import should_redirect
from backend.behavioral.interaction import analyze_interaction_turn
from backend.config import get_settings
from backend.core.engines.model_router import LLM_API_KEY, LLM_MODEL, OPENAI_BASE_URL
from backend.core.openai.diagnostic import parse_openai_http_error
from backend.core.utils.model_router import ModelRouter

logger = logging.getLogger(__name__)

OPENAI_CHAT_MAX_ATTEMPTS = 4
OPENAI_CHAT_MAX_RETRY_DELAY_S = 12.0


class OpenAIHTTPError(Exception):
    """OpenAI HTTP failure with parsed diagnostic for retry/user messaging."""

    def __init__(self, diagnostic: Dict[str, Any], *, raw_body: str = "") -> None:
        self.diagnostic = diagnostic
        self.raw_body = raw_body
        status = diagnostic.get("httpStatus")
        code = diagnostic.get("errorCode") or "unknown"
        message = diagnostic.get("errorMessage") or raw_body or "OpenAI request failed"
        super().__init__(f"OpenAI API error: {status} code={code} - {message}")


def _openai_http_error(status_code: int, body: str, headers: Any) -> OpenAIHTTPError:
    header_map = {str(k).lower(): str(v) for k, v in dict(headers or {}).items()}
    diagnostic = parse_openai_http_error(status_code, body or "", header_map)
    return OpenAIHTTPError(diagnostic, raw_body=body or "")


def _is_retryable_openai_error(error: OpenAIHTTPError) -> bool:
    diagnostic = error.diagnostic or {}
    code = diagnostic.get("errorCode")
    status = diagnostic.get("httpStatus")
    if code == "insufficient_quota":
        return False
    if status in (401, 403):
        return False
    if code == "rate_limit_exceeded" or status == 429:
        return True
    if isinstance(status, int) and status >= 500:
        return True
    return False


def _retry_delay_seconds(headers: Any, attempt: int) -> float:
    header_map = {str(k).lower(): str(v) for k, v in dict(headers or {}).items()}
    retry_after = header_map.get("retry-after")
    if retry_after:
        try:
            return min(float(retry_after), OPENAI_CHAT_MAX_RETRY_DELAY_S)
        except ValueError:
            pass
    # 1s, 2s, 4s … capped
    return min(float(2 ** attempt), OPENAI_CHAT_MAX_RETRY_DELAY_S)


def _attach_stream_standalone_observation(
    completion_data: Dict[str, Any],
    *,
    query: str,
    output_text: str,
    input_analysis: Dict[str, Any],
    output_analysis: Optional[Dict[str, Any]],
    alignment: Optional[Dict[str, Any]],
    redirect: Optional[Dict[str, Any]],
) -> None:
    try:
        from backend.core.engines.standalone_observation.service import (
            attach_standalone_observation_to_response,
        )

        attach_standalone_observation_to_response(
            completion_data,
            user_text=query or "",
            output_text=output_text or "",
            input_analysis=input_analysis,
            output_analysis=output_analysis,
            alignment=alignment,
            redirect=redirect,
        )
    except Exception:
        pass


async def stream_standalone_response(
    query: str,
    safe_only: bool = False,
    db_session: Any = None,
    analysis_model: Optional[str] = None,
    chat_history: Optional[List[Dict[str, Any]]] = None,
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
            raw_llm_output = await _get_llm_response(
                query, settings, analysis_model=analysis_model, chat_history=chat_history
            )
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
            
            # Behavioral snapshot (output = streamed safe answer)
            oa_safe = None
            al_safe = None
            redir_safe = None
            try:
                oa_safe = analyze_output(safe_answer, input_analysis)
                al_safe = compute_alignment(input_analysis, oa_safe)
                redir_safe = should_redirect(input_analysis, oa_safe, al_safe)
                eza_safe = compute_eza_score_v21(
                    input_analysis=input_analysis,
                    output_analysis=oa_safe,
                    alignment=al_safe,
                    redirect=redir_safe,
                )
                eza_final = eza_safe.get("final_score")
                eza_f = max(0.0, min(100.0, round(float(eza_final), 1))) if eza_final is not None else None
                behavioral = analyze_interaction_turn(
                    mode="standalone",
                    input_analysis=input_analysis,
                    output_analysis=oa_safe,
                    alignment=al_safe,
                    eza_score=eza_f,
                    redirect=redir_safe,
                    policy_violation_count=0,
                )
            except Exception:
                behavioral = None

            # Send completion with SAFE badge info, safety level, and user score
            completion_data = {
                "done": True,
                "mode": "safe-only",
                "safety": safety,
                "user_score": user_score  # Include user score even in safe-only mode
            }
            if behavioral:
                completion_data["behavioral"] = behavioral
            _attach_stream_standalone_observation(
                completion_data,
                query=query,
                output_text=safe_answer or "",
                input_analysis=input_analysis,
                output_analysis=oa_safe,
                alignment=al_safe,
                redirect=redir_safe,
            )
            if db_session is not None:
                try:
                    from backend.core.events.event_pipeline_hook import (
                        maybe_log_standalone_stream_event,
                        build_governance_meta,
                    )

                    completion_data["governance"] = await maybe_log_standalone_stream_event(
                        db_session,
                        completion_data=completion_data,
                        input_analysis=input_analysis,
                        safe_only=True,
                    )
                except Exception:
                    from backend.core.events.event_pipeline_hook import build_governance_meta

                    completion_data["governance"] = build_governance_meta(None)
            yield f'data: {json.dumps(completion_data)}\n\n'
        else:
            # Score mode: Stream raw LLM tokens directly and accumulate for scoring
            accumulated_text = ""
            async for token in _stream_llm_response(
                query, settings, analysis_model=analysis_model, chat_history=chat_history
            ):
                accumulated_text += token
                # Use json.dumps to properly escape JSON (prevents token debug garbage)
                token_data = {"token": token}
                yield f'data: {json.dumps(token_data)}\n\n'
            
            # After streaming completes, compute scores using accumulated text
            assistant_score = None
            output_analysis = None
            alignment = None
            redirect = None
            clean_text = ""
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
                        redirect = should_redirect(input_analysis, output_analysis, alignment)
                        eza_score_data = compute_eza_score_v21(
                            input_analysis=input_analysis,
                            output_analysis=output_analysis,
                            alignment=alignment,
                            redirect=redirect,
                        )
                        final_score = eza_score_data.get("final_score")
                        if final_score is not None:
                            # Round to 1 decimal place instead of integer to preserve precision
                            assistant_score = max(0.0, min(100.0, round(final_score, 1)))
                    except Exception:
                        assistant_score = None
            
            # Build completion data - always include scores
            completion_data = {"done": True}
            # Always include user_score (it's always calculated)
            completion_data["user_score"] = user_score
            # Include assistant_score if calculated
            if assistant_score is not None:
                completion_data["assistant_score"] = assistant_score

            # Behavioral snapshot (align with pipeline behavioral layer)
            if clean_text and output_analysis is not None and alignment is not None:
                try:
                    if redirect is None:
                        redirect = should_redirect(input_analysis, output_analysis, alignment)
                    completion_data["behavioral"] = analyze_interaction_turn(
                        mode="standalone",
                        input_analysis=input_analysis,
                        output_analysis=output_analysis,
                        alignment=alignment,
                        eza_score=assistant_score,
                        redirect=redirect,
                        policy_violation_count=0,
                    )
                except Exception:
                    pass

            if clean_text and output_analysis is not None and alignment is not None:
                if redirect is None:
                    redirect = should_redirect(input_analysis, output_analysis, alignment)
                _attach_stream_standalone_observation(
                    completion_data,
                    query=query,
                    output_text=clean_text,
                    input_analysis=input_analysis,
                    output_analysis=output_analysis,
                    alignment=alignment,
                    redirect=redirect,
                )

            if db_session is not None:
                try:
                    from backend.core.events.event_pipeline_hook import (
                        maybe_log_standalone_stream_event,
                        build_governance_meta,
                    )

                    completion_data["governance"] = await maybe_log_standalone_stream_event(
                        db_session,
                        completion_data=completion_data,
                        input_analysis=input_analysis,
                        safe_only=False,
                    )
                except Exception:
                    from backend.core.events.event_pipeline_hook import build_governance_meta

                    completion_data["governance"] = build_governance_meta(None)

            # Send completion with scores
            yield f'data: {json.dumps(completion_data)}\n\n'
    
    except Exception as e:
        from backend.core.openai.config import sanitize_text
        from backend.core.openai.diagnostic import create_openai_diagnostic

        diagnostic = (
            e.diagnostic
            if isinstance(e, OpenAIHTTPError)
            else create_openai_diagnostic(e)
        )
        user_message = "SAINA şu an yanıt veremiyor. Lütfen biraz sonra tekrar dene."
        if diagnostic.get("errorCode") == "insufficient_quota" or "insufficient_quota" in str(e):
            user_message = (
                "OpenAI hesap kotası veya ödeme kısıtı nedeniyle yanıt verilemiyor. "
                "Billing kontrolü gerekli."
            )
        safe_error = sanitize_text(str(e))[:500]
        payload = {
            "error": user_message,
            "code": diagnostic.get("errorCode") or "stream_error",
            "diagnosticHint": diagnostic.get("diagnosticHint"),
            "debug": safe_error,
        }
        yield f"data: {json.dumps(payload)}\n\n"


def _resolve_openai_model_name(analysis_model: Optional[str]) -> str:
    if analysis_model and analysis_model.startswith("openai/"):
        router = ModelRouter()
        _, actual = router._get_provider_from_model_id(analysis_model)
        return actual
    return LLM_MODEL


async def _stream_llm_response(
    query: str,
    settings,
    analysis_model: Optional[str] = None,
    chat_history: Optional[List[Dict[str, Any]]] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream LLM response token by token (OpenAI stream) or word-chunk fallback for other providers.
    Retries transient OpenAI 429/5xx before the first token is yielded.
    """
    model_id = analysis_model or "openai/gpt-4o-mini"
    llm_messages = build_standalone_llm_messages(query, chat_history)
    if not model_id.startswith("openai/"):
        router = ModelRouter()
        prompt = flatten_history_to_prompt(query, chat_history)
        result = await router.generate(
            prompt=prompt,
            model_id=model_id,
            temperature=0.2,
            max_tokens=settings.STANDALONE_MAX_TOKENS if hasattr(settings, "STANDALONE_MAX_TOKENS") else 180,
        )
        if not result.get("ok") or not result.get("output"):
            raise Exception(result.get("error") or "Model response failed")
        for word in result["output"].split():
            yield f"{word} "
        return

    if not LLM_API_KEY:
        raise Exception("OPENAI_API_KEY not configured")

    openai_model = _resolve_openai_model_name(analysis_model)

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": openai_model,
        "messages": llm_messages,
        "temperature": 0.2,
        "max_tokens": settings.STANDALONE_MAX_TOKENS if hasattr(settings, 'STANDALONE_MAX_TOKENS') else 180,
        "stream": True  # Enable streaming
    }
    
    timeout = httpx.Timeout(60.0, connect=5.0)
    last_error: Optional[Exception] = None

    for attempt in range(OPENAI_CHAT_MAX_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", OPENAI_BASE_URL, headers=headers, json=payload
                ) as response:
                    if response.status_code != 200:
                        error_text = (await response.aread()).decode(errors="replace")
                        err = _openai_http_error(
                            response.status_code, error_text, response.headers
                        )
                        if (
                            _is_retryable_openai_error(err)
                            and attempt < OPENAI_CHAT_MAX_ATTEMPTS - 1
                        ):
                            delay = _retry_delay_seconds(response.headers, attempt)
                            logger.warning(
                                "OpenAI stream %s — retry %s/%s in %.1fs",
                                response.status_code,
                                attempt + 1,
                                OPENAI_CHAT_MAX_ATTEMPTS - 1,
                                delay,
                            )
                            last_error = err
                            await asyncio.sleep(delay)
                            continue
                        raise err

                    buffer = ""
                    async for chunk in response.aiter_text():
                        buffer += chunk

                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            line = line.strip()

                            if not line or not line.startswith("data: "):
                                continue

                            data_str = line[6:]

                            if data_str == "[DONE]":
                                return

                            try:
                                data = json.loads(data_str)
                                choices = data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
                    return
        except OpenAIHTTPError:
            raise
        except httpx.HTTPError as exc:
            last_error = exc
            if attempt < OPENAI_CHAT_MAX_ATTEMPTS - 1:
                delay = _retry_delay_seconds({}, attempt)
                logger.warning(
                    "OpenAI stream transport error — retry %s/%s in %.1fs: %s",
                    attempt + 1,
                    OPENAI_CHAT_MAX_ATTEMPTS - 1,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)
                continue
            raise

    if last_error:
        raise last_error
    raise Exception("OpenAI stream failed after retries")


async def _get_llm_response(
    query: str,
    settings,
    analysis_model: Optional[str] = None,
    chat_history: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Get full LLM response (non-streaming, for SAFE-only mode or scoring).
    Retries transient OpenAI 429/5xx with backoff.
    """
    model_id = analysis_model or "openai/gpt-4o-mini"
    llm_messages = build_standalone_llm_messages(query, chat_history)
    if not model_id.startswith("openai/"):
        router = ModelRouter()
        prompt = flatten_history_to_prompt(query, chat_history)
        result = await router.generate(
            prompt=prompt,
            model_id=model_id,
            temperature=0.2,
            max_tokens=settings.STANDALONE_MAX_TOKENS if hasattr(settings, "STANDALONE_MAX_TOKENS") else 180,
        )
        if not result.get("ok") or not result.get("output"):
            raise Exception(result.get("error") or "Model response failed")
        return result["output"]

    if not LLM_API_KEY:
        raise Exception("OPENAI_API_KEY not configured")

    openai_model = _resolve_openai_model_name(analysis_model)

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": openai_model,
        "messages": llm_messages,
        "temperature": 0.2,
        "max_tokens": settings.STANDALONE_MAX_TOKENS if hasattr(settings, 'STANDALONE_MAX_TOKENS') else 180,
    }
    
    timeout = httpx.Timeout(60.0, connect=5.0)
    last_error: Optional[Exception] = None

    for attempt in range(OPENAI_CHAT_MAX_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    OPENAI_BASE_URL, headers=headers, json=payload
                )

                if response.status_code != 200:
                    err = _openai_http_error(
                        response.status_code, response.text, response.headers
                    )
                    if (
                        _is_retryable_openai_error(err)
                        and attempt < OPENAI_CHAT_MAX_ATTEMPTS - 1
                    ):
                        delay = _retry_delay_seconds(response.headers, attempt)
                        logger.warning(
                            "OpenAI chat %s — retry %s/%s in %.1fs",
                            response.status_code,
                            attempt + 1,
                            OPENAI_CHAT_MAX_ATTEMPTS - 1,
                            delay,
                        )
                        last_error = err
                        await asyncio.sleep(delay)
                        continue
                    raise err

                data = response.json()
                return data["choices"][0]["message"]["content"]
        except OpenAIHTTPError:
            raise
        except httpx.HTTPError as exc:
            last_error = exc
            if attempt < OPENAI_CHAT_MAX_ATTEMPTS - 1:
                delay = _retry_delay_seconds({}, attempt)
                logger.warning(
                    "OpenAI chat transport error — retry %s/%s in %.1fs: %s",
                    attempt + 1,
                    OPENAI_CHAT_MAX_ATTEMPTS - 1,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)
                continue
            raise

    if last_error:
        raise last_error
    raise Exception("OpenAI chat failed after retries")

