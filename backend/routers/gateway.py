# -*- coding: utf-8 -*-
"""
Gateway Router - Internal API for testing gateway + policy packs
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from backend.core.utils.dependencies import require_internal
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings
from backend.regulation.policy_packs.rtuk_pack import RTUKPolicyPack
from backend.regulation.policy_packs.btk_pack import BTKPolicyPack
from backend.regulation.policy_packs.eu_ai_pack import EUAIPolicyPack
from backend.regulation.policy_packs.oecd_pack import OECDPolicyPack
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.score_engine import compute_score

router = APIRouter()


class GatewayTestRequest(BaseModel):
    prompt: str
    provider: str = "openai"
    model: Optional[str] = None
    policy_pack: str = "eu_ai"


class GatewayTestResponse(BaseModel):
    output: str
    provider: str
    policy_result: Dict[str, Any]
    analysis: Optional[Dict[str, Any]] = None


class GatewayEvaluateRequest(BaseModel):
    input_text: str
    output_text: str
    policy_pack: str = "eu_ai"


class GatewayEvaluateResponse(BaseModel):
    policy_result: Dict[str, Any]
    analysis: Dict[str, Any]


@router.post("/test-call", response_model=GatewayTestResponse)
async def test_gateway_call(
    request: GatewayTestRequest,
    current_user = Depends(require_internal())
):
    """Test LLM provider call via gateway"""
    settings = get_settings()
    
    try:
        # Call LLM via gateway
        output = await call_llm_provider(
            provider_name=request.provider,
            prompt=request.prompt,
            settings=settings,
            model=request.model
        )
        
        # Run basic analysis
        input_analysis = analyze_input(request.prompt)
        output_analysis = analyze_output(output)
        alignment = compute_alignment(input_analysis, output_analysis)
        eza_score = compute_score(input_analysis, output_analysis, alignment)
        
        # Run policy pack
        policy_pack_map = {
            "rtuk": RTUKPolicyPack(),
            "btk": BTKPolicyPack(),
            "eu_ai": EUAIPolicyPack(),
            "oecd": OECDPolicyPack()
        }
        
        policy_pack = policy_pack_map.get(request.policy_pack, EUAIPolicyPack())
        meta = {
            "eza_score": eza_score,
            "input_analysis": input_analysis,
            "output_analysis": output_analysis,
            "alignment": alignment
        }
        policy_result = policy_pack.evaluate(
            input_text=request.prompt,
            output_text=output,
            meta=meta
        )
        
        return GatewayTestResponse(
            output=output,
            provider=request.provider,
            policy_result=policy_result.model_dump(),
            analysis={
                "input": input_analysis,
                "output": output_analysis,
                "alignment": alignment,
                "eza_score": eza_score
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gateway call failed: {str(e)}")


@router.post("/evaluate", response_model=GatewayEvaluateResponse)
async def evaluate_with_policy(
    request: GatewayEvaluateRequest,
    current_user = Depends(require_internal())
):
    """Evaluate input/output with policy pack"""
    # Run analysis
    input_analysis = analyze_input(request.input_text)
    output_analysis = analyze_output(request.output_text)
    alignment = compute_alignment(input_analysis, output_analysis)
    eza_score = compute_score(input_analysis, output_analysis, alignment)
    
    # Run policy pack
    policy_pack_map = {
        "rtuk": RTUKPolicyPack(),
        "btk": BTKPolicyPack(),
        "eu_ai": EUAIPolicyPack(),
        "oecd": OECDPolicyPack()
    }
    
    policy_pack = policy_pack_map.get(request.policy_pack, EUAIPolicyPack())
    meta = {
        "eza_score": eza_score,
        "input_analysis": input_analysis,
        "output_analysis": output_analysis,
        "alignment": alignment
    }
    policy_result = policy_pack.evaluate(
        input_text=request.input_text,
        output_text=request.output_text,
        meta=meta
    )
    
    return GatewayEvaluateResponse(
        policy_result=policy_result.model_dump(),
        analysis={
            "input": input_analysis,
            "output": output_analysis,
            "alignment": alignment,
            "eza_score": eza_score
        }
    )

