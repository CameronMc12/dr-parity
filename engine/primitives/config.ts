import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PrimitiveConfig } from './types';

export class ConfigError extends Error {}

const DEFAULT_CONFIG_SOURCE = `export type PrimitiveConfig = {
  primitives: {
    [name: string]: {
      tag: string;
      matchClasses?: string[];
      matchTags?: string[];
      variants?: Record<string, string>;
      sizes?: Record<string, string>;
      passThroughClasses?: boolean;
    };
  };
};

export const config: PrimitiveConfig = {
  primitives: {
    Container: { tag: 'div', matchClasses: ['wrp', 'container'] },
    Button: {
      tag: 'button',
      matchClasses: ['button'],
      variants: { ghost: 'button--ghost', white: 'button--white' },
    },
    Heading: {
      tag: 'h2',
      matchClasses: ['title'],
      sizes: {
        xl: 'title--xl',
        l: 'title--l',
        m: 'title--m',
        s: 'title--s',
      },
    },
    Text: {
      tag: 'p',
      matchClasses: ['text'],
      sizes: {
        xl: 'text--xl',
        l: 'text--l',
        m: 'text--m',
        s: 'text--s',
      },
    },
    Link: { tag: 'a', matchTags: ['a-link'] },
    Icon: { tag: 'span', matchClasses: ['icon'] },
    Section: { tag: 'section', matchTags: ['section'] },
    Grid: { tag: 'div', matchClasses: ['grid__layout'] },
  },
};
`;

export function defaultConfig(): PrimitiveConfig {
  return {
    primitives: {
      Container: { tag: 'div', matchClasses: ['wrp', 'container'] },
      Button: {
        tag: 'button',
        matchClasses: ['button'],
        variants: { ghost: 'button--ghost', white: 'button--white' },
      },
      Heading: {
        tag: 'h2',
        matchClasses: ['title'],
        sizes: {
          xl: 'title--xl',
          l: 'title--l',
          m: 'title--m',
          s: 'title--s',
        },
      },
      Text: {
        tag: 'p',
        matchClasses: ['text'],
        sizes: {
          xl: 'text--xl',
          l: 'text--l',
          m: 'text--m',
          s: 'text--s',
        },
      },
      Link: { tag: 'a', matchTags: ['a-link'] },
      Icon: { tag: 'span', matchClasses: ['icon'] },
      Section: { tag: 'section', matchTags: ['section'] },
      Grid: { tag: 'div', matchClasses: ['grid__layout'] },
    },
  };
}

export function writeDefaultConfig(configPath: string): void {
  const abs = isAbsolute(configPath) ? configPath : resolve(configPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, DEFAULT_CONFIG_SOURCE, 'utf8');
}

export async function loadConfig(
  configPath: string,
): Promise<{ config: PrimitiveConfig; createdDefault: boolean }> {
  const abs = isAbsolute(configPath) ? configPath : resolve(configPath);

  if (!existsSync(abs)) {
    writeDefaultConfig(abs);
    return { config: defaultConfig(), createdDefault: true };
  }

  if (abs.endsWith('.json')) {
    const raw = readFileSync(abs, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new ConfigError(
        `Failed to parse JSON config at ${abs}: ${(err as Error).message}`,
      );
    }
    return { config: parsed as PrimitiveConfig, createdDefault: false };
  }

  if (abs.endsWith('.ts') || abs.endsWith('.mts') || abs.endsWith('.mjs') || abs.endsWith('.js')) {
    const url = pathToFileURL(abs).href;
    let mod: Record<string, unknown>;
    try {
      mod = (await import(url)) as Record<string, unknown>;
    } catch (err) {
      throw new ConfigError(
        `Failed to import config at ${abs}: ${(err as Error).message}`,
      );
    }
    const exported = (mod.config ?? mod.default) as PrimitiveConfig | undefined;
    if (!exported) {
      throw new ConfigError(
        `Config at ${abs} must export \`config\` or default export of type PrimitiveConfig.`,
      );
    }
    return { config: exported, createdDefault: false };
  }

  throw new ConfigError(
    `Unsupported config file extension at ${abs}. Use .ts, .mts, .mjs, .js, or .json.`,
  );
}
