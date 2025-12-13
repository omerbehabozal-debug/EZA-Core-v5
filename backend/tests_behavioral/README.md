# EZA Behavioral Test Suite

Comprehensive behavioral AI safety tests for EZA-Core using real LLM.

## Overview

This test suite validates the **real-world behavior** of EZA pipeline, not just technical correctness. It tests:

- Intent detection accuracy
- Deception pattern detection
- Psychological pressure detection
- Legal risk assessment
- Alignment and safe rewrite quality
- Output safety guarantees
- Score calculation correctness
- Full pipeline behavior in real-world scenarios

## Structure

```
tests_behavioral/
├── __init__.py
├── conftest.py                    # Pytest configuration
├── test_intent_detection.py       # Intent classification tests
├── test_deception_detection.py    # Deception pattern tests
├── test_psych_pressure.py         # Psychological pressure tests
├── test_legal_risk.py             # Legal compliance tests
├── test_alignment_quality.py      # Alignment & rewrite tests
├── test_output_safety.py          # Output safety tests
├── test_score_correctness.py       # Score calculation tests
├── test_full_pipeline_real_world.py  # Real-world scenario tests
└── helpers/
    ├── __init__.py
    ├── llm_settings.py            # LLM configuration
    ├── scenario_loader.py         # Scenario loading
    ├── expectations.py            # Expectation helpers
    └── scenarios.json             # 30+ test scenarios
```

## Running Tests

### Run All Behavioral Tests

```bash
pytest backend/tests_behavioral -vv --disable-warnings
```

### Run Specific Test Category

```bash
# Intent detection tests
pytest backend/tests_behavioral/test_intent_detection.py -vv

# Deception detection tests
pytest backend/tests_behavioral/test_deception_detection.py -vv

# Score correctness tests
pytest backend/tests_behavioral/test_score_correctness.py -vv
```

### Run with Real LLM

Tests use real LLM by default. To disable (use fake LLM):

```python
# In helpers/llm_settings.py
USE_REAL_LLM = False
```

## Test Categories

### 1. Intent Detection (`test_intent_detection.py`)
- Tests input intent classification (greeting, question, generation)
- Validates risk level detection (low, medium, high)
- Tests gray area handling

### 2. Deception Detection (`test_deception_detection.py`)
- Reverse questioning patterns
- Innocent masking ("just for education")
- Indirect intent detection
- Deception score impact on EZA score

### 3. Psychological Pressure (`test_psych_pressure.py`)
- Urgency pressure ("acil", "urgent")
- Reassurance pressure ("I won't do anything bad")
- Social proof pressure
- Pressure impact on scores

### 4. Legal Risk (`test_legal_risk.py`)
- Hacking-related risks
- Drug production risks
- Fraud detection
- Legal risk impact on scores

### 5. Alignment Quality (`test_alignment_quality.py`)
- Safe rewrite quality
- Risky output correction
- Safe output preservation
- Illegal activity blocking

### 6. Output Safety (`test_output_safety.py`)
- Safe answer guarantees
- Raw model error handling
- Forbidden phrase filtering
- Consistency checks

### 7. Score Correctness (`test_score_correctness.py`)
- Low risk → high score
- High risk → low score
- Deception impact
- Pressure impact
- Legal risk impact
- Score breakdown structure

### 8. Full Pipeline (`test_full_pipeline_real_world.py`)
- Context graph risk progression
- Manipulation detection across messages
- Output safety validation
- Topic change handling
- Risk escalation
- Error recovery

## Test Scenarios

30+ scenarios are defined in `helpers/scenarios.json`:

- **Intent Tests**: 8 scenarios
- **Deception Tests**: 7 scenarios
- **Legal Risk Tests**: 7 scenarios
- **Psychological Pressure Tests**: 7 scenarios
- **Alignment Tests**: 5 scenarios
- **Score Tests**: 7 scenarios
- **Full Pipeline Tests**: 5 scenarios

## Configuration

### LLM Settings (`helpers/llm_settings.py`)

```python
LLM_MODEL_NAME = "gpt-4o-mini"
MAX_TOKENS = 200
TEMPERATURE = 0.2
USE_REAL_LLM = True
```

## Notes

⚠️ **Important**: These tests use **real LLM** and will incur API costs.

- Tests are designed to be comprehensive but may take time
- Each test makes actual LLM API calls
- Use `USE_REAL_LLM = False` for faster development testing
- All tests use `@pytest.mark.requires_real_llm` marker

## Expected Behavior

- **Low risk inputs** → High EZA scores (70-100)
- **High risk inputs** → Low EZA scores (0-40)
- **Deception detected** → Lower scores
- **Pressure detected** → Lower scores
- **Legal risk detected** → Lower scores
- **Risky raw output** → Safe answer rewritten
- **Safe raw output** → Safe answer preserved

## Troubleshooting

### Tests failing with API errors
- Check API key configuration
- Verify network connectivity
- Check rate limits

### Tests taking too long
- Set `USE_REAL_LLM = False` for development
- Run specific test files instead of all tests
- Check LLM provider status

### Score assertions failing
- Scores may vary slightly between runs
- Adjust expected ranges if needed
- Check if LLM behavior changed

