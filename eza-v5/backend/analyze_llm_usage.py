#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
LLM Usage Map - Complete Inventory
Analyzes all LLM calls in the codebase
"""

import re
from pathlib import Path
from typing import Dict, List, Tuple, Any

def find_llm_calls() -> List[Dict[str, Any]]:
    """Find all LLM calls in the codebase"""
    backend_dir = Path(".")
    llm_calls = []
    
    # Patterns to search for
    patterns = [
        (r"call_llm_provider\s*\(", "call_llm_provider"),
        (r"route_model\s*\(", "route_model"),
        (r"_get_llm_response\s*\(", "_get_llm_response"),
        (r"generate_openai\s*\(", "generate_openai"),
        (r"generate_groq\s*\(", "generate_groq"),
        (r"generate_mistral\s*\(", "generate_mistral"),
        (r"OpenAIClient\(\)", "OpenAIClient"),
        (r"GroqClient\(\)", "GroqClient"),
        (r"MistralClient\(\)", "MistralClient"),
    ]
    
    # Files to search
    search_paths = [
        "routers",
        "services",
        "api",
        "core/llm",
        "gateway",
    ]
    
    for search_path in search_paths:
        path = backend_dir / search_path
        if not path.exists():
            continue
            
        for file_path in path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding='utf-8')
                
                # Find function definitions
                function_pattern = r"^(async\s+)?def\s+(\w+)\s*\("
                functions = re.finditer(function_pattern, content, re.MULTILINE)
                
                for func_match in functions:
                    func_name = func_match.group(2)
                    func_start = func_match.start()
                    
                    # Find LLM calls within this function
                    func_end = find_function_end(content, func_start)
                    func_body = content[func_start:func_end]
                    
                    for pattern, call_type in patterns:
                        if re.search(pattern, func_body):
                            # Find endpoint if in router file
                            endpoint = None
                            if "router" in str(file_path):
                                endpoint_match = re.search(r'@router\.(post|get|put|delete)\("([^"]+)"', content[:func_start])
                                if endpoint_match:
                                    endpoint = f"{endpoint_match.group(1).upper()} {endpoint_match.group(2)}"
                            
                            # Extract max_tokens if present
                            max_tokens_match = re.search(r"max_tokens\s*=\s*(\d+)", func_body)
                            max_tokens = int(max_tokens_match.group(1)) if max_tokens_match else None
                            
                            # Extract temperature if present
                            temp_match = re.search(r"temperature\s*=\s*([\d.]+)", func_body)
                            temperature = float(temp_match.group(1)) if temp_match else None
                            
                            llm_calls.append({
                                "file": str(file_path.relative_to(backend_dir)),
                                "function": func_name,
                                "endpoint": endpoint,
                                "call_type": call_type,
                                "max_tokens": max_tokens,
                                "temperature": temperature,
                            })
            except Exception as e:
                continue
    
    return llm_calls

def find_function_end(content: str, start_pos: int) -> int:
    """Find the end of a function (rough estimate)"""
    lines = content[start_pos:].split('\n')
    indent_level = None
    end_pos = start_pos
    
    for i, line in enumerate(lines[1:], 1):
        if not line.strip():
            continue
        if indent_level is None:
            indent_level = len(line) - len(line.lstrip())
        current_indent = len(line) - len(line.lstrip())
        if current_indent <= indent_level and line.strip() and not line.strip().startswith('#'):
            return start_pos + sum(len(l) + 1 for l in lines[:i])
    
    return len(content)

def analyze_operations() -> Dict[str, bool]:
    """Check which operations use LLM"""
    operations = {
        "Metin etik analizi": False,
        "Risk skor hesaplama": False,
        "Niyet / bağlam analizi": False,
        "Paragraf bazlı risk dağılımı": False,
        "Uzun metin segmentasyonu": False,
        "Özetleme": False,
        "Rewrite / Suggested text": False,
    }
    
    # Check files
    files_to_check = {
        "Metin etik analizi": ["proxy_analyzer.py", "proxy_analyzer_stage1.py"],
        "Risk skor hesaplama": ["proxy_analyzer_stage0.py", "proxy_analyzer_stage1.py"],
        "Niyet / bağlam analizi": ["proxy_analyzer_stage1.py", "proxy_analyzer.py"],
        "Paragraf bazlı risk dağılımı": ["proxy_analyzer_stage1.py"],
        "Uzun metin segmentasyonu": ["proxy_analyzer_stage0.py"],
        "Özetleme": [],
        "Rewrite / Suggested text": ["proxy_rewrite_engine.py", "proxy_analyzer_stage2.py", "proxy_lite.py"],
    }
    
    for op, files in files_to_check.items():
        for file in files:
            file_path = Path(f"services/{file}")
            if file_path.exists():
                content = file_path.read_text(encoding='utf-8')
                if "call_llm_provider" in content or "route_model" in content:
                    operations[op] = True
                    break
    
    return operations

def main():
    print("=" * 80)
    print("LLM USAGE MAP - COMPLETE INVENTORY")
    print("=" * 80)
    print()
    
    # Find all LLM calls
    llm_calls = find_llm_calls()
    
    # Group by file
    by_file = {}
    for call in llm_calls:
        file = call["file"]
        if file not in by_file:
            by_file[file] = []
        by_file[file].append(call)
    
    print("📁 LLM CLIENT ÇAĞRILARI")
    print("-" * 80)
    print(f"{'Dosya':<50} {'Fonksiyon':<30} {'Endpoint':<40}")
    print("-" * 80)
    
    for file, calls in sorted(by_file.items()):
        for call in calls:
            endpoint = call["endpoint"] or "N/A"
            print(f"{file:<50} {call['function']:<30} {endpoint:<40}")
    
    print()
    print("=" * 80)
    print("İŞLEMLERDE LLM KULLANIMI")
    print("=" * 80)
    
    operations = analyze_operations()
    for op, uses_llm in operations.items():
        status = "✅ VAR" if uses_llm else "❌ YOK"
        print(f"{op:<40} {status}")
    
    print()
    print("=" * 80)
    print("ENDPOINT BAZLI LLM KULLANIMI")
    print("=" * 80)
    
    # Group by endpoint
    by_endpoint = {}
    for call in llm_calls:
        endpoint = call["endpoint"] or "Internal Function"
        if endpoint not in by_endpoint:
            by_endpoint[endpoint] = {
                "llm_used": True,
                "max_tokens": call["max_tokens"],
                "temperature": call["temperature"],
                "calls": []
            }
        by_endpoint[endpoint]["calls"].append(call)
    
    print(f"{'Endpoint':<50} {'LLM':<10} {'Max Tokens':<15} {'Risk':<15}")
    print("-" * 80)
    
    for endpoint, info in sorted(by_endpoint.items()):
        max_tokens = info["max_tokens"] or "N/A"
        risk = "YÜKSEK" if info["max_tokens"] and info["max_tokens"] > 1000 else "ORTA" if info["max_tokens"] and info["max_tokens"] > 300 else "DÜŞÜK"
        print(f"{endpoint:<50} {'VAR':<10} {str(max_tokens):<15} {risk:<15}")

if __name__ == "__main__":
    main()

