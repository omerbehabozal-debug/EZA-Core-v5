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

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.routers import (
    auth, standalone, proxy, proxy_lite, admin, media, autonomy,
    institution, gateway, regulator_router, btk_router, eu_ai_router,
    platform_router, corporate_router, internal_proxy, multimodal
)
from backend.core.utils.dependencies import init_db, init_redis, init_vector_db
from backend.learning.vector_store import VectorStore
from backend.config import get_settings
from backend.api.pipeline_runner import run_full_pipeline
from backend.core.schemas.pipeline import (
    PipelineResponse, StandaloneRequest, ProxyRequest, ProxyLiteRequest
)

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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(standalone.router, prefix="/api/standalone", tags=["Standalone"])
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

@app.post("/api/standalone", response_model=PipelineResponse, status_code=status.HTTP_200_OK)
async def standalone_endpoint(request: StandaloneRequest):
    """
    Standalone mode endpoint - Unified pipeline
    
    Returns only safe_answer in data field.
    """
    result = await run_full_pipeline(user_input=request.text, mode="standalone")
    # Always return 200, even if ok=False (for frontend convenience)
    return result


@app.post("/api/proxy", response_model=PipelineResponse, status_code=status.HTTP_200_OK)
async def proxy_endpoint(request: ProxyRequest):
    """
    Proxy mode endpoint - Unified pipeline
    
    Returns raw outputs, scores, and detailed analysis report in data field.
    """
    result = await run_full_pipeline(user_input=request.message, mode="proxy")
    # Always return 200, even if ok=False (for frontend convenience)
    return result


@app.post("/api/proxy-lite", response_model=PipelineResponse, status_code=status.HTTP_200_OK)
async def proxy_lite_endpoint(request: ProxyLiteRequest):
    """
    Proxy-Lite mode endpoint - Unified pipeline
    
    Returns concise summary with risk levels and recommendations in data field.
    """
    # For proxy-lite, if output_text is provided, pass it to the pipeline
    result = await run_full_pipeline(
        user_input=request.message,
        mode="proxy-lite",
        output_text=request.output_text
    )
    # Always return 200, even if ok=False (for frontend convenience)
    return result
