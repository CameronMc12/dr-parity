/**
 * Load a form-capture plan from a YAML file. We support a tiny subset of
 * YAML (mappings, sequences, scalars, quoted strings, comments) sufficient
 * for the documented plan schema. If the parsed shape is invalid we throw
 * a descriptive error.
 */

import { existsSync, readFileSync } from 'node:fs';

import type { FormDefinition, FormPlan, FormScenario } from './types';

type YamlNode = string | YamlNode[] | { [key: string]: YamlNode };

type Line = {
  indent: number;
  text: string;
};

function tokenize(raw: string): Line[] {
  const lines: Line[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const stripped = rawLine.replace(/\s+#.*$/, '').replace(/^#.*$/, '');
    if (stripped.trim().length === 0) continue;
    const indent = stripped.length - stripped.trimStart().length;
    lines.push({ indent, text: stripped.trimEnd() });
  }
  return lines;
}

function unquoteScalar(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseBlock(lines: Line[], startIdx: number, baseIndent: number): { node: YamlNode; nextIdx: number } {
  // Empty container.
  if (startIdx >= lines.length || lines[startIdx].indent < baseIndent) {
    return { node: {}, nextIdx: startIdx };
  }

  const firstText = lines[startIdx].text.trimStart();
  const isSequence = firstText.startsWith('- ') || firstText === '-';

  if (isSequence) {
    const arr: YamlNode[] = [];
    let idx = startIdx;
    while (idx < lines.length) {
      const line = lines[idx];
      if (line.indent < baseIndent) break;
      const t = line.text.trimStart();
      if (!t.startsWith('-')) break;
      const after = t.slice(1).trimStart();
      idx++;
      if (after.length === 0) {
        // Block-style sequence item: next lines (deeper indent) form the mapping.
        const childIndent = lines[idx]?.indent ?? baseIndent + 2;
        const { node, nextIdx } = parseBlock(lines, idx, childIndent);
        arr.push(node);
        idx = nextIdx;
      } else if (after.includes(':') && !after.startsWith('"') && !after.startsWith("'")) {
        // Inline first key of a mapping item, e.g. "- name: login".
        const inlineKeyLine: Line = { indent: line.indent + 2, text: ' '.repeat(line.indent + 2) + after };
        const synthetic = [inlineKeyLine, ...lines.slice(idx)];
        const { node, nextIdx } = parseBlock(synthetic, 0, line.indent + 2);
        arr.push(node);
        idx = idx + (nextIdx - 1);
      } else {
        arr.push(unquoteScalar(after));
      }
    }
    return { node: arr, nextIdx: idx };
  }

  // Mapping.
  const obj: Record<string, YamlNode> = {};
  let idx = startIdx;
  while (idx < lines.length) {
    const line = lines[idx];
    if (line.indent < baseIndent) break;
    if (line.indent > baseIndent) {
      throw new Error(`Unexpected indent at line "${line.text}"`);
    }
    const colonIdx = line.text.indexOf(':');
    if (colonIdx === -1) throw new Error(`Expected mapping key at "${line.text}"`);
    const key = line.text.slice(0, colonIdx).trim();
    const valueRaw = line.text.slice(colonIdx + 1).trim();
    idx++;
    if (valueRaw.length === 0) {
      // Value is on subsequent indented lines (mapping or sequence) — or empty.
      if (idx < lines.length && lines[idx].indent > baseIndent) {
        const { node, nextIdx } = parseBlock(lines, idx, lines[idx].indent);
        obj[key] = node;
        idx = nextIdx;
      } else {
        obj[key] = '';
      }
    } else if (valueRaw === '{}') {
      obj[key] = {};
    } else if (valueRaw === '[]') {
      obj[key] = [];
    } else {
      obj[key] = unquoteScalar(valueRaw);
    }
  }
  return { node: obj, nextIdx: idx };
}

export function parseYaml(raw: string): YamlNode {
  const lines = tokenize(raw);
  if (lines.length === 0) return {};
  const baseIndent = lines[0].indent;
  return parseBlock(lines, 0, baseIndent).node;
}

function asString(value: YamlNode, label: string): string {
  if (typeof value !== 'string') throw new Error(`Expected string for ${label}`);
  return value;
}

function asRecordOfStrings(value: YamlNode, label: string): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Expected mapping for ${label}`);
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = asString(v, `${label}.${k}`);
  }
  return out;
}

function validatePlan(node: YamlNode): FormPlan {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    throw new Error('Plan root must be a mapping with a `forms` key.');
  }
  const formsRaw = (node as Record<string, YamlNode>).forms;
  if (formsRaw === undefined || formsRaw === '') return { forms: [] };
  if (!Array.isArray(formsRaw)) throw new Error('`forms` must be a sequence.');

  const forms: FormDefinition[] = [];
  formsRaw.forEach((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error(`forms[${i}] must be a mapping`);
    }
    const m = item as Record<string, YamlNode>;
    const scenariosRaw = m.scenarios;
    let scenarios: FormScenario[] = [];
    if (Array.isArray(scenariosRaw)) {
      scenarios = scenariosRaw.map((s, j) => {
        if (typeof s !== 'object' || s === null || Array.isArray(s)) {
          throw new Error(`forms[${i}].scenarios[${j}] must be a mapping`);
        }
        const sm = s as Record<string, YamlNode>;
        const name = asString(sm.name, `forms[${i}].scenarios[${j}].name`);
        const inputs =
          sm.inputs === undefined || sm.inputs === ''
            ? {}
            : asRecordOfStrings(sm.inputs, `forms[${i}].scenarios[${j}].inputs`);
        return { name, inputs };
      });
    }
    forms.push({
      name: asString(m.name, `forms[${i}].name`),
      route: asString(m.route, `forms[${i}].route`),
      selector: asString(m.selector, `forms[${i}].selector`),
      submitTrigger: asString(m.submitTrigger, `forms[${i}].submitTrigger`),
      scenarios,
    });
  });

  return { forms };
}

export function loadFormPlan(path: string): FormPlan {
  if (!existsSync(path)) throw new Error(`Form plan not found: ${path}`);
  const raw = readFileSync(path, 'utf8');
  const node = parseYaml(raw);
  return validatePlan(node);
}
