/**
 * Splits assistant message text into readable blocks (paragraphs, lists).
 */

export type SainaMessageBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

const LIST_LINE = /^\s*(?:[-•*–]\s+|\d+[.)]\s+)/;
const SENTENCE_END = /[.!?…]/;
const SENTENCE_START = /^["«(]*[A-ZÇĞİÖŞÜ0-9]/;
const CLOSING_QUOTES = /["»)]/;

const LONG_LINE_THRESHOLD = 220;
const SENTENCES_PER_PARAGRAPH = 2;

function splitSentences(line: string): string[] {
  const sentences: string[] = [];
  let chunk = '';

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    chunk += char;

    if (!SENTENCE_END.test(char)) continue;

    let cursor = index + 1;
    while (cursor < line.length && CLOSING_QUOTES.test(line[cursor])) {
      chunk += line[cursor];
      index = cursor;
      cursor += 1;
    }

    while (cursor < line.length && /\s/.test(line[cursor])) {
      cursor += 1;
    }

    const rest = line.slice(cursor);
    if (rest.length > 0 && SENTENCE_START.test(rest)) {
      const trimmed = chunk.trim();
      if (trimmed) sentences.push(trimmed);
      chunk = '';
    }
  }

  const tail = chunk.trim();
  if (tail) sentences.push(tail);

  return sentences.length ? sentences : [line];
}

function paragraphizeLongLine(line: string): SainaMessageBlock[] {
  if (line.length < LONG_LINE_THRESHOLD) {
    return [{ type: 'paragraph', text: line }];
  }

  const sentences = splitSentences(line);

  if (sentences.length < 3) {
    return [{ type: 'paragraph', text: line }];
  }

  const paragraphs: SainaMessageBlock[] = [];
  for (let index = 0; index < sentences.length; index += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push({
      type: 'paragraph',
      text: sentences.slice(index, index + SENTENCES_PER_PARAGRAPH).join(' '),
    });
  }

  return paragraphs;
}

function flushList(buffer: string[], blocks: SainaMessageBlock[]) {
  if (!buffer.length) return;
  blocks.push({ type: 'list', items: [...buffer] });
  buffer.length = 0;
}

function linesToBlocks(lines: string[]): SainaMessageBlock[] {
  const blocks: SainaMessageBlock[] = [];
  const listBuffer: string[] = [];

  for (const line of lines) {
    if (LIST_LINE.test(line)) {
      listBuffer.push(line.replace(LIST_LINE, '').trim());
      continue;
    }

    flushList(listBuffer, blocks);
    blocks.push(...paragraphizeLongLine(line));
  }

  flushList(listBuffer, blocks);
  return blocks;
}

export function splitSainaMessageIntoBlocks(raw: string): SainaMessageBlock[] {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const sections = text.split(/\n\n+/).map((section) => section.trim()).filter(Boolean);
  const blocks: SainaMessageBlock[] = [];

  for (const section of sections) {
    const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) {
      blocks.push(...paragraphizeLongLine(lines[0] ?? section));
      continue;
    }

    blocks.push(...linesToBlocks(lines));
  }

  return blocks.length ? blocks : [{ type: 'paragraph', text }];
}
