import { parse, type ParserOptions } from '@babel/parser';
import type { File } from '@babel/types';
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, extname } from 'path';

const PARSER_OPTIONS: ParserOptions = {
  sourceType: 'unambiguous',
  errorRecovery: true,
  allowReturnOutsideFunction: true,
  allowAwaitOutsideFunction: true,
  allowImportExportEverywhere: true,
  plugins: ['jsx', 'typescript'],
};

export interface ParsedSource {
  file: string;
  relativeFile: string;
  code: string;
  ast: File;
}

export interface ParseFailure {
  file: string;
  relativeFile: string;
  error: string;
}

export async function discoverJsFiles(cloneDir: string): Promise<string[]> {
  const out: string[] = [];
  await walk(cloneDir, out);
  return out.filter((p) => extname(p).toLowerCase() === '.js');
}

async function walk(dir: string, acc: string[]): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      await walk(full, acc);
    } else if (s.isFile()) {
      acc.push(full);
    }
  }
}

export async function extractInlineScripts(indexHtmlPath: string): Promise<string[]> {
  let html: string;
  try {
    html = await readFile(indexHtmlPath, 'utf8');
  } catch {
    return [];
  }
  const scripts: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    const trimmed = body.trim();
    if (trimmed.length > 0) scripts.push(trimmed);
  }
  return scripts;
}

export function parseSource(code: string): File {
  return parse(code, PARSER_OPTIONS);
}

export async function parseFile(
  cloneDir: string,
  absPath: string,
): Promise<ParsedSource | ParseFailure> {
  const relativeFile = relative(cloneDir, absPath);
  try {
    const code = await readFile(absPath, 'utf8');
    const ast = parseSource(code);
    return { file: absPath, relativeFile, code, ast };
  } catch (err) {
    return {
      file: absPath,
      relativeFile,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isFailure(p: ParsedSource | ParseFailure): p is ParseFailure {
  return 'error' in p;
}
