# -*- coding: utf-8 -*-
"""
EZA Training Pipeline - Model Evaluation (KAPALI)
NOT IMPLEMENTED - Raises NotImplementedError.

🔒 ALTIN KURAL:
- ❌ Model evaluation çalıştırılmayacak
- ❌ Feature flag: LEARNING_PIPELINE_ENABLED=false (default)
"""

import logging
from typing import Dict, Any
from backend.config import get_settings

logger = logging.getLogger(__name__)


def evaluate_model(
    model_path: str,
    test_dataset_path: str
) -> Dict[str, Any]:
    """
    Evaluate trained model (KAPALI - NOT IMPLEMENTED).
    
    Args:
        model_path: Path to trained model
        test_dataset_path: Path to test dataset
    
    Returns:
        Evaluation metrics (NOT IMPLEMENTED)
    
    Raises:
        NotImplementedError: Always raises - evaluation is disabled
    """
    settings = get_settings()
    
    if not settings.LEARNING_PIPELINE_ENABLED:
        raise NotImplementedError(
            "Model evaluation is disabled. "
            "Set LEARNING_PIPELINE_ENABLED=true to enable."
        )
    
    raise NotImplementedError(
        "Model evaluation is not yet implemented. "
        "This is a placeholder for future development."
    )

