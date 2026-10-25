"""Split knowledge without cutting Turkish text, titles, product codes, or numbers."""
import re

DEFAULT_TARGET = 1600
DEFAULT_OVERLAP = 200
DEFAULT_HARD = 2400

_CODE = re.compile(
    r"[A-Za-zÇĞİÖŞÜçğıöşü]{1,12}(?:[-/][A-Za-z0-9ÇĞİÖŞÜçğıöşü]{1,24})+"
)
_NUMBER = re.compile(
    r"\d{1,3}(?:[.\u00a0\u202f]\d{3})+(?:,\d+)?"
    r"|\d+(?:[.,]\d+)+"
)


def _spans(text):
    spans = [(match.start(), match.end()) for match in _CODE.finditer(text)]
    spans.extend((match.start(), match.end()) for match in _NUMBER.finditer(text))
    spans.sort()
    return spans


def _span_at(pos, spans):
    for start, end in spans:
        if start < pos < end:
            return start, end
    return None


def _split_block(text, hard):
    text = text.strip()
    if not text:
        return []
    if len(text) <= hard:
        return [text]
    spans = _spans(text)
    parts = []
    start = 0
    while start < len(text):
        if len(text) - start <= hard:
            tail = text[start:].strip()
            if tail:
                parts.append(tail)
            break
        limit = start + hard
        span = _span_at(limit, spans)
        if span is not None:
            span_start, span_end = span
            if span_end - span_start <= hard and span_start > start:
                cut = span_start
            elif span_end <= start + hard:
                cut = span_end
            else:
                cut = start + hard
        else:
            sentence = None
            space = None
            for index in range(limit, start, -1):
                if _span_at(index, spans):
                    continue
                previous = text[index - 1]
                if previous in ".!?…" and index < len(text) and text[index].isspace():
                    sentence = index
                    break
                if space is None and previous.isspace():
                    space = index
            cut = sentence or space or limit
        if cut <= start:
            cut = min(len(text), start + 1)
        piece = text[start:cut].strip()
        if piece:
            parts.append(piece)
        nxt = cut
        while nxt < len(text) and text[nxt].isspace():
            nxt += 1
        if nxt <= start:
            nxt = min(len(text), start + 1)
        start = nxt
    return parts


def _tail(text, size):
    if size <= 0 or len(text) <= size:
        return text if size > 0 else ""
    start = len(text) - size
    for span_start, span_end in _spans(text):
        if span_start < start < span_end:
            start = span_start
            break
    if start > 0 and not text[start - 1].isspace():
        snap = text.rfind(" ", 0, start)
        if snap != -1 and start - snap <= 40:
            start = snap + 1
    return text[start:].strip()


def _blocks(content, hard):
    raw = [block.strip() for block in re.split(r"\n\s*\n", content.strip()) if block.strip()]
    merged = []
    index = 0
    while index < len(raw):
        block = raw[index]
        lines = block.splitlines()
        heading = block.startswith("#") or (len(lines) == 1 and len(block) <= 100 and block[-1:] not in ".!?")
        if heading and index + 1 < len(raw):
            combined = block + "\n\n" + raw[index + 1]
            if len(combined) <= hard:
                merged.append(combined)
                index += 2
                continue
        merged.append(block)
        index += 1
    return merged


def _pack(blocks, target, overlap, hard):
    chunks = []
    current = ""
    for block in blocks:
        for piece in _split_block(block, hard):
            if not current:
                current = piece
                continue
            if len(current) + 2 + len(piece) <= target:
                current = current + "\n\n" + piece
                continue
            chunks.append(current)
            prefix = _tail(current, overlap)
            if prefix and len(prefix) + 1 + len(piece) <= hard:
                current = prefix + "\n" + piece
            else:
                current = piece
    if current:
        chunks.append(current)
    return chunks


def product_codes(text):
    """Product-code tokens. A later split may divide a code that does not fit one chunk."""
    return [match.group(0) for match in _CODE.finditer(text or "")]


def split_knowledge(title, category, content, *, target_chars=DEFAULT_TARGET, overlap_chars=DEFAULT_OVERLAP, hard_max_chars=DEFAULT_HARD):
    """Return chunk texts. Each finished chunk, including its title, stays within hard_max_chars.

    Product codes and numbers stay whole when they fit in the body budget. A token longer
    than that budget is split: the size limit wins over keeping the code intact.
    A header that already fills the limit is kept as its own truncated chunk; the body
    then continues without repeating that header.
    """
    body = (content or "").strip()
    if not body:
        return []
    header = (title or "").strip()
    if category and str(category).strip():
        header = (header + "\n" + str(category).strip()).strip()
    if header and len(header) >= hard_max_chars:
        chunks = [header[:hard_max_chars]]
        header = ""
        budget = hard_max_chars
    elif header:
        budget = hard_max_chars - len(header) - 1
        chunks = []
    else:
        budget = hard_max_chars
        chunks = []
    if budget < 1:
        budget = 1
    for piece in _pack(_blocks(body, budget), min(target_chars, budget), overlap_chars, budget):
        if header and not piece.startswith(header):
            text = header + "\n" + piece
        else:
            text = piece
        if len(text) > hard_max_chars:
            text = text[:hard_max_chars]
        chunks.append(text)
    return chunks
