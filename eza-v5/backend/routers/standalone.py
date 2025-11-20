# -*- coding: utf-8 -*-
"""
Standalone Mode Router
Fast Core Pipeline - Production-ready minimal response
Only returns: answer, safety, confidence
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from backend.schemas.standalone import StandaloneChatRequest, StandaloneChatResponse
from backend.utils.dependencies import get_db
from backend.engines.input_analyzer import analyze_input
from backend.engines.model_router import route_model, LLMProviderError
from backend.engines.output_analyzer import analyze_output
from backend.engines.alignment_engine import compute_alignment
from backend.engines.safe_rewrite import safe_rewrite
from backend.utils.rate_limit import check_rate_limit

router = APIRouter()


def get_optional_api_key(request: Request) -> str | None:
    """
    Extract API key from Authorization header if present.
    Returns None if not present (for regular user auth).
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # For now, treat Bearer token as potential API key
        # In production, distinguish between JWT and API key
        return auth_header.replace("Bearer ", "").strip()
    return None


@router.post("/standalone_chat", response_model=StandaloneChatResponse)
async def standalone_chat(
    payload: StandaloneChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Standalone chat endpoint - Fast Core Pipeline
    Returns minimal response: answer, safety, confidence
    
    Production-ready with:
    - Rate limiting
    - Fast input/output analysis
    - LLM integration with safe fallback
    - SafeRewrite engine
    - No deep analysis (drift, deception, psych_pressure, etc.)
    """
    # 1) Rate limit check
    api_key = get_optional_api_key(request)
    client_id = api_key or (request.client.host if request.client else "unknown")
    check_rate_limit(client_id=client_id, limit=5, window=3)
    
    # 2) Input validation
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text is required"
        )
    
    # 3) Fast input analysis
    input_analysis = analyze_input(text)
    
    # 4) LLM call (fast mode) + güvenli fallback
    try:
        raw_llm_output = await route_model(
            prompt=text,
            depth="fast",
            temperature=0.2,
            max_tokens=180,
            mode="standalone",
        )
    except LLMProviderError as e:
        # Üretimde kullanıcıya asla hata yansıtma.
        # Güvenli fallback mesajı:
        safe_fallback = (
            "Şu anda teknik bir sorun yaşıyorum, bu nedenle bu soruya doğrudan yanıt "
            "veremiyorum. Ancak güvenlik, etik ve yasal çerçeveye uygun şekilde "
            "yardımcı olmaya devam edeceğim. Biraz sonra tekrar denemek istersen sorunu "
            "yeniden sorabilirsin."
        )
        
        # Return safe fallback response
        return StandaloneChatResponse(
            answer=safe_fallback,
            safety="Warning",
            confidence=0.5,
        )
    
    # 5) Fast output analysis
    output_analysis = analyze_output(raw_llm_output, input_analysis)
    
    # 6) Fast alignment
    alignment = compute_alignment(input_analysis, output_analysis)
    label = alignment.get("label", "Safe")  # Safe | Warning | Blocked
    
    # 7) Safe rewrite
    safe_output = safe_rewrite(
        user_message=text,
        llm_output=raw_llm_output,
        input_analysis=input_analysis,
        output_analysis=output_analysis,
        alignment=alignment,
    )
    
    # 8) Determine final safety label
    # If safe_rewrite changed the output, it means risk was detected
    if safe_output != raw_llm_output:
        label = "Blocked"
        confidence = 0.95
    else:
        # Use alignment label
        confidence = min(alignment.get("alignment_score", 50) / 100.0, 0.99)
        # Ensure confidence is at least 0.95 for Safe responses
        if label == "Safe" and confidence < 0.95:
            confidence = 0.95
    
    # 9) Return minimal response
    return StandaloneChatResponse(
        answer=safe_output,
        safety=label,
        confidence=confidence,
    )
