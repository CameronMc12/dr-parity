export interface RouteSpec {
  id: string;
  path: string;
  settleMs: number;
  pixelThreshold: number;
  domThreshold: number;
}

export interface RouteResult {
  route: string;
  pixel: number | null;
  dom: number | null;
  functional: 'pass' | 'fail' | 'skip';
  verdict: 'pass' | 'fail' | 'oracle-only';
  reactUnreachable: boolean;
  oracleScreenshot: string | null;
  reactScreenshot: string | null;
  diffScreenshot: string | null;
  error?: string;
}

export interface Scoreboard {
  runId: string;
  oracle: string;
  react: string;
  results: RouteResult[];
  aggregate: {
    pixel_mean: number | null;
    dom_mean: number | null;
    pass_rate: number;
  };
}

export interface ShellRouteResult {
  route: string;
  pixel: number | null;
  dom: number | null;
  verdict: 'pass' | 'fail' | 'oracle-only';
  reactUnreachable: boolean;
  oracleMaskedScreenshot: string | null;
  reactMaskedScreenshot: string | null;
  diffScreenshot: string | null;
  error?: string;
}

export interface ShellScoreboard {
  runId: string;
  mode: 'shell-only';
  oracle: string;
  react: string;
  shellPixelThreshold: number;
  shellDomThreshold: number;
  results: ShellRouteResult[];
  aggregate: {
    pixel_mean: number | null;
    dom_mean: number | null;
    pass_rate: number;
  };
}

export interface DomStats {
  totalNodes: number;
  nodesByTag: Record<string, number>;
  nodesByClass: Record<string, number>;
  treeDepth: number;
}
