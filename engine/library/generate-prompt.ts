/**
 * Generate the markdown prompt template for a section.
 *
 * Cameron's writing rule: NO hyphens or em-dashes in client-facing copy.
 * Reorganise sentences instead. Prompts are technically user-facing so we
 * follow the rule. Code fences and lists are exempt (technical content).
 */

import type { ProjectType } from "./types";

export interface PromptInput {
  name: string;
  siteName: string;
  domain: string;
  pageSlug: string;
  capturedAt: string;
  projectTypes: ProjectType[];
  source: string;
  dependencies: string[];
  cssDeps: string[];
}

export function generatePromptMarkdown(input: PromptInput): string {
  const datePart = input.capturedAt.slice(0, 10);
  const projectTypesLine =
    input.projectTypes.length > 0
      ? input.projectTypes.join(", ")
      : "general";

  const depsList =
    input.dependencies.length > 0
      ? input.dependencies.map((d) => `- ${d}`).join("\n")
      : "- (none beyond React)";

  const cssBlock =
    input.cssDeps.length > 0
      ? input.cssDeps.map((d) => `- ${d}`).join("\n")
      : "Self contained. Inline styles and JSX only.";

  return [
    `# ${input.name}`,
    "",
    `Pulled from ${input.siteName} (${input.domain}) on ${datePart}. Page: ${input.pageSlug}.`,
    "",
    "## Use this section",
    "",
    "Copy the source below into your React project. Dependencies listed underneath.",
    "",
    `Project type fit: ${projectTypesLine}`,
    "",
    "## Source",
    "",
    "```tsx",
    input.source.trimEnd(),
    "```",
    "",
    "## Dependencies",
    "",
    depsList,
    "",
    "## CSS",
    "",
    cssBlock,
    "",
    "## Notes",
    "",
    "- Captured from a production site. Animations may require gsap or aoslight if the original used them.",
    "- May reference global CSS variables like `--brand-*` or `--section-*` which need to be defined in your project.",
    "",
  ].join("\n");
}
