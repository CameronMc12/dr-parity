/**
 * Split a MainBody.tsx component into top-level JSX sub-sections.
 *
 * Strategy:
 *   1. Parse the file with @babel/parser (tsx plugin).
 *   2. Locate the default export function (or the first named export
 *      function whose name contains "MainBody").
 *   3. Find its return statement.
 *   4. Collect the top-level JSX children of the returned root element/fragment.
 *   5. For each meaningful child, emit a `SplitChild` with the JSX source slice
 *      and its position. Trivial children (whitespace, empty fragments, helper
 *      wrappers like <style />) are skipped.
 *
 * If parsing fails or no children are found, returns null so the caller can
 * fall back to treating MainBody as a single section.
 */
import { parse } from "@babel/parser";
import type {
  ArrowFunctionExpression,
  File,
  FunctionDeclaration,
  FunctionExpression,
  JSXElement,
  JSXFragment,
  Node,
  ReturnStatement,
} from "@babel/types";

export interface SplitChild {
  /** Zero-based ordinal of this child among meaningful children */
  index: number;
  /** Source code slice of this child (verbatim from input) */
  source: string;
  /** Start position in original source */
  start: number;
  /** End position in original source */
  end: number;
}

export interface SplitResult {
  children: SplitChild[];
  /** Reason for empty/null result, if any */
  reason?: string;
}

/**
 * Try to split MainBody source. Returns null on failure.
 */
export function splitMainBody(source: string): SplitResult | null {
  let ast: File;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
  } catch {
    return null;
  }

  const fn = findMainBodyFunction(ast);
  if (!fn) return { children: [], reason: "no-function" };

  const returned = findReturnedJsx(fn);
  if (!returned) return { children: [], reason: "no-return-jsx" };

  const topChildren = getTopChildren(returned);
  const meaningful = topChildren.filter(isMeaningfulChild);
  if (meaningful.length === 0) return { children: [], reason: "no-meaningful-children" };

  // If the returned root is a single wrapper that itself contains the real
  // children (the very common case: MainBody returns a single <div className="content-wrapper">
  // whose children are the actual sections), descend one more level.
  let effectiveChildren = meaningful;
  if (meaningful.length === 1 && meaningful[0].type === "JSXElement") {
    const deeper = unwrapToSections(meaningful[0]);
    if (deeper && deeper.length > 1) effectiveChildren = deeper;
  }

  const children: SplitChild[] = [];
  let idx = 0;
  for (const node of effectiveChildren) {
    if (node.start == null || node.end == null) continue;
    const slice = source.slice(node.start, node.end);
    if (slice.trim().length < 40) continue;
    children.push({
      index: idx,
      source: slice,
      start: node.start,
      end: node.end,
    });
    idx += 1;
  }

  if (children.length === 0) return { children: [], reason: "all-children-filtered" };
  return { children };
}

type FunctionLike = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression;

function findMainBodyFunction(ast: File): FunctionLike | null {
  for (const stmt of ast.program.body) {
    // export default function MainBody() {...}
    if (stmt.type === "ExportDefaultDeclaration") {
      const d = stmt.declaration;
      if (d.type === "FunctionDeclaration" || d.type === "FunctionExpression" || d.type === "ArrowFunctionExpression") {
        return d as FunctionLike;
      }
    }
    // export function MainBody() {...}
    if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
      const d = stmt.declaration;
      if (d.type === "FunctionDeclaration" && d.id?.name?.toLowerCase().includes("mainbody")) {
        return d;
      }
      if (d.type === "VariableDeclaration") {
        for (const decl of d.declarations) {
          if (
            decl.id.type === "Identifier" &&
            decl.id.name.toLowerCase().includes("mainbody") &&
            decl.init &&
            (decl.init.type === "ArrowFunctionExpression" || decl.init.type === "FunctionExpression")
          ) {
            return decl.init;
          }
        }
      }
    }
    // function MainBody() {...} (top-level, then exported later)
    if (stmt.type === "FunctionDeclaration" && stmt.id?.name?.toLowerCase().includes("mainbody")) {
      return stmt;
    }
  }
  return null;
}

function findReturnedJsx(fn: FunctionLike): JSXElement | JSXFragment | null {
  // Arrow function with expression body
  if (fn.type === "ArrowFunctionExpression" && fn.body.type !== "BlockStatement") {
    const expr = fn.body;
    if (expr.type === "JSXElement" || expr.type === "JSXFragment") return expr;
    return null;
  }

  // Block body: find the first ReturnStatement whose argument is JSX.
  const body = "body" in fn && fn.body && fn.body.type === "BlockStatement" ? fn.body.body : [];
  for (const stmt of body) {
    if (stmt.type === "ReturnStatement") {
      const ret = stmt as ReturnStatement;
      const arg = ret.argument;
      if (arg && (arg.type === "JSXElement" || arg.type === "JSXFragment")) return arg;
      // Parenthesised JSX is the same node type after parsing, so nothing else to do here.
    }
  }
  return null;
}

function getTopChildren(root: JSXElement | JSXFragment): Node[] {
  return root.children as unknown as Node[];
}

/**
 * Filter out trivial children: whitespace text, empty fragments, comments,
 * and standalone <style>/<script>/<link> elements that don't carry visible
 * content of their own.
 */
function isMeaningfulChild(node: Node): boolean {
  if (node.type === "JSXText") {
    return (node.value ?? "").trim().length > 0;
  }
  if (node.type === "JSXExpressionContainer") {
    // Things like {someVar}. Keep them since they could render content.
    return true;
  }
  if (node.type === "JSXFragment") {
    return (node.children ?? []).some(isMeaningfulChild);
  }
  if (node.type === "JSXElement") {
    const name = getElementName(node);
    if (!name) return false;
    if (name === "style" || name === "script" || name === "link" || name === "meta") {
      return false;
    }
    return true;
  }
  return false;
}

function getElementName(el: JSXElement): string | null {
  const open = el.openingElement.name;
  if (open.type === "JSXIdentifier") return open.name;
  if (open.type === "JSXMemberExpression") {
    // e.g. Foo.Bar -> "Foo.Bar"
    return getMemberName(open);
  }
  return null;
}

function getMemberName(m: import("@babel/types").JSXMemberExpression): string {
  const obj = m.object.type === "JSXMemberExpression" ? getMemberName(m.object) : m.object.name;
  return `${obj}.${m.property.name}`;
}

/**
 * If the returned root is a single wrapper that itself wraps the real
 * sections, return its meaningful children. Otherwise null.
 *
 * Vivre's MainBody pattern:
 *   <div className="content-wrapper container-full">
 *     <div className="entry-content link-style container-child">
 *       <section> ... </section>
 *       <section> ... </section>
 *       ...
 *     </div>
 *   </div>
 *
 * So we recurse up to 3 levels while we keep seeing a single element child.
 */
function unwrapToSections(el: JSXElement, depth = 0): Node[] | null {
  if (depth > 4) return null;
  const meaningful = (el.children as unknown as Node[]).filter(isMeaningfulChild);
  if (meaningful.length === 0) return null;
  if (meaningful.length === 1 && meaningful[0].type === "JSXElement") {
    return unwrapToSections(meaningful[0] as JSXElement, depth + 1) ?? meaningful;
  }
  return meaningful;
}
