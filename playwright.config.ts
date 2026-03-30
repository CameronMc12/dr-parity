import type { LaunchOptions } from "playwright";

const config: { use: LaunchOptions & { viewport: { width: number; height: number }; screenshot: string } } = {
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "off",
  },
};

export default config;
