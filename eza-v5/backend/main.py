# -*- coding: utf-8 -*-
"""
EZA v5 - Ethical Zekâ Altyapısı
Main FastAPI Application
"""

import logging
import sys
from pathlib import Path

# Add parent directory to Python path for imports
backend_dir = Path(__file__).parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import json
import asyncio

from backend.routers import (
    auth, standalone, proxy, proxy_lite, admin, media, autonomy,
    institution, gateway, regulator_router, btk_router, eu_ai_router,
    platform_router, corporate_router, internal_proxy, multimodal,
    test_results, monitor, monitor_ws
)
from backend.core.utils.dependencies import init_db, init_redis, init_vector_db, get_db
from backend.security.logger_filter import setup_security_logging
from backend.learning.vector_store import VectorStore
from backend.config import get_settings
from backend.api.pipeline_runner import run_full_pipeline
from backend.api.streaming import stream_standalone_response
from backend.core.schemas.pipeline import (
    PipelineResponse, StandaloneRequest, ProxyRequest, ProxyLiteRequest
)
from backend.auth.deps import require_admin, require_corporate_or_admin, require_regulator_or_admin
from backend.security.rate_limit import (
    rate_limit_standalone,
    rate_limit_proxy,
    rate_limit_regulator_feed
)
from backend.auth.api_key import require_api_key

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup - with error handling for optional dependencies
    try:
        await init_db()
        logging.info("Database initialized")
    except Exception as e:
        logging.warning(f"Database initialization failed (optional): {e}")
    
    try:
        await init_redis()
        logging.info("Redis initialized")
    except Exception as e:
        logging.warning(f"Redis initialization failed (optional): {e}")
    
    try:
        await init_vector_db()
        logging.info("Vector DB initialized")
    except Exception as e:
        logging.warning(f"Vector DB initialization failed (optional): {e}")
    
    # Initialize vector store
    try:
        app.state.vector_store = VectorStore()
        logging.info("Vector store initialized")
    except Exception as e:
        logging.warning(f"Vector store initialization failed (optional): {e}")
        app.state.vector_store = None
    
    yield
    
    # Shutdown
    # Cleanup if needed


settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Global ethical AI decision routing infrastructure - Enterprise Edition",
    version="6.0.0",
    lifespan=lifespan
)

# CORS middleware with domain whitelist
allowed_origins = [
    "https://standalone.ezacore.ai",
    "https://proxy.ezacore.ai",
    "https://corporate.ezacore.ai",
    "https://regulator.ezacore.ai",
    "https://platform.ezacore.ai",
    "https://admin.ezacore.ai",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3008",  # Additional dev port
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3008",
    "https://*.ezacore.ai",  # Wildcard for all ezacore.ai subdomains
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup security logging
setup_security_logging()

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
# standalone.router removed - using direct endpoint in main.py instead
# app.include_router(standalone.router, prefix="/api/standalone", tags=["Standalone"])
app.include_router(proxy.router, prefix="/api/proxy", tags=["Proxy"])
app.include_router(proxy_lite.router, prefix="/api/proxy-lite", tags=["Proxy-Lite"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(media.router, prefix="/api/media", tags=["Media"])
app.include_router(autonomy.router, prefix="/api/autonomy", tags=["Autonomy"])
app.include_router(institution.router, prefix="/api/institution", tags=["Institution"])
app.include_router(gateway.router, prefix="/api/gateway", tags=["Gateway"])
app.include_router(internal_proxy.router, tags=["Proxy-Internal"])
app.include_router(multimodal.router, tags=["Multimodal"])

# EZA-Regulation-API v1.0 routers
app.include_router(regulator_router.router, prefix="/api/regulator", tags=["Regulator (RTÜK)"])
app.include_router(btk_router.router, prefix="/api/btk", tags=["BTK"])
app.include_router(eu_ai_router.router, prefix="/api/eu-ai", tags=["EU AI Act"])
app.include_router(platform_router.router, prefix="/api/platform", tags=["Platform"])
app.include_router(corporate_router.router, prefix="/api/corporate", tags=["Corporate"])

# Test Results API
app.include_router(test_results.router, prefix="/api/test-results", tags=["Test Results"])

# Monitor API (Live Telemetry - HTTP)
app.include_router(monitor.router, prefix="/api/monitor", tags=["Monitor"])

# Monitor WebSocket (Real-time Telemetry)
app.include_router(monitor_ws.router, prefix="/ws", tags=["Monitor WebSocket"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "version": "6.0.0", "env": settings.ENV}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.PROJECT_NAME,
        "description": "Ethical Zekâ Altyapısı - Enterprise Edition",
        "modes": ["standalone", "proxy", "proxy-lite"],
        "version": "6.0.0",
        "features": [
            "multi-tenant",
            "ai-gateway",
            "regulation-packs",
            "telemetry",
            "audit-logging"
        ]
    }


# ============================================================================
# Unified Pipeline Endpoints
# ============================================================================

@app.post("/api/standalone", response_model=PipelineResponse, status_code=status.HTTP_200_OK, tags=["Standalone"])
async def standalone_endpoint(
    request: StandaloneRequest,
    db=Depends(get_db),
    _: None = Depends(rate_limit_standalone)  # Rate limiting (no auth required)
):
    """
    Standalone mode endpoint - Unified pipeline
    
    Returns:
    - Score mode (safe_only=False): assistant_answer, user_score, assistant_score
    - SAFE-only mode (safe_only=True): assistant_answer, safe_answer, mode="safe-only"
    
    Note: Public endpoint, no authentication required.
    """
    result = await run_full_pipeline(
        user_input=request.query_value, 
        mode="standalone", 
        db_session=db,
        safe_only=request.safe_only or False
    )
    # Always return 200, even if ok=False (for frontend convenience)
    return result


@app.post(
    "/api/standalone/stream",
    tags=["Standalone"],
    response_class=StreamingResponse,
    include_in_schema=True  # Explicitly include in OpenAPI schema
)
async def standalone_stream_endpoint(
    request: StandaloneRequest,
    _: None = Depends(rate_limit_standalone)  # Rate limiting (no auth required)
):
    """
    Standalone mode streaming endpoint
    
    Streams response token by token:
    - data: {"token": "<word>"}
    - data: {"token": "<word>"}
    - ...
    - data: {"done": true, "assistant_score": 42, "user_score": 85}
    
    Note: Public endpoint, no authentication required.
    """
    return StreamingResponse(
        stream_standalone_response(
            query=request.query_value,
            safe_only=request.safe_only or False
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@app.post("/api/proxy", response_model=PipelineResponse, status_code=status.HTTP_200_OK)
async def proxy_endpoint(
    request: ProxyRequest,
    db=Depends(get_db),
    _: dict = Depends(require_admin()),  # Admin only
    __: None = Depends(rate_limit_proxy)  # Rate limiting
):
    """
    Proxy mode endpoint - Unified pipeline
    
    Returns raw outputs, scores, and detailed analysis report in data field.
    
    Requires: admin role
    """
    result = await run_full_pipeline(user_input=request.message, mode="proxy", db_session=db)
    # Always return 200, even if ok=False (for frontend convenience)
    return result


@app.post("/api/proxy-lite", response_model=PipelineResponse, status_code=status.HTTP_200_OK)
async def proxy_lite_endpoint(
    request: ProxyLiteRequest,
    db=Depends(get_db),
    _: dict = Depends(require_corporate_or_admin())  # Corporate or admin
):
    """
    Proxy-Lite mode endpoint - Unified pipeline
    
    Returns concise summary with risk levels and recommendations in data field.
    
    Requires: corporate or admin role
    """
    # For proxy-lite, if output_text is provided, pass it to the pipeline
    result = await run_full_pipeline(
        user_input=request.message,
        mode="proxy-lite",
        output_text=request.output_text,
        db_session=db
    )
    # Always return 200, even if ok=False (for frontend convenience)
    return result
