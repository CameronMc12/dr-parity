import type {
  Node,
  ObjectExpression,
  ArrayExpression,
  Expression,
  SpreadElement,
  PrivateName,
} from '@babel/types';
import type { AnimationArg, UneditableReason } from './types';

export interface ClassifiedArg extends AnimationArg {
  uneditableReason?: UneditableReason;
}

export function classifyArgument(node: Node | null | undefined, code: string): ClassifiedArg {
  if (!node) {
    return { kind: 'opaque', value: null, rawText: '' };
  }
  const rawText = sliceNode(node, code);
  const literal = tryExtractLiteral(node);
  if (literal.ok) {
    return { kind: 'literal', value: literal.value, rawText };
  }
  return {
    kind: 'opaque',
    value: null,
    rawText,
    uneditableReason: literal.reason,
  };
}

interface LiteralOk {
  ok: true;
  value: unknown;
}
interface LiteralFail {
  ok: false;
  reason: UneditableReason;
}
type LiteralResult = LiteralOk | LiteralFail;

function tryExtractLiteral(node: Node): LiteralResult {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return { ok: true, value: node.value };
    case 'NullLiteral':
      return { ok: true, value: null };
    case 'UnaryExpression': {
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') {
        return { ok: true, value: -node.argument.value };
      }
      if (node.operator === '+' && node.argument.type === 'NumericLiteral') {
        return { ok: true, value: node.argument.value };
      }
      return { ok: false, reason: 'runtime-variable' };
    }
    case 'TemplateLiteral': {
      if (node.expressions.length === 0 && node.quasis.length === 1) {
        return { ok: true, value: node.quasis[0].value.cooked ?? node.quasis[0].value.raw };
      }
      return { ok: false, reason: 'runtime-variable' };
    }
    case 'ArrayExpression':
      return tryExtractArray(node);
    case 'ObjectExpression':
      return tryExtractObject(node);
    case 'Identifier':
    case 'MemberExpression':
      return { ok: false, reason: 'runtime-variable' };
    case 'CallExpression':
    case 'NewExpression':
      return { ok: false, reason: 'opaque-callback' };
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return { ok: false, reason: 'opaque-callback' };
    case 'SpreadElement':
      return { ok: false, reason: 'spread-argument' };
    default:
      return { ok: false, reason: 'runtime-variable' };
  }
}

function tryExtractArray(node: ArrayExpression): LiteralResult {
  const out: unknown[] = [];
  for (const el of node.elements) {
    if (el === null) {
      out.push(null);
      continue;
    }
    if (el.type === 'SpreadElement') {
      return { ok: false, reason: 'spread-argument' };
    }
    const r = tryExtractLiteral(el);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return { ok: true, value: out };
}

function tryExtractObject(node: ObjectExpression): LiteralResult {
  const out: Record<string, unknown> = {};
  for (const prop of node.properties) {
    if (prop.type === 'SpreadElement') {
      return { ok: false, reason: 'spread-argument' };
    }
    if (prop.type === 'ObjectMethod') {
      return { ok: false, reason: 'opaque-callback' };
    }
    if (prop.type !== 'ObjectProperty') {
      return { ok: false, reason: 'runtime-variable' };
    }
    if (prop.computed) {
      return { ok: false, reason: 'computed-member' };
    }
    const key = keyName(prop.key);
    if (key === null) {
      return { ok: false, reason: 'computed-member' };
    }
    const valNode = prop.value;
    if (
      valNode.type === 'AssignmentPattern' ||
      valNode.type === 'RestElement' ||
      valNode.type === 'ArrayPattern' ||
      valNode.type === 'ObjectPattern'
    ) {
      return { ok: false, reason: 'runtime-variable' };
    }
    const r = tryExtractLiteral(valNode as Expression);
    if (!r.ok) return r;
    out[key] = r.value;
  }
  return { ok: true, value: out };
}

function keyName(key: Expression | PrivateName): string | null {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  if (key.type === 'NumericLiteral') return String(key.value);
  return null;
}

export function sliceNode(node: Node, code: string): string {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') return '';
  const raw = code.slice(node.start, node.end);
  return raw.length > 800 ? raw.slice(0, 800) + '…' : raw;
}

export function isLiteralArg(arg: AnimationArg): boolean {
  return arg.kind === 'literal';
}

export function allLiteral(args: AnimationArg[]): boolean {
  if (args.length === 0) return false;
  return args.every(isLiteralArg);
}

export type AnyArg = Expression | SpreadElement;
