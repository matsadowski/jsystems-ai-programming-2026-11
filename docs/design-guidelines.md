# Design Guidelines — Alior Bank reference

Design system extracted from <https://www.aliorbank.pl/> on 2026-11-25 with the
`create-design-system` skill (Playwright CLI, headed Chrome, desktop viewport ≈1025 px).
Values are computed styles of **visible** elements; hidden skip links and dismissed
banners were excluded. Machine-readable tokens: [`assets/design-tokens.json`](../assets/design-tokens.json).

> ⚠️ **Brand and licence notice.** The logo is a registered trademark of Alior Bank SA.
> Use these assets only as an internal course reference; do not publish an app that
> could be mistaken for an official Alior Bank product.

## Assets

| File | Description |
|---|---|
| [`assets/homepage.png`](../assets/homepage.png) | Full-page homepage screenshot (1025×6386, no overlays) — visual reference for QA |
| [`assets/logo.png`](../assets/logo.png) | Official logo, PNG 324×168 (Mercury head + "ALIOR BANK" wordmark) |
| [`assets/favicon.ico`](../assets/favicon.ico) | Favicon, 32×32 ICO |
| [`assets/fonts/nunito-sans/NunitoSans-VariableFont.woff2`](../assets/fonts/nunito-sans/NunitoSans-VariableFont.woff2) | Nunito Sans variable font, normal (weights 200–1000) |
| [`assets/fonts/nunito-sans/NunitoSans-Italic-VariableFont.woff2`](../assets/fonts/nunito-sans/NunitoSans-Italic-VariableFont.woff2) | Nunito Sans variable font, italic |
| [`assets/design-tokens.json`](../assets/design-tokens.json) | Structured design tokens |

## Colors

### Brand

| Token | Hex | Usage |
|---|---|---|
| `brand.primary` | `#79003C` | Primary buttons, outline-button border/text, brand headings, links |
| `brand.primaryDark` | `#470023` | Footer background, large dark brand areas |
| `brand.primaryBright` | `#A30051` | Secondary brand text, hover/accent shade |
| `brand.accent` | `#FFC426` | "POLECAMY" tag, highlight badges, promo numbers (gold from the logo) |
| `brand.accentText` | `#FFC326` | Accent text on dark backgrounds |

### Tints and surfaces

| Token | Hex | Usage |
|---|---|---|
| `background.default` | `#FFFFFF` | Cards, inputs, main surfaces |
| `background.light` | `#F7F7F8` | Page background, sticky header |
| `tint.pink` | `#FFE5F2` | "PROMOCJA" tag, soft brand borders |
| `tint.pinkSubtle` | `#FBF3F7` | Subtle brand-tinted sections |
| `background.overlay` | `rgba(0,0,0,0.5)` | Image/modal overlays |
| `background.glassOnImage` | `rgba(255,255,255,0.4)` | Translucent controls on photos (slider) |

### Text and borders

| Token | Hex | Usage |
|---|---|---|
| `text.primary` | `#000000` | Headings and body copy |
| `text.secondary` | `#383842` | Secondary copy |
| `text.muted` | `#5E5E6E` | Captions, legal notes ("nota prawna"), dates |
| `text.onDark` | `#FFFFFF` | Text on primary/footer backgrounds |
| `border.default` | `#DEDEE3` | Dividers, slider tracks, neutral borders |
| `border.neutralStrong` | `#868698` | Stronger neutral elements |

Error and success colors were **not observed** on the homepage. Agree them with the
team before building forms (suggestion: derive from accessible red/green that pass
WCAG AA on `#FFFFFF`).

## Typography

- **Family:** `"Nunito Sans", sans-serif` — a single family for everything.
- **Font files (downloaded, self-hosted by the site):**
  - `assets/fonts/nunito-sans/NunitoSans-VariableFont.woff2`
  - `assets/fonts/nunito-sans/NunitoSans-Italic-VariableFont.woff2`
- Nunito Sans is published under the SIL Open Font License; verify the licence of
  these specific files before redistributing them.

```css
@font-face {
  font-family: "Nunito Sans";
  font-style: normal;
  font-weight: 200 1000;
  font-display: swap;
  src: url("/assets/fonts/nunito-sans/NunitoSans-VariableFont.woff2") format("woff2-variations");
}
@font-face {
  font-family: "Nunito Sans";
  font-style: italic;
  font-weight: 200 1000;
  font-display: swap;
  src: url("/assets/fonts/nunito-sans/NunitoSans-Italic-VariableFont.woff2") format("woff2-variations");
}
```

### Text styles

| Style | Size / line-height | Weight | Example |
|---|---|---|---|
| `display` | 48 / 56 px | 900 | Hero headline "Najlepsze Alior Konto i masz więcej!" |
| `sectionTitle` | 36 / 44 px | 800 | "Może Cię zainteresować", "Zobacz również" |
| `cardTitle` / `lead` | 24 / 32 px | 700 / 400 | Card titles; hero lead paragraph |
| `title` | 20 / 28 px | 700 | Button labels, small card titles |
| `bodyLarge` | 18 / 28 px | 400 | Longer descriptions |
| `body` / `bodyStrong` | 16 / 24 px | 400 / 700 | Default copy / emphasis |
| `nav` | 16 / 28 px | 600 | Main navigation |
| `label` | 14 / 22 px | 600 | Tags, small labels |

Headings are heavy (800–900) and tight; body copy is regular. Contrast between very
bold headlines and light body text is a key trait of the brand.

## Spacing

Base unit **4 px**, mostly used in multiples of 8: `4, 8, 12, 16, 24, 32, 48, 64`.
Content container is **1040 px** wide. The sticky header is 96 px tall.
Large buttons use `14px 48px` padding; tags use `8px 16px`; the footer uses `64px` top padding.

## Border radius

| Token | Value | Usage |
|---|---|---|
| `xs` | 6 px | Small controls |
| `sm` | 8 px | Inputs, small boxes |
| `md` | 12 px | Medium elements |
| `lg` | **16 px** | **Default** — buttons, cards, tiles (most common value) |
| `xl` | 24 px | Large promo cards |
| `2xl` | 32 px | Hero/feature blocks |
| `full` | 999 px | Pills/tags ("POLECAMY", "PROMOCJA"), tab chips |
| `circle` | 50% | Round icon buttons (arrows, slider handles) |

## Shadows

Single soft elevation: `0px 8px 30px 0px rgba(7, 7, 7, 0.08)` — used on white cards
over the `#F7F7F8` page background. Avoid heavy or colored shadows.

## Components

### Buttons

| Variant | Styles |
|---|---|
| Primary ("Sprawdź") | bg `#79003C`, text `#FFFFFF`, border 2px `#79003C`, radius 16px, padding 14px 48px, 20/28 px bold, height 60px |
| Secondary / outline ("Otwórz konto") | transparent bg, text and 2px border `#79003C`, otherwise as primary |
| Small ("Zaloguj" in header) | as primary, padding 8px 24px, 16/24 px bold, height 44px |

Hero pairs a primary and an outline button side by side.

### Header and navigation

- Sticky header, background `#F7F7F8`, height 96px; logo on the left.
- Top row: segment switch ("Klienci indywidualni") and utility links ("Otwórz konto", "Zaloguj").
- Main nav links: black, 16 px, weight 600, with chevrons for dropdowns; search icon button on the right.

### Tags / badges

- **POLECAMY:** bg `#FFC426`, black text, 14 px semibold uppercase, pill radius, padding 8px 16px.
- **PROMOCJA:** bg `#FFE5F2`, same typography.

### Cards and tiles

White background, radius 16px, card shadow, generous inner padding (24–32 px). Cards
contain a title, short description, small muted "nota prawna" link and a round arrow
button in `#79003C` / `#FFE5F2`.

### Inputs (loan calculator)

White field, 16 px text, height 50px, unit suffix ("zł", "mies.") on the right, with a
range slider below: track `#DEDEE3`, round handle with brand-pink ring.

### Footer

Background `#470023`, white text, top padding 64px. Contains the app download bar
("Pobierz Alior Mobile", gold app icon), hotline, link columns and social icons.

## Logo usage

- Use [`assets/logo.png`](../assets/logo.png) at the top left of the header, at about 48–56 px height.
- The logo is a raster PNG on its own bordo/gold background; it works on both light
  (`#F7F7F8`/`#FFFFFF`) and dark (`#470023`) surfaces, so no inverted variant is needed.
  No SVG version was available on the page.
- Keep clear space around the logo of at least 16 px; do not recolor, crop or stretch it.

## Visual style summary

Alior Bank combines a deep bordo (`#79003C`) with warm gold accents taken directly
from its Mercury logo, giving a premium yet approachable look. Layouts are airy: a
light-grey page background, white rounded cards with soft shadows and plenty of
whitespace. Typography uses one rounded sans-serif (Nunito Sans) with very heavy
headlines, which makes the voice confident and direct. Photography is bright and
playful (people in motion, bowler-hat characters), and calls to action are always
clear, large and bordo-colored.

## App additions

The token file has no success, error or warning colors, so the app defines these status tokens
(ADR 003 section 3.5). They are mapped in `app/src/app/globals.css` under `@theme`.

| Token | Text | Background tint | Contrast (text on tint) |
|---|---|---|---|
| `--color-status-positive` | `#1E6B34` | `#E6F4EA` (`--color-status-positive-bg`) | 5.76:1 |
| `--color-status-negative` | `#A1192B` | `#FCE8EA` (`--color-status-negative-bg`) | 6.64:1 |
| `--color-status-warning` | `#7A4B00` | `#FFF4D6` (`--color-status-warning-bg`) | 6.76:1 |

Other measured pairs (WCAG 2.x, `contrastRatio` in `app/src/lib/shared/contrast.ts`, all >= 4.5:1):

| Pair | Contrast |
|---|---|
| Brand primary `#79003C` on white | 11.18:1 |
| White on brand primary | 11.18:1 |
| `text.muted` `#5E5E6E` on `background.light` `#F7F7F8` | 5.94:1 |

Logo: the reference logo is a third-party trademark. It is not shown in the app build; the header
uses the text product name. `AppHeader` renders it only with the `showDemoLogo` prop, which nothing
passes in this PoC.
