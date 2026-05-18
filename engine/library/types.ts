/**
 * Library catalogue types.
 *
 * Mirrors dr-parity-library/apps/web/lib/types.ts exactly.
 * Keep these two files in sync. The frontend consumes meta.json + site.json
 * files emitted by this engine and treats them as CatalogueItem / Site shapes.
 */

export type Taxonomy = "site" | "section" | "component";

export const PROJECT_TYPES = [
  "website",
  "web-app",
  "landing-page",
  "e-commerce",
  "dashboard",
  "saas",
  "portfolio",
  "blog",
  "marketing-site",
  "microsite",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const COMPONENT_CATEGORIES = [
  "accordion",
  "alert",
  "avatar",
  "badge",
  "button",
  "calendar",
  "card",
  "carousel",
  "chat",
  "checkbox",
  "date-picker",
  "dialog",
  "dropdown",
  "empty-state",
  "file-tree",
  "footer",
  "form",
  "header",
  "hero",
  "input",
  "menu",
  "modal",
  "nav",
  "pagination",
  "popover",
  "progress",
  "radio",
  "select",
  "sidebar",
  "skeleton",
  "slider",
  "switch",
  "tabs",
  "table",
  "toast",
  "tooltip",
] as const;

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

export interface CatalogueItem {
  sku: string;
  taxonomy: Taxonomy;
  name: string;
  slug: string;
  category?: ComponentCategory;
  projectType?: ProjectType[];
  site?: string;
  page?: string;
  tags: string[];
  description?: string;
  thumbnail?: string;
  previewUrl?: string;
  // Page within the bundled dist that this section belongs to, e.g.
  // "index.html" or "about-us.html". The dashboard uses this to load the
  // parent page in an iframe for a live preview. Always relative to
  // <site>/dist/.
  parentPagePath?: string;
  sourcePath?: string;
  promptPath?: string;
  dependencies?: string[];
  cssDeps?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  name: string;
  domain: string;
  projectType: ProjectType[];
  pages: { slug: string; title: string }[];
  sections: string[];
  capturedAt: string;
  thumbnail?: string;
  // Bundled React build location relative to the site folder. Always "dist"
  // when present. Absence means the dashboard should fall back to thumbnails.
  distPath?: string;
  distSize?: number;
  distPagesCount?: number;
}

export interface Section extends CatalogueItem {
  taxonomy: "section";
  site: string;
  page: string;
}

export interface ComponentAtom extends CatalogueItem {
  taxonomy: "component";
  category: ComponentCategory;
}

export function isProjectType(value: string): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value);
}
