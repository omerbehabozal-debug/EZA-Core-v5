# -*- coding: utf-8 -*-
"""
EZA Proxy - Circuit Breaker
Open after CB_FAILURE_THRESHOLD failures
Half-open after timeout
While OPEN: skip Stage-1 and Stage-2, return Stage-0 only
"""

import logging
import time
from enum import Enum
from typing import Dict, Optional
from threading import Lock
from backend.config import get_settings

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """Circuit breaker per operation type"""
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 30
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.success_count = 0  # For half-open state
        self.lock = Lock()
        
        # Prometheus metrics
        self._open_count = 0
        self._half_open_count = 0
    
    def call(self, func, *args, **kwargs):
        """
        Execute function with circuit breaker protection
        
        Returns:
            Result of func(*args, **kwargs) if allowed
            Raises CircuitBreakerOpenError if circuit is open
        """
        if not self._allow_request():
            raise CircuitBreakerOpenError(
                f"Circuit breaker {self.name} is OPEN. "
                f"Failures: {self.failure_count}/{self.failure_threshold}"
            )
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise
    
    async def call_async(self, func, *args, **kwargs):
        """Async version of call"""
        if not self._allow_request():
            raise CircuitBreakerOpenError(
                f"Circuit breaker {self.name} is OPEN. "
                f"Failures: {self.failure_count}/{self.failure_threshold}"
            )
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise
    
    def _allow_request(self) -> bool:
        """Check if request should be allowed"""
        with self.lock:
            if self.state == CircuitState.CLOSED:
                return True
            
            if self.state == CircuitState.OPEN:
                # Check if recovery timeout has passed
                if self.last_failure_time and \
                   (time.time() - self.last_failure_time) >= self.recovery_timeout:
                    # Transition to half-open
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                    self._half_open_count += 1
                    logger.info(f"[CircuitBreaker] {self.name} transitioned to HALF_OPEN")
                    return True
                return False
            
            if self.state == CircuitState.HALF_OPEN:
                # Allow limited requests to test recovery
                return True
            
            return False
    
    def _on_success(self):
        """Handle successful request"""
        with self.lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                # If we get enough successes, close the circuit
                if self.success_count >= 2:  # Require 2 successes to close
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    self.success_count = 0
                    logger.info(f"[CircuitBreaker] {self.name} transitioned to CLOSED (recovered)")
            elif self.state == CircuitState.CLOSED:
                # Reset failure count on success
                self.failure_count = 0
    
    def _on_failure(self):
        """Handle failed request"""
        with self.lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.state == CircuitState.HALF_OPEN:
                # Failure in half-open, go back to open
                self.state = CircuitState.OPEN
                self.success_count = 0
                logger.warning(f"[CircuitBreaker] {self.name} transitioned back to OPEN (failed in half-open)")
            
            elif self.failure_count >= self.failure_threshold:
                # Open the circuit
                if self.state != CircuitState.OPEN:
                    self.state = CircuitState.OPEN
                    self._open_count += 1
                    logger.error(
                        f"[CircuitBreaker] {self.name} opened: "
                        f"{self.failure_count} failures >= {self.failure_threshold}"
                    )
    
    def get_metrics(self) -> Dict[str, any]:
        """Get circuit breaker metrics for Prometheus"""
        with self.lock:
            return {
                "state": self.state.value,
                "failure_count": self.failure_count,
                "open_count": self._open_count,
                "half_open_count": self._half_open_count
            }


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open"""
    pass


# Global circuit breakers per operation
_circuit_breakers: Dict[str, CircuitBreaker] = {}
_cb_lock = Lock()


def get_circuit_breaker(name: str) -> CircuitBreaker:
    """Get or create circuit breaker for operation"""
    settings = get_settings()
    
    with _cb_lock:
        if name not in _circuit_breakers:
            _circuit_breakers[name] = CircuitBreaker(
                name=name,
                failure_threshold=settings.CB_FAILURE_THRESHOLD,
                recovery_timeout=settings.CB_RECOVERY_TIMEOUT_SECONDS
            )
        return _circuit_breakers[name]


def get_all_circuit_breaker_metrics() -> Dict[str, Dict[str, any]]:
    """Get metrics for all circuit breakers"""
    with _cb_lock:
        return {
            name: cb.get_metrics()
            for name, cb in _circuit_breakers.items()
        }

