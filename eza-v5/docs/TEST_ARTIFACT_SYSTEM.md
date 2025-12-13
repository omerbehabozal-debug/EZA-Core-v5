# EZA Test Artifact System

## 🎯 Overview

The EZA Test Artifact System automatically generates professional test reports for regulatory compliance, investor presentations, and enterprise customers.

## 📦 Installation

Install required dependencies:

```bash
pip install jinja2 reportlab
```

Or update from requirements.txt:

```bash
pip install -r requirements.txt
```

## 🚀 Usage

Simply run your tests as usual:

```bash
# Run all tests
pytest -v

# Run specific suite
pytest tests_policy -v

# Run specific test
pytest tests_policy/test_A_policies.py -v
```

The system automatically:
1. ✅ Detects test suite name
2. ✅ Collects all test results
3. ✅ Generates JSON, HTML, and PDF reports
4. ✅ Updates `_latest/` folder
5. ✅ Appends to history log

## 📁 Generated Reports

After each test run, reports are generated in:

```
backend/test_reports/YYYY-MM-DD_HH-MM-SS/
├── summary.json      # High-level statistics
├── detailed.json     # Individual test results
├── report.html       # Interactive HTML with charts
└── report.pdf        # Professional PDF certification
```

## 📊 Report Formats

### summary.json
```json
{
  "timestamp": "2024-01-15T10:30:00",
  "suite": "policy",
  "total": 127,
  "passed": 127,
  "failed": 0,
  "skipped": 0,
  "errors": 0,
  "duration": "32.5s",
  "pass_rate": "100.0%"
}
```

### detailed.json
Array of individual test results with:
- Test name
- Status (passed/failed/skipped/error)
- Duration
- Error messages (if any)

### report.html
- Visual summary bar
- Interactive pie chart (Chart.js)
- Complete test results table
- Metadata and timestamps

### report.pdf
Professional PDF for:
- Regulatory submissions (RTÜK, BTK, EU AI Act)
- Investor presentations
- Enterprise customer documentation
- Internal QA records

## 📈 History Tracking

All test runs are logged to:
```
test_reports/_history/history.jsonl
```

Each line contains one JSON object per run, enabling:
- Trend analysis
- Daily aggregation
- Long-term tracking
- Pass rate monitoring

## 🔍 Suite Detection

The system automatically detects suite names:

| Test Path | Suite Name |
|-----------|-----------|
| `tests_core` | `core` |
| `tests_behavioral` | `behavioral` |
| `tests_behavioral_extended` | `behavioral_extended` |
| `tests_policy` | `policy` |
| `tests_multiturn` | `multiturn` |
| `tests_adversarial` | `adversarial` |
| `tests_multimodel` | `multimodel` |
| `tests_performance` | `performance` |
| Mixed paths | `mixed` |

## 🎯 Use Cases

### Regulatory Compliance
- **RTÜK**: Turkish Radio and Television Supreme Council
- **BTK**: Information and Communication Technologies Authority
- **EU AI Act**: European Union AI Regulation

### Enterprise Customers
- Quality assurance documentation
- Test certification reports
- Compliance verification

### Internal QA
- Test trend analysis
- Pass rate monitoring
- Historical comparison

### Investor Presentations
- Professional test reports
- Quality metrics
- System reliability data

## 📝 Example Output

```
[START] EZA Test Artifact System - Session Started
[SUITE] Detected Suite: policy
[COLLECT] Total Tests Collected: 127
...
[GENERATE] Generating Test Artifacts...

============================================================
[REPORT] Test Artifact System - Reports Generated
============================================================
[DIR] Report Directory: test_reports/2024-01-15_10-30-45
[SUMMARY] 127/127 passed, 0 failed
[DURATION] 32.50s
============================================================
```

## 🔧 Configuration

The system is configured in `backend/conftest.py`:
- Report directory: `backend/test_reports/`
- Latest folder: `backend/test_reports/_latest/`
- History file: `backend/test_reports/_history/history.jsonl`

## 📋 Requirements

- Python 3.8+
- pytest 7.4.3+
- jinja2 3.1.2+ (for HTML reports)
- reportlab 4.0.7+ (for PDF reports)

## 🎨 Customization

To customize reports, modify:
- HTML template: `conftest.py` → `_generate_html_report()`
- PDF layout: `conftest.py` → `_generate_pdf_report()`
- JSON format: `conftest.py` → `generate_reports()`

## ✅ Status

System is fully operational and integrated with pytest hooks.

