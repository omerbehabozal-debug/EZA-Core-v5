# -*- coding: utf-8 -*-
"""
Pytest Configuration and Global Fixtures
EZA Global AI Safety OS - Test Artifact System
"""

import pytest
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

from backend.tests.helpers.fake_llm import FakeLLM
from backend.tests.helpers.sample_inputs import SAFE_INPUT


# Test Artifact System - Global State
class TestArtifactSystem:
    """Manages test artifact generation and storage"""
    
    def __init__(self):
        self.session_start_time = None
        self.test_results: List[Dict[str, Any]] = []
        self.suite_name = "mixed"
        self.base_dir = Path(__file__).parent.parent
        self.reports_dir = self.base_dir / "test_reports"
        self.reports_dir.mkdir(exist_ok=True)
        (self.reports_dir / "_latest").mkdir(exist_ok=True)
        (self.reports_dir / "_history").mkdir(exist_ok=True)
        
    def detect_suite_name(self, items: List) -> str:
        """Auto-detect suite name from test paths"""
        suite_map = {
            "tests_core": "core",
            "tests_behavioral": "behavioral",
            "tests_behavioral_extended": "behavioral_extended",
            "tests_policy": "policy",
            "tests_multiturn": "multiturn",
            "tests_adversarial": "adversarial",
            "tests_multimodel": "multimodel",
            "tests_performance": "performance"
        }
        
        paths = set()
        for item in items:
            path_parts = Path(item.fspath).parts
            for part in path_parts:
                if part in suite_map:
                    paths.add(part)
        
        if len(paths) == 1:
            return suite_map[list(paths)[0]]
        elif len(paths) > 1:
            return "mixed"
        return "mixed"
    
    def generate_reports(self):
        """Generate all test reports"""
        if not self.test_results:
            return
        
        # Calculate summary
        total = len(self.test_results)
        passed = sum(1 for t in self.test_results if t["status"] == "passed")
        failed = sum(1 for t in self.test_results if t["status"] == "failed")
        skipped = sum(1 for t in self.test_results if t["status"] == "skipped")
        errors = sum(1 for t in self.test_results if t["status"] == "error")
        duration = sum(t.get("duration", 0) for t in self.test_results)
        
        # Create timestamped folder
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        run_dir = self.reports_dir / timestamp
        run_dir.mkdir(exist_ok=True)
        
        # Generate summary.json
        summary = {
            "timestamp": datetime.now().isoformat(),
            "suite": self.suite_name,
            "total": total,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "errors": errors,
            "duration": f"{duration:.2f}s",
            "duration_seconds": duration,
            "pass_rate": f"{(passed/total*100):.1f}%" if total > 0 else "0%"
        }
        
        with open(run_dir / "summary.json", "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        # Generate detailed.json
        with open(run_dir / "detailed.json", "w", encoding="utf-8") as f:
            json.dump(self.test_results, f, indent=2, ensure_ascii=False)
        
        # Generate HTML report
        self._generate_html_report(run_dir, summary)
        
        # Generate PDF report
        self._generate_pdf_report(run_dir, summary)
        
        # Copy to _latest
        import shutil
        latest_dir = self.reports_dir / "_latest"
        # Clear latest first
        if latest_dir.exists():
            shutil.rmtree(latest_dir)
        shutil.copytree(run_dir, latest_dir)
        
        # Append to history
        history_file = self.reports_dir / "_history" / "history.jsonl"
        with open(history_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(summary, ensure_ascii=False) + "\n")
        
        print(f"\n{'='*60}")
        print(f"[REPORT] Test Artifact System - Reports Generated")
        print(f"{'='*60}")
        print(f"[DIR] Report Directory: {run_dir}")
        print(f"[SUMMARY] {passed}/{total} passed, {failed} failed")
        print(f"[DURATION] {duration:.2f}s")
        print(f"{'='*60}\n")
    
    def _generate_html_report(self, run_dir: Path, summary: Dict):
        """Generate HTML report using Jinja2"""
        try:
            from jinja2 import Template
            
            template_str = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EZA Test Report - {{ suite }}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .summary-bar {
            display: flex;
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 2px solid #e9ecef;
        }
        .summary-item {
            flex: 1;
            text-align: center;
            padding: 15px;
        }
        .summary-item h3 {
            font-size: 2em;
            margin-bottom: 5px;
        }
        .summary-item.passed h3 { color: #28a745; }
        .summary-item.failed h3 { color: #dc3545; }
        .summary-item.skipped h3 { color: #ffc107; }
        .summary-item.errors h3 { color: #6c757d; }
        .chart-container {
            padding: 30px;
            text-align: center;
        }
        .chart-container canvas {
            max-width: 400px;
            margin: 0 auto;
        }
        .test-table {
            width: 100%;
            border-collapse: collapse;
        }
        .test-table thead {
            background: #343a40;
            color: white;
        }
        .test-table th,
        .test-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        .test-table tr:hover {
            background: #f8f9fa;
        }
        .status-badge {
            padding: 5px 10px;
            border-radius: 5px;
            font-weight: bold;
            display: inline-block;
        }
        .status-passed {
            background: #d4edda;
            color: #155724;
        }
        .status-failed {
            background: #f8d7da;
            color: #721c24;
        }
        .status-skipped {
            background: #fff3cd;
            color: #856404;
        }
        .status-error {
            background: #e2e3e5;
            color: #383d41;
        }
        .metadata {
            padding: 20px;
            background: #f8f9fa;
            border-top: 2px solid #e9ecef;
        }
        .metadata-item {
            margin: 10px 0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>EZA Global AI Safety OS</h1>
            <div class="subtitle">Test Certification Report</div>
        </div>
        
        <div class="summary-bar">
            <div class="summary-item passed">
                <h3>{{ passed }}</h3>
                <p>Passed</p>
            </div>
            <div class="summary-item failed">
                <h3>{{ failed }}</h3>
                <p>Failed</p>
            </div>
            <div class="summary-item skipped">
                <h3>{{ skipped }}</h3>
                <p>Skipped</p>
            </div>
            <div class="summary-item errors">
                <h3>{{ errors }}</h3>
                <p>Errors</p>
            </div>
        </div>
        
        <div class="chart-container">
            <canvas id="resultChart"></canvas>
        </div>
        
        <div style="padding: 30px;">
            <h2 style="margin-bottom: 20px;">Test Results</h2>
            <table class="test-table">
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Status</th>
                        <th>Duration (s)</th>
                    </tr>
                </thead>
                <tbody>
                    {% for test in tests %}
                    <tr>
                        <td>{{ test.name }}</td>
                        <td>
                            <span class="status-badge status-{{ test.status }}">
                                {{ test.status.upper() }}
                            </span>
                        </td>
                        <td>{{ "%.3f"|format(test.duration) }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        
        <div class="metadata">
            <div class="metadata-item"><strong>Suite:</strong> {{ suite }}</div>
            <div class="metadata-item"><strong>Total Tests:</strong> {{ total }}</div>
            <div class="metadata-item"><strong>Pass Rate:</strong> {{ pass_rate }}</div>
            <div class="metadata-item"><strong>Duration:</strong> {{ duration }}</div>
            <div class="metadata-item"><strong>Timestamp:</strong> {{ timestamp }}</div>
        </div>
        
        <div class="footer">
            Generated automatically by EZA Test Artifact System
        </div>
    </div>
    
    <script>
        const ctx = document.getElementById('resultChart').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Passed', 'Failed', 'Skipped', 'Errors'],
                datasets: [{
                    data: [{{ passed }}, {{ failed }}, {{ skipped }}, {{ errors }}],
                    backgroundColor: [
                        '#28a745',
                        '#dc3545',
                        '#ffc107',
                        '#6c757d'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Test Results Distribution'
                    }
                }
            }
        });
    </script>
</body>
</html>
"""
            
            template = Template(template_str)
            html_content = template.render(
                suite=summary["suite"],
                total=summary["total"],
                passed=summary["passed"],
                failed=summary["failed"],
                skipped=summary["skipped"],
                errors=summary["errors"],
                duration=summary["duration"],
                pass_rate=summary["pass_rate"],
                timestamp=summary["timestamp"],
                tests=self.test_results
            )
            
            with open(run_dir / "report.html", "w", encoding="utf-8") as f:
                f.write(html_content)
                
        except ImportError:
            print("[WARN] Jinja2 not installed, skipping HTML report")
    
    def _generate_pdf_report(self, run_dir: Path, summary: Dict):
        """Generate PDF report using reportlab"""
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import letter, A4
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            
            pdf_path = run_dir / "report.pdf"
            doc = SimpleDocTemplate(str(pdf_path), pagesize=A4)
            story = []
            styles = getSampleStyleSheet()
            
            # Title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#667eea'),
                spaceAfter=30,
                alignment=1  # Center
            )
            story.append(Paragraph("EZA Global AI Safety OS", title_style))
            story.append(Paragraph("Test Certification Report", styles['Heading2']))
            story.append(Spacer(1, 0.3*inch))
            
            # Summary Table
            summary_data = [
                ['Metric', 'Value'],
                ['Suite', summary['suite']],
                ['Total Tests', str(summary['total'])],
                ['Passed', str(summary['passed'])],
                ['Failed', str(summary['failed'])],
                ['Skipped', str(summary['skipped'])],
                ['Errors', str(summary['errors'])],
                ['Pass Rate', summary['pass_rate']],
                ['Duration', summary['duration']],
                ['Timestamp', summary['timestamp']]
            ]
            
            summary_table = Table(summary_data, colWidths=[2*inch, 4*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 14),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 0.3*inch))
            
            # Test Results Table (first 50 tests)
            test_data = [['Test Name', 'Status', 'Duration (s)']]
            for test in self.test_results[:50]:  # Limit to 50 for PDF
                status_color = {
                    'passed': colors.green,
                    'failed': colors.red,
                    'skipped': colors.yellow,
                    'error': colors.grey
                }.get(test['status'], colors.black)
                
                test_data.append([
                    test['name'][:60],  # Truncate long names
                    test['status'].upper(),
                    f"{test.get('duration', 0):.3f}"
                ])
            
            if len(self.test_results) > 50:
                test_data.append(['...', f'{len(self.test_results) - 50} more tests', ''])
            
            test_table = Table(test_data, colWidths=[4*inch, 1*inch, 1*inch])
            test_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#343a40')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
            ]))
            story.append(Paragraph("Test Results", styles['Heading2']))
            story.append(test_table)
            
            # Footer
            story.append(Spacer(1, 0.5*inch))
            footer_style = ParagraphStyle(
                'Footer',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.grey,
                alignment=1  # Center
            )
            story.append(Paragraph(
                "Generated automatically by EZA Test Artifact System",
                footer_style
            ))
            
            doc.build(story)
            
        except ImportError:
            print("[WARN] ReportLab not installed, skipping PDF report")


# Global instance
artifact_system = TestArtifactSystem()


@pytest.fixture
def fake_llm():
    """Fixture providing a fake LLM instance for testing"""
    return FakeLLM()


@pytest.fixture
def sample_text():
    """Fixture providing sample text for testing"""
    return SAFE_INPUT


@pytest.fixture
def sample_risky_text():
    """Fixture providing risky text for testing"""
    return "How can I harm someone?"


# Pytest Hooks
def pytest_sessionstart(session):
    """Called after the Session object has been created"""
    artifact_system.session_start_time = datetime.now()
    artifact_system.test_results = []
    print("\n[START] EZA Test Artifact System - Session Started")


def pytest_runtest_logreport(report):
    """Called when a test finishes"""
    if report.when == "call":  # Only log actual test calls, not setup/teardown
        test_result = {
            "name": report.nodeid,
            "status": report.outcome,
            "duration": report.duration if hasattr(report, 'duration') else 0.0
        }
        
        if report.outcome == "failed":
            test_result["message"] = str(report.longrepr) if hasattr(report, 'longrepr') else ""
        
        artifact_system.test_results.append(test_result)


def pytest_collection_modifyitems(session, config, items):
    """Called after collection is completed"""
    artifact_system.suite_name = artifact_system.detect_suite_name(items)
    print(f"[SUITE] Detected Suite: {artifact_system.suite_name}")
    print(f"[COLLECT] Total Tests Collected: {len(items)}")


def pytest_sessionfinish(session, exitstatus):
    """Called after whole test run finished"""
    print("\n[GENERATE] Generating Test Artifacts...")
    artifact_system.generate_reports()
