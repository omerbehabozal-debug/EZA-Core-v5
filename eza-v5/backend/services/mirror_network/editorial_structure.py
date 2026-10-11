"""Lossless original-language presentation metadata. No private inputs or AI.

Offsets count UTF-16 code units in the exact, unnormalised public string, matching
JavaScript/Markdown source positions. Only unambiguous top-level ATX headings
are decorated. Everything else (including old flattened text) remains Markdown.
"""
import hashlib
import json
import re

TEMPLATE_VERSION = 1
ORIGINAL_LANGUAGE = "und"  # No authoritative language is persisted by frozen v1.


def text_hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def utf16_length(text):
    return len(text.encode("utf-16-le")) // 2


def source_hash(public):
    source = {"publicTitle": public.get("publicTitle"), "steps": [
        {k: step[k] for k in ("stepIndex", "publicQuestion", "publicAnswer")}
        for step in public["steps"]]}
    return text_hash(json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def answer_blocks(text):
    blocks = []
    offset = 0
    fenced = None
    number = 0
    for line in re.findall(r"[^\r\n]*(?:\r\n|\r|\n|$)", text):
        if not line:
            continue
        end = offset + utf16_length(line)
        fence = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        heading = re.match(r"^ {0,3}#{1,6}[\t ]+\S", line) if fenced is None else None
        if fence:
            marker = fence.group(1)
            if fenced is None:
                fenced = marker
            elif marker[0] == fenced[0] and len(marker) >= len(fenced) and not line[fence.end():].strip():
                fenced = None
        if heading:
            number += 1
            blocks.append({"type": "sectionHeading", "startOffset": offset, "endOffset": end,
                           "displayNumber": f"{number:02d}"})
        elif blocks and blocks[-1]["type"] == "markdown":
            blocks[-1]["endOffset"] = end
        else:
            blocks.append({"type": "markdown", "startOffset": offset, "endOffset": end})
        offset = end
    return blocks


def build_metadata(public):
    return [{"stepIndex": step["stepIndex"], "questionHash": text_hash(step["publicQuestion"]),
             "answerHash": text_hash(step["publicAnswer"]), "blocks": answer_blocks(step["publicAnswer"])}
            for step in public["steps"]]


def validate_metadata(public, metadata):
    # Exact deterministic equality rejects gaps, overlaps, forged headings,
    # reordered steps, arbitrary AI metadata, and stale source hashes.
    if metadata != build_metadata(public):
        raise ValueError("invalid_editorial_metadata")
    return metadata
