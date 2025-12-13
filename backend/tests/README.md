# EZA Backend Tests

Test suite for EZA Backend Core Pipeline.

## Structure

```
tests/
├── __init__.py
├── conftest.py              # Global pytest fixtures
├── test_pipeline_standalone.py
├── test_pipeline_proxy.py
├── test_pipeline_proxy_lite.py
├── test_error_handling.py
├── test_response_schema.py
└── helpers/
    ├── __init__.py
    ├── fake_llm.py          # Mock LLM for testing
    ├── sample_inputs.py     # Test input samples
    └── schema_validator.py  # Response schema validator
```

## Running Tests

From the project root directory:

```bash
# Run all tests
pytest -vv

# Run specific test file
pytest -vv tests/test_pipeline_standalone.py

# Run with coverage
pytest -vv --cov=backend --cov-report=html

# Run specific test
pytest -vv tests/test_pipeline_standalone.py::test_standalone_pipeline
```

## Test Categories

### 1. Pipeline Tests
- `test_pipeline_standalone.py`: Tests for standalone mode
- `test_pipeline_proxy.py`: Tests for proxy mode
- `test_pipeline_proxy_lite.py`: Tests for proxy-lite mode

### 2. Error Handling Tests
- `test_error_handling.py`: Tests error handling and graceful failures

### 3. Schema Tests
- `test_response_schema.py`: Tests unified response schema compliance

## Test Helpers

### FakeLLM
Mock LLM implementation to avoid API costs and rate limits during testing.

```python
from backend.tests.helpers.fake_llm import FakeLLM

fake_llm = FakeLLM()
result = await run_full_pipeline(
    user_input="test",
    mode="standalone",
    llm_override=fake_llm
)
```

### BrokenLLM
LLM that always raises exceptions - for error handling tests.

```python
from backend.tests.helpers.fake_llm import BrokenLLM

broken_llm = BrokenLLM(error_message="Model failure")
```

### Schema Validator
Validates pipeline response schemas.

```python
from backend.tests.helpers.schema_validator import validate_pipeline_response

is_valid, errors = validate_pipeline_response(result)
assert is_valid, errors
```

## Fixtures

Global fixtures available in `conftest.py`:
- `fake_llm`: FakeLLM instance
- `sample_text`: Safe test input text
- `sample_risky_text`: Risky test input text

## Notes

- All tests use `@pytest.mark.asyncio` for async function support
- Tests use fake LLM to avoid API costs
- Error handling tests ensure pipeline never crashes
- Schema tests ensure API compatibility

