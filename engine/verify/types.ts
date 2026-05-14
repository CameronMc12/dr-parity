export interface Viewport {
  name: string;
  width: number;
  height: number;
  dsf: number;
}

export const VIEWPORTS: readonly Viewport[] = [
  { name: 'mobile', width: 375, height: 812, dsf: 2 },
  { name: 'tablet', width: 768, height: 1024, dsf: 2 },
  { name: 'desktop', width: 1280, height: 800, dsf: 1 },
  { name: 'wide', width: 1920, height: 1080, dsf: 1 },
] as const;

export const VIEWPORT_NAMES = VIEWPORTS.map((v) => v.name);

export interface ViewportResult {
  name: string;
  width: number;
  height: number;
  dsf: number;
  cloneShot: string;
  rebuiltShot: string;
  diffShot: string;
  mismatchedPixels: number;
  totalPixels: number;
  diffRatio: number;
  pass: boolean;
}

export interface ParityReport {
  clone: string;
  rebuilt: string;
  thresholdRatio: number;
  viewports: ViewportResult[];
  overallPass: boolean;
  durationMs: number;
}

export interface VerifyConfig {
  cloneDir: string;
  rebuiltDir: string;
  outDir: string;
  thresholdRatio: number;
  viewports: Viewport[];
}

export interface ServerHandle {
  port: number;
  url: string;
  pid: number;
  kill: () => void;
}
