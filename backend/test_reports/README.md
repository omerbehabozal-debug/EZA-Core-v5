# EZA Test Artifact System

## 📁 Directory Structure

```
test_reports/
├── _latest/              # Latest test run (always updated)
├── _history/            # Historical logs
│   └── history.jsonl    # One line per run
└── YYYY-MM-DD_HH-MM-SS/ # Timestamped runs
    ├── summary.json      # Test summary
    ├── detailed.json     # Detailed test results
    ├── report.html       # HTML report with charts
    └── report.pdf        # PDF certification report
```

## 📊 Report Formats

### summary.json
Contains high-level test statistics:
- Total tests
- Passed/Failed/Skipped/Errors counts
- Duration
- Pass rate
- Timestamp

### detailed.json
Contains individual test results:
- Test name
- Status (passed/failed/skipped/error)
- Duration
- Error messages (if any)

### report.html
Interactive HTML report with:
- Visual summary bar
- Pie chart (Chart.js)
- Test results table
- Metadata

### report.pdf
Professional PDF report for:
- Regulatory compliance
- Investor presentations
- Enterprise customers
- Internal QA

## 🔄 History Log

`_history/history.jsonl` contains one JSON object per line:
- Enables trend analysis
- Daily aggregation
- Long-term tracking

## 🚀 Usage

Simply run:
```bash
pytest -v
```

The system automatically:
1. Detects test suite name
2. Collects test results
3. Generates all reports
4. Updates _latest/
5. Appends to history

## 📈 Suite Detection

Automatically detects suite from test paths:
- `tests_core` → "core"
- `tests_behavioral` → "behavioral"
- `tests_behavioral_extended` → "behavioral_extended"
- `tests_policy` → "policy"
- `tests_multiturn` → "multiturn"
- `tests_adversarial` → "adversarial"
- `tests_multimodel` → "multimodel"
- `tests_performance` → "performance"
- Mixed paths → "mixed"

## 🎯 Use Cases

- **Regulatory Compliance**: RTÜK, BTK, EU AI Act
- **Investor Reports**: Professional test certification
- **Enterprise Customers**: Quality assurance documentation
- **Internal QA**: Trend analysis and tracking
- **Version History**: Permanent test artifact storage

