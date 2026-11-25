"""Convert JSON Schema into an OpenAI Structured Outputs (strict) subset.

Domain / Pydantic validation stays separate. This only shapes the provider schema.
Docs: https://platform.openai.com/docs/guides/structured-outputs
"""
from __future__ import annotations

import copy
from typing import Any

# Keywords OpenAI Structured Outputs does not list as supported for request schemas.
_STRIP_KEYS = frozenset(
    {
        "default",
        "title",
        "examples",
        "deprecated",
        "$comment",
        "readOnly",
        "writeOnly",
    }
)


def for_openai_strict_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Return a deep-copied schema suitable for response_format json_schema strict=true.

    - Every object sets additionalProperties=false
    - Every object requires all of its property keys
    - Unsupported / noisy keywords are stripped from the provider schema
    - Nested $defs / anyOf / items are walked
    """
    if not isinstance(schema, dict):
        raise TypeError("schema must be a dict")
    out = copy.deepcopy(schema)
    _walk(out)
    return out


def assert_openai_strict_schema(schema: dict[str, Any]) -> list[str]:
    """Return human-readable violation paths (empty list means compliant)."""
    violations: list[str] = []
    _check(schema, "$", violations)
    return violations


def _walk(node: Any) -> None:
    if isinstance(node, list):
        for item in node:
            _walk(item)
        return
    if not isinstance(node, dict):
        return

    for key in list(node.keys()):
        if key in _STRIP_KEYS:
            node.pop(key, None)

    props = node.get("properties")
    if isinstance(props, dict):
        node["type"] = "object"
        node["additionalProperties"] = False
        node["required"] = list(props.keys())
        for value in props.values():
            _walk(value)

    for key in ("$defs", "definitions"):
        defs = node.get(key)
        if isinstance(defs, dict):
            for value in defs.values():
                _walk(value)

    if "items" in node:
        _walk(node["items"])

    for key in ("anyOf", "oneOf", "allOf"):
        branch = node.get(key)
        if isinstance(branch, list):
            for item in branch:
                _walk(item)

    # Recurse remaining nested dict values not already covered.
    for key, value in list(node.items()):
        if key in {"properties", "$defs", "definitions", "items", "anyOf", "oneOf", "allOf"}:
            continue
        if isinstance(value, (dict, list)):
            _walk(value)


def _check(node: Any, path: str, violations: list[str]) -> None:
    if isinstance(node, list):
        for index, item in enumerate(node):
            _check(item, f"{path}[{index}]", violations)
        return
    if not isinstance(node, dict):
        return

    props = node.get("properties")
    if isinstance(props, dict):
        if node.get("additionalProperties") is not False:
            violations.append(f"{path}.additionalProperties")
        required = node.get("required")
        if not isinstance(required, list) or set(required) != set(props.keys()):
            violations.append(f"{path}.required")
        for key in _STRIP_KEYS:
            if key in node:
                violations.append(f"{path}.{key}")
        for name, child in props.items():
            if isinstance(child, dict) and "default" in child:
                violations.append(f"{path}.properties.{name}.default")
            _check(child, f"{path}.properties.{name}", violations)

    for key in ("$defs", "definitions"):
        defs = node.get(key)
        if isinstance(defs, dict):
            for name, child in defs.items():
                _check(child, f"{path}.{key}.{name}", violations)

    if "items" in node:
        _check(node["items"], f"{path}.items", violations)
    for key in ("anyOf", "oneOf", "allOf"):
        branch = node.get(key)
        if isinstance(branch, list):
            for index, item in enumerate(branch):
                _check(item, f"{path}.{key}[{index}]", violations)
