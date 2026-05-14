export interface PrettifyResult {
  output: string;
  ok: boolean;
  error?: string;
}

interface PrettierLike {
  format: (
    source: string,
    options: { parser: string; plugins?: string[] },
  ) => Promise<string> | string;
}

let cachedPrettier: PrettierLike | null = null;
let prettierLoadFailed = false;

async function loadPrettier(): Promise<PrettierLike | null> {
  if (cachedPrettier) return cachedPrettier;
  if (prettierLoadFailed) return null;
  try {
    const mod: unknown = await import(/* @vite-ignore */ 'prettier' as string);
    const candidate = mod as { default?: PrettierLike } & PrettierLike;
    cachedPrettier = (candidate.default ?? candidate) as PrettierLike;
    return cachedPrettier;
  } catch {
    prettierLoadFailed = true;
    return null;
  }
}

export async function prettifyAstro(source: string): Promise<PrettifyResult> {
  const prettier = await loadPrettier();
  if (!prettier) {
    return {
      output: source,
      ok: false,
      error: 'prettier or prettier-plugin-astro not installed',
    };
  }
  try {
    const formatted = await prettier.format(source, {
      parser: 'astro',
      plugins: ['prettier-plugin-astro'],
    });
    return { output: formatted, ok: true };
  } catch (err) {
    return {
      output: source,
      ok: false,
      error: (err as Error).message,
    };
  }
}
