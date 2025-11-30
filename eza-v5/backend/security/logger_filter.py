# -*- coding: utf-8 -*-
"""
Sensitive Logger Filter
Filters sensitive data from logs (user_input, raw_output, safe_answer)
"""

import logging
import re
import json
from typing import Any

from backend.config import get_settings


class SensitiveDataFilter(logging.Filter):
    """
    Logging filter that masks sensitive fields in log messages
    """
    
    # Fields to mask
    SENSITIVE_FIELDS = [
        "user_input",
        "raw_output",
        "safe_answer",
        "password",
        "api_key",
        "token",
        "secret"
    ]
    
    # Mask replacement
    MASK = "[REDACTED]"
    
    def __init__(self):
        super().__init__()
        self.settings = get_settings()
    
    def filter(self, record: logging.LogRecord) -> bool:
        """
        Filter log record and mask sensitive data
        
        Args:
            record: Log record
        
        Returns:
            True to allow the record
        """
        # In production, mask sensitive data
        if self.settings.ENV == "prod":
            # Mask in message
            if hasattr(record, "msg") and record.msg:
                record.msg = self._mask_sensitive(str(record.msg))
            
            # Mask in args
            if hasattr(record, "args") and record.args:
                record.args = tuple(
                    self._mask_sensitive(str(arg)) if isinstance(arg, (str, dict)) else arg
                    for arg in record.args
                )
        
        return True
    
    def _mask_sensitive(self, text: str) -> str:
        """
        Mask sensitive fields in text
        
        Args:
            text: Text to mask
        
        Returns:
            Masked text
        """
        # Try to parse as JSON first
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                masked_data = self._mask_dict(data)
                return json.dumps(masked_data, ensure_ascii=False)
        except (json.JSONDecodeError, TypeError):
            pass
        
        # Mask in string format
        for field in self.SENSITIVE_FIELDS:
            # Pattern: "field": "value" or field: value
            patterns = [
                rf'"{field}"\s*:\s*"[^"]*"',  # JSON string
                rf"'{field}'\s*:\s*'[^']*'",  # Python dict string
                rf'{field}\s*=\s*"[^"]*"',    # Key=value format
                rf'{field}\s*=\s*\'[^\']*\'', # Key='value' format
            ]
            
            for pattern in patterns:
                text = re.sub(
                    pattern,
                    f'"{field}": "{self.MASK}"',
                    text,
                    flags=re.IGNORECASE
                )
        
        return text
    
    def _mask_dict(self, data: dict) -> dict:
        """
        Mask sensitive fields in dictionary
        
        Args:
            data: Dictionary to mask
        
        Returns:
            Masked dictionary
        """
        masked = {}
        for key, value in data.items():
            key_lower = key.lower()
            
            # Check if key is sensitive
            if any(field in key_lower for field in self.SENSITIVE_FIELDS):
                masked[key] = self.MASK
            elif isinstance(value, dict):
                masked[key] = self._mask_dict(value)
            elif isinstance(value, list):
                masked[key] = [
                    self._mask_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                masked[key] = value
        
        return masked


def setup_security_logging():
    """
    Setup security logging with sensitive data filter
    
    Should be called during application startup
    """
    settings = get_settings()
    
    # Get root logger
    root_logger = logging.getLogger()
    
    # Add sensitive data filter
    sensitive_filter = SensitiveDataFilter()
    
    # Apply filter to all handlers
    for handler in root_logger.handlers:
        handler.addFilter(sensitive_filter)
    
    # Set log level based on environment
    if settings.ENV == "prod":
        root_logger.setLevel(logging.INFO)
        # Disable debug logs in production
        logging.getLogger("backend").setLevel(logging.INFO)
    else:
        root_logger.setLevel(logging.DEBUG)
    
    logging.info("Security logging configured")

