/**
 * General text and markdown adapter.
 *
 * Reads arbitrary text, essays, blog posts, newsletters, and notes (.txt / .md)
 * into a standardized corpus ready for Jev evaluation.
 *
 * Zero dependencies. Supports frontmatter, markdown headings, and plain text.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

export const TRUNCATION_CHARS = 210;

/**
 * Basic feature counter computed directly in code, never asked of an LLM.
 */
export function textFeatures(text) {
  const lines = text.split('\n');
  const words = text.match(/\b[\w'-]+\b/g) ?? [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  return {
    char_count: text.length,
    word_count: words.length,
    line_count: lines.length,
    blank_line_count: lines.filter((l) => !l.trim()).length,
    sentence_count: sentences.length,
  };
}

/**
 * Splits text into an opening hook and the remaining body.
 * If the first line is very short (< 60 chars), it absorbs the next line.
 */
export function splitHook(text) {
  const clean = text.replace(/^---[\s\S]*?---\n/, ''); // strip yaml frontmatter if present
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { hook_text: '', post_body: '' };
  if (lines[0].length < 60 && lines.length > 1) {
    return { hook_text: `${lines[0]} ${lines[1]}`, post_body: lines.slice(2).join('\n') };
  }
  return { hook_text: lines[0], post_body: lines.slice(1).join('\n') };
}

/**
 * Parse a single markdown or text file into a normalized post item.
 */
export function parseTextFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const defaultTitle = basename(filePath, extname(filePath));
  let title = null;
  let date = null;
  let content = raw;

  // Simple frontmatter parser
  if (raw.startsWith('---')) {
    const end = raw.indexOf('---', 3);
    if (end !== -1) {
      const fm = raw.slice(3, end);
      content = raw.slice(end + 3).trim();
      const titleMatch = fm.match(/title:\s*["']?([^"'\n]+)["']?/i);
      if (titleMatch) title = titleMatch[1].trim();
      const dateMatch = fm.match(/date:\s*["']?([0-9]{4}-[0-9]{2}-[0-9]{2})["']?/i);
      if (dateMatch) date = dateMatch[1];
    }
  }

  // Extract # title if present
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && !title) {
    title = headingMatch[1].trim();
  }

  title = title || defaultTitle;

  const { hook_text, post_body } = splitHook(content);
  const preview_text = content.slice(0, TRUNCATION_CHARS);
  const features = textFeatures(content);

  const stats = existsSync(filePath) ? statSync(filePath) : null;
  const itemDate = date ?? (stats ? new Date(stats.mtimeMs).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

  return {
    id: basename(filePath),
    title,
    date: itemDate,
    text: content,
    hook_text,
    post_body,
    preview_text,
    features,
  };
}

/**
 * Builds a corpus from a directory of text/markdown files.
 */
export function buildTextCorpus(dirPath) {
  if (!existsSync(dirPath)) throw new Error(`directory not found: ${dirPath}`);
  const files = readdirSync(dirPath)
    .filter((f) => /\.(md|markdown|txt)$/i.test(f))
    .sort();

  const items = files.map((f) => parseTextFile(join(dirPath, f)));
  return {
    items,
    warnings: items.length === 0 ? [`no .md or .txt files found in ${dirPath}`] : [],
  };
}
