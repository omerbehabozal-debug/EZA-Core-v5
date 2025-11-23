# -*- coding: utf-8 -*-
"""
Structured Application Logger
"""

import logging
import sys
from typing import Optional, Dict, Any
from datetime import datetime


def setup_logger(name: str = "eza", level: int = logging.INFO) -> logging.Logger:
    """Setup structured logger"""
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)s [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger


def log_event(
    logger: logging.Logger,
    event_type: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None,
    level: int = logging.INFO
):
    """Log structured event"""
    log_data = {
        "event_type": event_type,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if metadata:
        log_data.update(metadata)
    
    logger.log(level, f"{event_type}: {message}", extra=log_data)

