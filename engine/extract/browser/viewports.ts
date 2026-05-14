export const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2 },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1 },
  { name: 'wide', width: 1920, height: 1080, deviceScaleFactor: 1 },
] as const;

export type Viewport = (typeof VIEWPORTS)[number];
export type ViewportName = Viewport['name'];

export function getViewport(name: string): Viewport | undefined {
  return VIEWPORTS.find((v) => v.name === name);
}

export function isViewportName(name: string): name is ViewportName {
  return VIEWPORTS.some((v) => v.name === name);
}
