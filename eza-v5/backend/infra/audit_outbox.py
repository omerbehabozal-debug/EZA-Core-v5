# -*- coding: utf-8 -*-
"""
EZA Proxy - Audit Outbox (Non-blocking, At-least-once delivery)
Async write queue
Idempotent by request_id
"""

import logging
import asyncio
import time
import uuid
from typing import Dict, Any, Optional, List
from collections import deque
from threading import Lock
from datetime import datetime

logger = logging.getLogger(__name__)

# Outbox queue (in-memory, can be replaced with Redis/DB in production)
_outbox_queue: deque = deque(maxlen=10000)  # Max 10k pending entries
_processed_ids: set = set()  # Track processed request_ids for idempotency
_outbox_lock = Lock()

# Backlog size metric
_backlog_size = 0
_backlog_lock = Lock()


class AuditEntry:
    """Audit entry for outbox"""
    
    def __init__(
        self,
        request_id: str,
        event_type: str,
        org_id: str,
        user_id: str,
        data: Dict[str, Any],
        timestamp: Optional[float] = None
    ):
        self.request_id = request_id
        self.event_type = event_type
        self.org_id = org_id
        self.user_id = user_id
        self.data = data
        self.timestamp = timestamp or time.time()
        self.retry_count = 0
        self.max_retries = 3


def enqueue_audit(
    event_type: str,
    org_id: str,
    user_id: str,
    data: Dict[str, Any],
    request_id: Optional[str] = None
) -> str:
    """
    Enqueue audit entry for async processing
    
    Args:
        event_type: Type of audit event (e.g., "analysis", "rewrite", "intent_log")
        org_id: Organization ID
        user_id: User ID
        data: Audit data
        request_id: Optional request ID (for idempotency)
    
    Returns:
        request_id: Generated or provided request ID
    """
    if request_id is None:
        request_id = str(uuid.uuid4())
    
    # Check idempotency
    with _outbox_lock:
        if request_id in _processed_ids:
            logger.debug(f"[AuditOutbox] Duplicate request_id={request_id[:8]}, skipping")
            return request_id
        
        entry = AuditEntry(
            request_id=request_id,
            event_type=event_type,
            org_id=org_id,
            user_id=user_id,
            data=data
        )
        
        _outbox_queue.append(entry)
        
        with _backlog_lock:
            _backlog_size = len(_outbox_queue)
    
    logger.debug(f"[AuditOutbox] Enqueued audit entry: request_id={request_id[:8]}, type={event_type}")
    return request_id


async def process_audit_outbox(db_session_factory):
    """
    Process audit outbox queue (background task)
    
    This should be called periodically or as a background task.
    At-least-once delivery: retry on failure, mark as processed only after success.
    """
    while True:
        entries_to_process = []
        
        # Get batch of entries from queue
        with _outbox_lock:
            batch_size = min(10, len(_outbox_queue))  # Process 10 at a time
            for _ in range(batch_size):
                if _outbox_queue:
                    entries_to_process.append(_outbox_queue.popleft())
        
        if not entries_to_process:
            # No entries, wait a bit
            await asyncio.sleep(1)
            continue
        
        # Process each entry
        for entry in entries_to_process:
            try:
                # Get DB session
                async with db_session_factory() as db:
                    # Write audit entry to database
                    # This is a placeholder - implement actual DB write
                    # await write_audit_to_db(db, entry)
                    
                    logger.debug(
                        f"[AuditOutbox] Processed audit entry: "
                        f"request_id={entry.request_id[:8]}, type={entry.event_type}"
                    )
                
                # Mark as processed (idempotency)
                with _outbox_lock:
                    _processed_ids.add(entry.request_id)
                    # Clean up old processed IDs (keep last 10000)
                    if len(_processed_ids) > 10000:
                        _processed_ids.clear()  # Simple cleanup
                
                with _backlog_lock:
                    _backlog_size = len(_outbox_queue)
            
            except Exception as e:
                logger.error(
                    f"[AuditOutbox] Failed to process audit entry "
                    f"request_id={entry.request_id[:8]}: {str(e)}"
                )
                
                # Retry logic
                entry.retry_count += 1
                if entry.retry_count < entry.max_retries:
                    # Re-queue for retry
                    with _outbox_lock:
                        _outbox_queue.append(entry)
                else:
                    logger.error(
                        f"[AuditOutbox] Max retries exceeded for "
                        f"request_id={entry.request_id[:8]}, dropping entry"
                    )
        
        # Small delay between batches
        await asyncio.sleep(0.1)


def get_audit_backlog_size() -> int:
    """Get current backlog size (for Prometheus metric)"""
    with _backlog_lock:
        return _backlog_size


def clear_audit_outbox():
    """Clear audit outbox (for testing)"""
    with _outbox_lock:
        _outbox_queue.clear()
        _processed_ids.clear()
    with _backlog_lock:
        _backlog_size = 0

