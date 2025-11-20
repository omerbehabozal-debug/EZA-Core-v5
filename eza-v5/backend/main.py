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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.routers import auth, standalone, proxy, proxy_lite, admin
from backend.utils.dependencies import init_db, init_redis, init_vector_db
from backend.learning.vector_store import VectorStore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    await init_db()
    await init_redis()
    await init_vector_db()
    
    # Initialize vector store
    app.state.vector_store = VectorStore()
    
    yield
    
    # Shutdown
    # Cleanup if needed


app = FastAPI(
    title="EZA v5 - Ethical Zekâ Altyapısı",
    description="Global ethical AI decision routing infrastructure",
    version="5.0.0",
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


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "version": "5.0.0"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "EZA v5",
        "description": "Ethical Zekâ Altyapısı",
        "modes": ["standalone", "proxy", "proxy-lite"],
        "version": "5.0.0"
    }
