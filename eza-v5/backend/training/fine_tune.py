# -*- coding: utf-8 -*-
"""
EZA Training Pipeline - Fine-tuning (KAPALI)
NOT IMPLEMENTED - Raises NotImplementedError.

🔒 ALTIN KURAL:
- ❌ Fine-tuning çalıştırılmayacak
- ❌ Feature flag: LEARNING_PIPELINE_ENABLED=false (default)
"""

import logging
from typing import Dict, Any
from backend.config import get_settings

logger = logging.getLogger(__name__)


def fine_tune_model(
    base_model: str,
    training_data: Dict[str, Any],
    hyperparameters: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Fine-tune base model (KAPALI - NOT IMPLEMENTED).
    
    Args:
        base_model: Base model identifier
        training_data: Training data
        hyperparameters: Fine-tuning hyperparameters
    
    Returns:
        Fine-tuned model info (NOT IMPLEMENTED)
    
    Raises:
        NotImplementedError: Always raises - fine-tuning is disabled
    """
    settings = get_settings()
    
    if not settings.LEARNING_PIPELINE_ENABLED:
        raise NotImplementedError(
            "Fine-tuning is disabled. "
            "Set LEARNING_PIPELINE_ENABLED=true to enable."
        )
    
    raise NotImplementedError(
        "Fine-tuning is not yet implemented. "
        "This is a placeholder for future development. "
        "Fine-tuning requires explicit opt-in, human approval, and compliance review."
    )

