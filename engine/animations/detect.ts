import traverseDefault from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type {
  CallExpression,
  NewExpression,
  Expression,
  V8IntrinsicIdentifier,
  Node,
} from '@babel/types';
import type {
  AnimationCall,
  AnimationLibrary,
  PluginRegistration,
  UneditableEntry,
} from './types';
import { allLiteral, classifyArgument, sliceNode } from './classify';

const traverse =
  (traverseDefault as unknown as { default?: typeof traverseDefault }).default ?? traverseDefault;

const GSAP_METHODS = new Set([
  'to',
  'from',
  'fromTo',
  'set',
  'timeline',
  'add',
  'call',
  'delayedCall',
]);

const SCROLLTRIGGER_METHODS = new Set(['create', 'matchMedia']);

const PLUGIN_NAMES = new Set([
  'CustomEase',
  'SplitText',
  'ScrollTrigger',
  'ScrollSmoother',
  'MotionPathPlugin',
  'DrawSVGPlugin',
  'Flip',
]);

export interface DetectInput {
  file: string;
  relativeFile: string;
  code: string;
  ast: Node;
}

export interface DetectOutput {
  calls: AnimationCall[];
  uneditable: UneditableEntry[];
  plugins: PluginRegistration[];
}

export function detectAnimations(input: DetectInput): DetectOutput {
  const calls: AnimationCall[] = [];
  const uneditable: UneditableEntry[] = [];
  const plugins: PluginRegistration[] = [];

  traverse(input.ast, {
    CallExpression(path) {
      handleCallExpression(path, input, calls, uneditable, plugins);
    },
    NewExpression(path) {
      handleNewExpression(path, input, calls, uneditable);
    },
  });

  return { calls, uneditable, plugins };
}

function handleCallExpression(
  path: NodePath<CallExpression>,
  input: DetectInput,
  calls: AnimationCall[],
  uneditable: UneditableEntry[],
  plugins: PluginRegistration[],
): void {
  detectGsapRegisterPlugin(path, input, plugins);

  const callee = path.node.callee;
  const info = identifyCallee(callee);
  if (!info) return;

  if (info.library === 'gsap' && !GSAP_METHODS.has(info.method)) {
    return;
  }
  if (info.library === 'scrolltrigger' && !SCROLLTRIGGER_METHODS.has(info.method)) {
    return;
  }

  const line = path.node.loc?.start.line ?? 0;
  const args = path.node.arguments.map((a) =>
    classifyArgument(a as Expression | null, input.code),
  );
  const editable = allLiteral(args);

  const call: AnimationCall = {
    library: info.library,
    method: info.method,
    source: { file: input.relativeFile, line },
    args,
    editable,
  };
  calls.push(call);

  if (!editable) {
    const first = args.find((a) => a.kind === 'opaque');
    uneditable.push({
      library: info.library,
      method: info.method,
      source: { file: input.relativeFile, line },
      rawText: sliceNode(path.node, input.code),
      reason: classifyReason(args, first),
    });
  }
}

function handleNewExpression(
  path: NodePath<NewExpression>,
  input: DetectInput,
  calls: AnimationCall[],
  uneditable: UneditableEntry[],
): void {
  const callee = path.node.callee;
  if (callee.type !== 'Identifier') return;

  let library: AnimationLibrary | null = null;
  let method = 'constructor';

  if (callee.name === 'Lenis') {
    library = 'lenis';
    method = 'new Lenis';
  } else if (callee.name === 'IntersectionObserver') {
    library = 'intersection-observer';
    method = 'new IntersectionObserver';
  } else {
    return;
  }

  const line = path.node.loc?.start.line ?? 0;
  const args = path.node.arguments.map((a) =>
    classifyArgument(a as Expression | null, input.code),
  );

  const editable = isNewExpressionEditable(library, args);

  const call: AnimationCall = {
    library,
    method,
    source: { file: input.relativeFile, line },
    args,
    editable,
  };
  calls.push(call);

  if (!editable) {
    const first = args.find((a) => a.kind === 'opaque');
    uneditable.push({
      library,
      method,
      source: { file: input.relativeFile, line },
      rawText: sliceNode(path.node, input.code),
      reason: classifyReason(args, first),
    });
  }
}

function isNewExpressionEditable(
  library: AnimationLibrary,
  args: ReturnType<typeof classifyArgument>[],
): boolean {
  if (library === 'lenis') {
    if (args.length === 0) return true;
    if (args.length === 1) return args[0].kind === 'literal';
    return false;
  }
  if (library === 'intersection-observer') {
    if (args.length < 2) return false;
    return args[1].kind === 'literal';
  }
  return allLiteral(args);
}

interface CalleeInfo {
  library: AnimationLibrary;
  method: string;
}

function identifyCallee(callee: CallExpression['callee']): CalleeInfo | null {
  if (callee.type === 'MemberExpression') {
    if (callee.computed) return null;
    const prop = callee.property;
    if (prop.type !== 'Identifier') return null;
    const method = prop.name;
    const obj = callee.object;

    if (obj.type === 'Identifier') {
      if (obj.name === 'gsap') return { library: 'gsap', method };
      if (obj.name === 'ScrollTrigger') return { library: 'scrolltrigger', method };
      return null;
    }
    if (isGsapTimelineChain(obj)) {
      return { library: 'gsap', method };
    }
    return null;
  }
  return null;
}

function isGsapTimelineChain(expr: Expression | V8IntrinsicIdentifier): boolean {
  let current: Node | null = expr;
  let depth = 0;
  while (current && depth < 12) {
    depth += 1;
    if (current.type === 'CallExpression') {
      const callee: Node = current.callee;
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const obj: Node = callee.object;
        const prop: Node = callee.property;
        if (
          obj.type === 'Identifier' &&
          obj.name === 'gsap' &&
          prop.type === 'Identifier' &&
          prop.name === 'timeline'
        ) {
          return true;
        }
        current = obj;
        continue;
      }
      return false;
    }
    if (current.type === 'MemberExpression') {
      current = current.object as Node;
      continue;
    }
    return false;
  }
  return false;
}

function detectGsapRegisterPlugin(
  path: NodePath<CallExpression>,
  input: DetectInput,
  plugins: PluginRegistration[],
): void {
  const callee = path.node.callee;
  if (callee.type !== 'MemberExpression' || callee.computed) return;
  if (callee.property.type !== 'Identifier' || callee.property.name !== 'registerPlugin') return;
  const obj = callee.object;
  if (obj.type !== 'Identifier' || obj.name !== 'gsap') return;

  const line = path.node.loc?.start.line ?? 0;
  for (const arg of path.node.arguments) {
    if (arg.type === 'Identifier' && PLUGIN_NAMES.has(arg.name)) {
      plugins.push({ name: arg.name, file: input.relativeFile, line });
    }
  }
}

function classifyReason(
  args: ReturnType<typeof classifyArgument>[],
  first: ReturnType<typeof classifyArgument> | undefined,
): UneditableEntry['reason'] {
  if (args.length === 0) return 'no-config-object';
  const reason = (first as { uneditableReason?: UneditableEntry['reason'] } | undefined)
    ?.uneditableReason;
  if (reason) return reason;
  const hasLiteral = args.some((a) => a.kind === 'literal');
  const hasOpaque = args.some((a) => a.kind === 'opaque');
  if (hasLiteral && hasOpaque) return 'mixed-args';
  return 'runtime-variable';
}
