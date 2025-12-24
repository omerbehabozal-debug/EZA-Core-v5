# -*- coding: utf-8 -*-
"""
EZA Proxy - Circuit Breaker Tests
Test open/close transitions, half-open state, failure threshold
"""

import pytest
import asyncio
from backend.infra.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CircuitState
)
from backend.config import get_settings


def test_circuit_breaker_closed_state():
    """Test circuit breaker in closed state allows requests"""
    cb = CircuitBreaker("test", failure_threshold=3, recovery_timeout=1)
    
    def success_func():
        return "success"
    
    result = cb.call(success_func)
    assert result == "success"
    assert cb.state == CircuitState.CLOSED


def test_circuit_breaker_opens_after_threshold():
    """Test circuit breaker opens after failure threshold"""
    cb = CircuitBreaker("test", failure_threshold=3, recovery_timeout=1)
    
    def fail_func():
        raise Exception("Test failure")
    
    # Trigger failures
    for i in range(3):
        try:
            cb.call(fail_func)
        except Exception:
            pass
    
    # Circuit should be open
    assert cb.state == CircuitState.OPEN
    assert cb.failure_count >= 3


def test_circuit_breaker_blocks_when_open():
    """Test circuit breaker blocks requests when open"""
    cb = CircuitBreaker("test", failure_threshold=2, recovery_timeout=1)
    
    def fail_func():
        raise Exception("Test failure")
    
    # Open the circuit
    for i in range(2):
        try:
            cb.call(fail_func)
        except Exception:
            pass
    
    # Should raise CircuitBreakerOpenError
    with pytest.raises(CircuitBreakerOpenError):
        cb.call(fail_func)


def test_circuit_breaker_half_open_after_timeout():
    """Test circuit breaker transitions to half-open after timeout"""
    import time
    
    cb = CircuitBreaker("test", failure_threshold=2, recovery_timeout=1)
    
    def fail_func():
        raise Exception("Test failure")
    
    # Open the circuit
    for i in range(2):
        try:
            cb.call(fail_func)
        except Exception:
            pass
    
    assert cb.state == CircuitState.OPEN
    
    # Wait for recovery timeout
    time.sleep(1.1)
    
    # Next call should transition to half-open
    def success_func():
        return "success"
    
    # Should allow (transitions to half-open)
    result = cb.call(success_func)
    assert result == "success"
    assert cb.state == CircuitState.HALF_OPEN or cb.state == CircuitState.CLOSED


def test_circuit_breaker_closes_after_success():
    """Test circuit breaker closes after successful requests in half-open"""
    cb = CircuitBreaker("test", failure_threshold=2, recovery_timeout=1)
    
    def fail_func():
        raise Exception("Test failure")
    
    # Open the circuit
    for i in range(2):
        try:
            cb.call(fail_func)
        except Exception:
            pass
    
    # Manually set to half-open for testing
    cb.state = CircuitState.HALF_OPEN
    cb.success_count = 0
    
    def success_func():
        return "success"
    
    # Two successes should close the circuit
    cb.call(success_func)
    cb.call(success_func)
    
    assert cb.state == CircuitState.CLOSED
    assert cb.failure_count == 0


@pytest.mark.asyncio
async def test_circuit_breaker_async():
    """Test circuit breaker with async functions"""
    cb = CircuitBreaker("test-async", failure_threshold=2, recovery_timeout=1)
    
    async def success_func():
        await asyncio.sleep(0.01)
        return "success"
    
    result = await cb.call_async(success_func)
    assert result == "success"

