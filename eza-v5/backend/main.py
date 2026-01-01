# -*- coding: utf-8 -*-
"""
EZA-Core V6 - Ethical Zekâ Altyapısı
Main FastAPI Application
"""

import logging
import sys
from pathlib import Path

# Add parent directory to Python path for imports
backend_dir = Path(__file__).parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

from fastapi import FastAPI, HTTPException, status, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
import json
import asyncio
import traceback

from backend.routers import (
    standalone, proxy, proxy_lite, admin, media, autonomy,
    institution, gateway, regulator_router, btk_router, eu_ai_router,
    platform_router, corporate_router, internal_proxy, multimodal,
    test_results, monitor, monitor_ws
)
from backend.routers import proxy_lite_media
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

# Suppress SQLAlchemy engine logging to prevent rate limit issues on Railway
# Set to WARNING to only show warnings and errors, not INFO-level query logs
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.dialects").setLevel(logging.WARNING)


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
    
    # Demo organization seeding removed - production mode
    # Organizations must be created through API
    
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

# Add API key documentation to OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    from fastapi.openapi.utils import get_openapi
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # Add API key security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-Api-Key",
            "description": "API Key for authentication. Use either:\n"
                          "- Admin API Key: Set via EZA_ADMIN_API_KEY environment variable\n"
                          "- Organization API Key: Format 'ezak_<random>' (created via /api/org/{org_id}/api-key/create)\n"
                          "- Development: Optional in dev mode (ENV=dev)"
        },
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token for user authentication"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# CORS middleware with domain whitelist
allowed_origins = [
    "https://standalone.ezacore.ai",
    "https://proxy.ezacore.ai",
    "https://proxy-lite.ezacore.ai",  # Proxy-Lite domain
    "https://corporate.ezacore.ai",
    "https://regulator.ezacore.ai",
    "https://platform.ezacore.ai",
    "https://admin.ezacore.ai",
    "https://rtuk.ezacore.ai",
    "https://sanayi.ezacore.ai",
    "https://tech.ezacore.ai",  # Sanayi panel alternative domain
    "https://finance.ezacore.ai",
    "https://health.ezacore.ai",
    "https://eza.global",  # Documentation site
    "https://www.eza.global",  # Documentation site (www)
    # Vercel domains - will be checked dynamically
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",  # RTÜK dev port
    "http://localhost:3003",  # Sanayi dev port
    "http://localhost:3004",  # Finance dev port
    "http://localhost:3005",  # Health dev port
    "http://localhost:3006",  # eza.global dev port
    "http://localhost:3007",  # eza.global dev port (alternative)
    "http://localhost:3008",  # Additional dev port
    "http://localhost:3009",  # Additional dev port
    "http://localhost:3010",  # Additional dev port
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",  # RTÜK dev port
    "http://127.0.0.1:3003",  # Sanayi dev port
    "http://127.0.0.1:3004",  # Finance dev port
    "http://127.0.0.1:3005",  # Health dev port
    "http://127.0.0.1:3006",  # eza.global dev port
    "http://127.0.0.1:3007",  # eza.global dev port (alternative)
    "http://127.0.0.1:3008",
    "http://127.0.0.1:3009",  # Additional dev port
    "http://127.0.0.1:3010",  # Additional dev port
    # Note: FastAPI CORSMiddleware doesn't support wildcards
    # All subdomains must be explicitly listed
]

# Setup security logging
setup_security_logging()

# CRITICAL: CORS middleware must be added AFTER other middleware
# Middleware executes in REVERSE order (last added = first executed)
# We want CORS to execute FIRST to handle preflight requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Organization Guard Middleware (Enterprise Lock)
# This must be added BEFORE CORS middleware so it executes AFTER CORS
# This ensures OPTIONS requests pass through CORS first
from backend.middleware.organization_guard import OrganizationGuardMiddleware
app.add_middleware(OrganizationGuardMiddleware)

# Exception handlers to ensure CORS headers are always sent
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with CORS headers"""
    origin = request.headers.get("origin")
    # Check if origin is in allowed list
    if origin in allowed_origins:
        cors_origin = origin
    else:
        cors_origin = allowed_origins[0] if allowed_origins else "*"
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all exceptions with CORS headers"""
    logging.exception(f"Unhandled exception: {exc}")
    origin = request.headers.get("origin")
    # Check if origin is in allowed list
    if origin in allowed_origins:
        cors_origin = origin
    else:
        cors_origin = allowed_origins[0] if allowed_origins else "*"
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Include routers
# OLD auth.router removed - using production_auth.router instead
from backend.routers import production_auth
app.include_router(production_auth.router, prefix="/api/auth", tags=["Production Auth"])
# standalone.router removed - using direct endpoint in main.py instead
# app.include_router(standalone.router, prefix="/api/standalone", tags=["Standalone"])
app.include_router(proxy.router, prefix="/api/proxy", tags=["Proxy"])
from backend.routers import proxy_corporate, proxy_websocket, proxy_audit, proxy_pipeline, proxy_analysis, organization, policy_management, usage_analytics, billing, sla_monitoring, telemetry_websocket, alerting
from backend.routers import rtuk_endpoints, sanayi_endpoints, finance_endpoints, health_endpoints
app.include_router(proxy_corporate.router, prefix="/api/proxy", tags=["Proxy-Corporate"])
app.include_router(proxy_analysis.router, prefix="/api/proxy/analysis", tags=["Proxy-Analysis"])
app.include_router(proxy_audit.router, prefix="/api/proxy", tags=["Proxy-Audit"])
app.include_router(rtuk_endpoints.router, prefix="/api/proxy", tags=["RTÜK"])
app.include_router(sanayi_endpoints.router, prefix="/api/proxy", tags=["Sanayi Bakanlığı"])
app.include_router(finance_endpoints.router, prefix="/api/proxy", tags=["BDDK/SPK"])
app.include_router(health_endpoints.router, prefix="/api/proxy", tags=["Sağlık Bakanlığı"])
app.include_router(proxy_pipeline.router, prefix="/api/proxy", tags=["Proxy-Pipeline"])
app.include_router(proxy_websocket.router, tags=["Proxy-WebSocket"])

# Telemetry WebSocket endpoints
from backend.routers import telemetry_websocket
app.include_router(telemetry_websocket.router, prefix="/ws", tags=["Telemetry-WebSocket"])

# Alerting endpoints
app.include_router(alerting.router, prefix="/api/org", tags=["Alerting"])
app.include_router(organization.router, prefix="/api/org", tags=["Organization"])
app.include_router(policy_management.router, prefix="/api/policy", tags=["Policy"])
app.include_router(usage_analytics.router, prefix="/api/org", tags=["Usage-Analytics"])
app.include_router(billing.router, prefix="/api/org", tags=["Billing"])
app.include_router(sla_monitoring.router, prefix="/api/org", tags=["SLA-Monitoring"])
app.include_router(proxy_lite.router, prefix="/api/proxy-lite", tags=["Proxy-Lite"])
app.include_router(proxy_lite_media.router, prefix="/api/proxy-lite", tags=["Proxy-Lite"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# Internal setup endpoints (⚠️ FOR INTERNAL USE ONLY - PROTECTED BY INTERNAL_SETUP_KEY)
from backend.routers import internal_setup
app.include_router(internal_setup.router)
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
from backend.routers import platform_organizations
app.include_router(platform_organizations.router, prefix="/api/platform", tags=["Platform-Organizations"])
app.include_router(corporate_router.router, prefix="/api/corporate", tags=["Corporate"])

# Test Results API
app.include_router(test_results.router, prefix="/api/test-results", tags=["Test Results"])

# Public Test Results API (Snapshot-based, cached, key-protected)
from backend.routers import public_test_results, publish_test_snapshot
app.include_router(public_test_results.router, prefix="/api/public", tags=["Public Benchmarks"])
app.include_router(publish_test_snapshot.router, prefix="/api/public", tags=["Public Benchmarks"])

# Monitor API (Live Telemetry - HTTP)
app.include_router(monitor.router, prefix="/api/monitor", tags=["Monitor"])

# Monitor WebSocket (Real-time Telemetry)
app.include_router(monitor_ws.router, prefix="/ws", tags=["Monitor WebSocket"])


@app.get("/metrics")
async def prometheus_metrics():
    """
    Prometheus metrics endpoint
    Exposes all EZA Proxy metrics in Prometheus format
    """
    from backend.infra.observability import get_prometheus_metrics
    metrics_text = get_prometheus_metrics()
    return Response(content=metrics_text, media_type="text/plain")


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
