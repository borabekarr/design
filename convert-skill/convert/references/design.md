# The look

Used when the Construct Design MCP isn't connected (with it, its `design_guide` comes first and
these rules still hold). The goal is a page that looks made by a good studio for this brand, not a
template, and not "made by AI".

## Keep the brand

- The logo, the colours, the typefaces and the tone stay. Take them from page.json (`colours`,
  `fonts`, `logo`) and the site's CSS variables. You may use them better (fewer colours, one accent,
  more contrast), never swap them for your taste.
- If the site has no real typeface (system fonts only), pick one serious grotesk from Google Fonts
  (Inter Tight, Geist, Manrope, Hanken Grotesk, Archivo) and keep it to two weights.

## Show the product

- Real product screenshots, photos or the real object, big, in the first screen. Downloaded from
  the site (page.json `images`, `backgroundImages`, `ogImage`) or the project's own assets.
- Show it working (a screen with data in it) rather than describing it. One picture per outcome.
- No stock people, no drawn illustrations standing in for the product, no 3D blobs, no generated
  "dashboard" mockups with fake data.

## Hierarchy

- One idea per section; one headline per section, 2–8 words when possible.
- Type scale with real contrast: hero 56–88 px desktop / 38–48 px phone, tight leading (1.0–1.1),
  slightly negative tracking; section heads 36–52 px; body 17–19 px at 1.5; labels small.
- Generous space: 120–160 px between sections on desktop, 72–96 on phone. Content width ~1120–1200.
- One primary button style, used for one action. A secondary button is quieter (outline or text).
- Left-aligned text reads better than centred for anything over two lines.

## Taste, not slop

Avoid what makes a page look generated:
- Purple/blue gradients, glowing orbs, gradient text, "aurora" backgrounds (unless they are the
  brand's own).
- A serif-italic hero line over beige paper ("considered" template look), pastel card grids,
  three-icon feature rows with emoji or generic line icons.
- Every section a card with a shadow. Badges above every headline ("✨ New"). Fake browser chrome
  around everything. Testimonial carousels. Counters that animate up.
- Centred everything, everything the same size, everything the same grey.

Do instead: one strong ground colour per section, the product large, a few words big, real
alignment to a grid, real photos/screens, a little motion at most (fade/rise on enter, respect
reduced motion).

## Phone first

- Check every section at 390 px: the headline wraps well (no single-word lines), the button is full
  width or clearly tappable (≥ 44 px), pictures are cropped to what matters, nothing overflows
  sideways.
- The first phone screen holds the headline, the sub and the button.

## Build

- Standalone: one `index.html`, CSS in a `<style>`, no frameworks, no build step; images from
  `assets/` with `width`/`height` set and `loading="lazy"` below the fold; semantic sections, one
  `h1`, alt text on every picture (from the old page's alt when it exists).
- In the project: the project's own components, styles and conventions (Tailwind stays Tailwind,
  CSS modules stay CSS modules). Don't add a dependency for looks.
- Placeholders: `[PROOF NEEDED: …]` in a dashed box in the brand's muted colour, impossible to
  mistake for real proof.
