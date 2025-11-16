# EZA-Core v10 – Full Ethical AI Engine (Professional Edition)

## Overview

EZA-Core v10 is a comprehensive ethical AI analysis engine that detects harmful intent, manipulative reasoning, identity extraction attempts, and tracks conversation-level risk patterns.

## Technology Stack

- **Backend**: Python 3.11 + FastAPI
- **Processing**: Modular Rule Engine + Pattern Matching + Weighted Scoring Matrix
- **Memory**: Per-conversation Context Window (NarrativeEngine v4)
- **Security**: Role-based safety layers
- **Output**: JSON structured response + Alignment module

## Project Structure

```
eza_core/
 ├── main.py                    # FastAPI server
 ├── requirements.txt           # Dependencies
 ├── models/                    # Core engine modules
 │     ├── intent_engine.py     # IntentEngine v3.0
 │     ├── reasoning_shield.py  # ReasoningShield v5.0
 │     ├── identity_block.py    # IdentityBlock v3.0
 │     ├── narrative_engine.py  # NarrativeEngine v4.0
 │     ├── scoring_matrix.py    # Scoring matrix
 │     └── utils.py             # Utility functions
 ├── analyzers/                 # Analysis modules
 │     ├── input_analyzer.py    # Input analysis
 │     ├── output_analyzer.py   # Output analysis
 │     └── text_preprocess.py   # Text preprocessing
 ├── alignment/                 # Ethical alignment
 │     ├── advisor.py           # Advice generation
 │     └── ethical_alignment.py # Alignment engine
 └── tests/                     # Test suite
       ├── test_inputs.json     # Test cases
       └── test_engine.py       # Test runner
```

## Core Modules

### IntentEngine v3.0
- Action–Target–Purpose model
- Weighted risk matrix
- Detects: illegal, violence, self-harm, manipulation, sensitive-data, toxicity

### ReasoningShield v5.0
- Detects manipulative logic
- Identifies misleading scenarios
- Psychological forcing detection
- Social engineering patterns
- Disguised illegal intent
- Indirect violence detection

### IdentityBlock v3.0
- Face/identity inference detection
- Personal info extraction patterns
- TC, passport, phone number detection
- Kinship deduction attempts
- Direct/indirect person recognition

### NarrativeEngine v4.0
- Tracks long conversation risk
- Intent drift detection
- Cumulative risk calculation
- Hidden escalation detection
- Repeated harmful patterns

## Installation

```bash
cd eza_core
pip install -r requirements.txt
```

## Usage

### Run FastAPI Server

```bash
python main.py
```

Or with uvicorn:

```bash
uvicorn main:app --reload
```

### API Endpoint

**POST /eza**

Request:
```json
{
  "text": "user input text",
  "model_output": "optional model output"
}
```

Response:
```json
{
  "input_analysis": {...},
  "output_analysis": {...},
  "alignment": {...}
}
```

### Run Tests

```bash
python tests/test_engine.py
```

## Example

```python
from analyzers.input_analyzer import analyze_input
from alignment.ethical_alignment import align_response

# Analyze input
result = analyze_input("birini nasıl döverim")

# Get results
print(result["risk_level"])  # "high"
print(result["intent_engine"]["primary"])  # "violence"
```

## Alignment Levels

- **Safe**: Low risk, safe content
- **Caution**: Medium risk, requires attention
- **Unsafe**: High risk, potentially harmful
- **Critical**: Critical risk, immediate intervention needed

## License

Proprietary - EZA-Core v10

