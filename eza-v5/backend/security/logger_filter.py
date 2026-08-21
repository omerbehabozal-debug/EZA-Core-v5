# -*- coding: utf-8 -*-
"""
Sensitive Logger Filter
Filters sensitive data from logs (credentials, tokens, emails, content fields).
Phase 8.8 — always redacts; does not rely on ENV alone.
"""

import logging
from typing import Any

from backend.config import get_settings
from backend.observability.redaction import redact_text, redact_value


class SensitiveDataFilter(logging.Filter):
    """Logging filter that masks sensitive fields in log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, "msg") and record.msg is not None:
            record.msg = redact_text(str(record.msg))

        if hasattr(record, "args") and record.args:
            new_args: list[Any] = []
            for arg in record.args:
                if isinstance(arg, dict):
                    new_args.append(redact_value(arg))
                elif isinstance(arg, str):
                    new_args.append(redact_text(arg))
                else:
                    new_args.append(arg)
            try:
                record.args = tuple(new_args)
            except Exception:
                pass

        return True


def setup_security_logging():
    """
    Setup security logging with sensitive data filter.

    Should be called during application startup.
    """
    settings = get_settings()

    root_logger = logging.getLogger()
    sensitive_filter = SensitiveDataFilter()

    for handler in root_logger.handlers:
        handler.addFilter(sensitive_filter)

    # Also attach to backend loggers created later via getLogger
    logging.getLogger("backend").addFilter(sensitive_filter)
    logging.getLogger("backend.ops").addFilter(sensitive_filter)

    if settings.ENV == "prod":
        root_logger.setLevel(logging.INFO)
        logging.getLogger("backend").setLevel(logging.INFO)
    elif settings.ENV == "ci":
        root_logger.setLevel(logging.WARNING)
        logging.getLogger("backend").setLevel(logging.WARNING)
    else:
        root_logger.setLevel(logging.DEBUG)

    logging.info("Security logging configured")
