# Section Naming Rules

Canonical specification for how `extract-library` derives the human-readable
name of every section in the catalogue. Future extractors must follow this
algorithm verbatim. Implementation: `derive-name.ts`.

## Goals

1. Names describe the section's purpose ("Why we built this", "Hero Video",
   "Footer"). Never name a section after its file scaffolding (e.g. "Main
   Body", "Body Preamble" are forbidden).
2. Determinism: the same JSX source must always yield the same name.
3. Brevity: names are 1 to 8 words. Truncated with an ellipsis past 50 chars.

## Excluded files

The following component files are skipped entirely (never emitted as
sections):

- `BodyPreamble.tsx` — slicer scaffolding (tracking scripts, hidden noscript
  content). Never a real section.
- Empty or trivial components whose source is under 200 characters.

`MainBody.tsx` is split rather than emitted as a single section. See
`split-mainbody.ts`.

## Algorithm

For each section the role is one of `header | footer | main | shared`.

1. **Special roles short-circuit.**
   - `header` -> `"Header"`
   - `footer` -> `"Footer"`

2. **Try the first heading.** Find the first `<h1>` through `<h6>` in the JSX
   source. Strip nested tags, JSX expressions, and HTML entities. If the
   resulting text is non-empty, title-case it (only when fully lower or fully
   upper) and use it. Truncate to 50 chars with an ellipsis.

3. **Detect content patterns** if no heading is present. Patterns are matched
   against the JSX source:
   - `video` if `<video` is present
   - `hero` if class names like `hero-section`, `hero-heading`, `hero-content`
     are present
   - `marquee` for `marquee` or `scroll-text`
   - `form` for `<form`
   - `swiper` for `swiper` or `slider`
   - `testimonial` for `testimonial`, `review`, or `<blockquote`
   - `cta` for `cta`, `call to action`, `book now`, `get started`, `sign up`
   - `grid` for `grid`, `gridItem`, `columnsItem`

4. **Compose by priority.**
   - `video` + `hero` -> `"Hero Video"`
   - `hero` -> `"Hero"`
   - `video` -> `"Video Section"`
   - `marquee` -> `"Marquee Strip"`
   - `form` -> `"Form Section"`
   - `swiper` -> `"Carousel"`
   - `testimonial` -> `"Testimonial"`
   - `cta` -> `"Call to Action"`
   - `grid` -> `"Grid Section"`

5. **Fallback.** If nothing matches, name is `"Section"`.

6. **Disambiguation.** If two sections on the same page produce the same
   name, the second and subsequent get `(2)`, `(3)`, etc. appended. The first
   instance keeps the bare name.

## Tag derivation

Every section also gets a tag list, derived from the same pattern signals:
`video`, `image`, `form`, `carousel`, `marquee`, `hero`, `testimonial`,
`cta`, `grid`, `nav`, `header`, `footer`. Tags are alphabetised and
deduplicated.

## Examples

| Heading or signal | Derived name |
| --- | --- |
| `<h1>Our Story</h1>` | `Our Story` |
| `<h2>WHY WE BUILD</h2>` | `Why We Build` |
| no heading, has hero-section + video | `Hero Video` |
| no heading, has hero-section | `Hero` |
| no heading, just `<form>` | `Form Section` |
| no heading, swiper carousel | `Carousel` |
| no heading, scroll-text marquee | `Marquee Strip` |
| no heading, generic block | `Section` |
| second `Section` on page | `Section (2)` |

## Forbidden names

- `Body Preamble` (file is excluded)
- `Main Body` (file is split)
- file-derived camelCase like `MainBody`, `BodyPreamble` (never output)

## Style

- No em-dashes (`—`) or double-hyphens (`--`) in any derived name.
- Use plain hyphens only inside SKUs and tags (technical identifiers).
- Names are sentence- or title-case, not all-caps.
