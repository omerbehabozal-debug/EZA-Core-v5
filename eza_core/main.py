# -*- coding: utf-8 -*-
"""
main.py – EZA-Core v10

FastAPI server for EZA Ethical AI Engine.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

from analyzers.input_analyzer import analyze_input
from analyzers.output_analyzer import analyze_output
from alignment.ethical_alignment import align_response

app = FastAPI(title="EZA-Core v10", version="10.0.0")


class EZARequest(BaseModel):
    """Request model for EZA analysis."""
    text: str
    model_output: Optional[str] = None


class EZAResponse(BaseModel):
    """Response model for EZA analysis."""
    input_analysis: dict
    output_analysis: dict
    alignment: dict


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "EZA-Core v10",
        "version": "10.0.0",
        "description": "Full Ethical AI Engine (Professional Edition)",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/eza", response_model=EZAResponse)
async def run_eza(request: EZARequest):
    """
    Main EZA analysis endpoint.
    
    Args:
        request: EZA request with text and optional model output
        
    Returns:
        Complete EZA analysis result
    """
    try:
        # Analyze input
        input_result = analyze_input(request.text)
        
        # Generate or use provided model output
        if request.model_output:
            model_output = request.model_output
        else:
            model_output = f"[chatgpt] → Simulated response for: {request.text}"
        
        # Analyze output
        output_result = analyze_output(model_output, input_analysis=input_result)
        
        # Align response
        aligned = align_response(
            request.text,
            model_output,
            input_result,
            output_result
        )
        
        return EZAResponse(
            input_analysis=input_result,
            output_analysis=output_result,
            alignment=aligned
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

