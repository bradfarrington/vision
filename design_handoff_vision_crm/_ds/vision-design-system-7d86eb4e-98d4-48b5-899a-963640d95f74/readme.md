# Vision Design System

**Vision** — *by Digital Craft* — is an all-in-one business operating system for home-improvement and trade installers: window, door, conservatory, roofing and living-space companies. It replaces the tangle of spreadsheets, paper diaries, separate quoting tools and disconnected apps that most installers run on, and pulls the whole business into one connected, multi-tenant platform.

From first enquiry to final sign-off, everything lives in one place: capture and qualify **leads**, build **quotes**, convert them into **contracts**, schedule surveys and installs on a shared **diary**, manage **stock and suppliers**, track **financials**, run **customer comms and marketing**, and automate the repetitive steps with **workflows** — plus dedicated mobile apps so office admin and on-site fitters work from the same live data.

**Positioning:** *The operating system for installers — one connected platform that runs your whole business, from first lead to final fit, so you can see exactly where every job, pound and person stands.*

**Why "Vision":** a single clear view of the entire business (one screen, no blind spots) and the foresight to see where it's heading. The name promises clarity and control.

**Who it's for:** small-to-mid home-improvement and trade firms (≈5–100 staff) who've outgrown spreadsheets but don't want a bloated generic CRM.

**Multi-tenancy:** Vision is sold as multi-tenant SaaS. Each installer company is a tenant that brings its own brand colour and logo. Vision itself is the **neutral platform brand** that sits *above* every tenant — which is why the platform palette is deliberately graphite + a single blue, never a loud brand colour of its own.

## Brand feel
Clean · professional · trustworthy · confident · modern-but-not-trendy. Premium business software an established company is proud to log into every day — not a flashy startup, not a dated trade tool. Type does the heavy lifting; the interface stays calm and structured.

---

## Sources
This system was built from brand foundations and four supplied logo assets (no codebase or Figma file was provided):
- `uploads/vision-lockup-light.png` / `vision-lockup-dark.png` — wordmark lockups (with "by digital craft" tagline)
- `uploads/vision-favicon-light.png` / `vision-favicon-dark.png` — the **v.** app mark

All four are copied into `assets/`. No other product source (repo, Figma, screenshots) was supplied — component inventory and screens are authored from the brand brief. If a codebase or Figma exists, re-attach it and the UI kit can be tightened to match real product views.

---

## CONTENT FUNDAMENTALS — how Vision writes

**Voice:** direct, confident, outcome-driven. Sounds like a capable operator, not a marketer.

- **Lead with verbs and outcomes, not features.** "See the whole business," "Convert to contract," "Book the survey" — not "Powerful survey-management functionality."
- **One idea per sentence.** Short. Plain. No subordinate clause pile-ups.
- **"You", not "we" or "the user."** Speak to the installer: "so you can see where every job stands."
- **Sentence case everywhere** except the wordmark (`vision.`, lowercase) and short UPPERCASE eyebrows / labels (`PIPELINE BY STAGE`, `SALES`).
- **British English & sterling.** "colour", "organise", £ values, UK place names and postcodes in examples.
- **Numbers are concrete.** "£248k open pipeline", "34 installs booked", "3 overdue tasks" — real figures over vague claims.
- **No filler, no hype.** Banned: "solutions", "world-class", "next-gen", "seamless", "revolutionary", "empower". **No emoji.**
- **Reference codes are mono and prefixed:** `QUOTE-1042`, `CT-2049`, `INV-88213`, `SKU-WD-4421`.

**Examples**
- Eyebrow → title: `WEDNESDAY, 18 JUNE` → "Good morning, Sarah"
- Empty state: "No overdue tasks. You're all caught up."
- Button labels: "New lead", "Convert to contract", "Resend", "Book job" — verb-first, sentence case.
- Alert: "Quote sent — awaiting decision. Emailed to David Mills 2 hours ago."

---

## VISUAL FOUNDATIONS

**Overall vibe:** bright, spacious, white-first. A calm graphite-and-blue system where whitespace and type carry the design and colour is rationed. The interface should feel structured and quiet — the data is the loudest thing on screen.

**Colour**
- **Graphite / ink `#101418`** — primary text and the wordmark on light.
- **Deep panel `#0f1620`** — dark surfaces, the app-icon background.
- **Accent blue `#2f7de1`** (on light) / **`#4d94ff`** (on dark) — the full-stop, primary CTA, active nav, focus rings, selected rows, thin connectors and data bars. Used **sparingly, like current through a wire** — never a large decorative fill.
- **White `#ffffff`** is the dominant surface; a cool neutral grey ramp (`50`–`900`) carries body text, dividers and hairlines.
- **Semantic** success / warning / danger are quiet and business-grade (muted green, amber, red), always paired with a pale tint for backgrounds.
- Neutral platform palette **by design** — tenants supply their own accent, so Vision stays graphite + one blue. Max one accent.

**Type**
- **Inter Tight** (600–800, tight negative tracking −0.014em→−0.03em) for the wordmark, display and all headings.
- **Inter** (400–600) for body and UI.
- **JetBrains Mono** for reference codes, currency and tabular figures.
- Type does the heavy lifting: big confident Inter Tight headings, generous line-height (1.55) on body.

**Backgrounds:** flat colour only. App canvas is `neutral-50`, surfaces are white. **No gradients, no images, no textures, no patterns** as decoration. Dark surfaces use the deep panel colour flat.

**Borders & hairlines:** 1px, `neutral-200`. Dividers and table rows are hairlines. Structure comes from borders and spacing, not shadows.

**Shadows / elevation:** soft or none at rest. Cards sit on a barely-there `shadow-sm`; hover lifts to `shadow-md`; menus and modals use `shadow-pop`. Never heavy or coloured shadows.

**Corner radii:** 8px on buttons/inputs/chips; 12px on cards; 16px on large panels/modals; pill (999px) for progress tracks, toggles and status dots.

**Cards:** white surface, 1px hairline border, `shadow-sm`, 12px radius. Optional header/footer bands separated by hairlines; footer band sits on `neutral-50`. No coloured left-border accent cards, no rounded-corner + colour-stripe tropes.

**Buttons:** primary = solid blue; secondary = white + hairline (the workhorse in dense toolbars); ghost = transparent; danger = solid red. 8px radius, no shadow at rest.

**Motion:** quick and functional. 120–200ms, standard easing `cubic-bezier(0.2,0,0,1)`. Fades and short slides (toggle knob, progress fill). No bounce, no springy overshoot, no decorative animation.

**Hover states:** surfaces darken by one neutral step (`transparent → neutral-100`); primary button → `blue-hover`; cards raise their shadow. **Press states:** one step darker again (`neutral-150`, `blue-active`); no scale/shrink.

**Focus:** 3px soft-blue ring (`rgba(47,125,225,0.35)`) plus a blue border. Always visible for keyboard users.

**Transparency & blur:** used only for the modal scrim — graphite at 44% with a 1.5px backdrop blur. Otherwise surfaces are fully opaque.

**Layout:** fixed 244px sidebar + 60px topbar app shell; content max-width ~1180px, centred, on the `neutral-50` canvas. 4px spacing grid throughout.

**Imagery:** none in the platform brand (avatars use initials fallbacks). If tenants add logos they appear only in tenant-scoped spots.

---

## ICONOGRAPHY

- **Style:** thin **line icons, 2px stroke, rounded caps and joins, 24px grid** — the Lucide visual language. Calm, geometric, consistent weight. This matches the modern-but-not-trendy, structured brand feel.
- **In this system:** the UI kit ships a hand-built, dependency-free set in `ui_kits/vision-app/icons.js` (`window.VIcons`) drawn in the Lucide style — Dashboard, Leads, Quotes, Contracts, Diary, Stock, Finance, Comms, Workflows, Settings, plus utility glyphs (Search, Bell, Plus, chevrons, More, Filter, Calendar, Phone, Mail, Check, MapPin, Clock, Download, Send, ArrowRight). Reuse these before adding new ones.
- **Substitution note:** these are Lucide-style shapes drawn to match; if you want the exact Lucide set in production, install [`lucide-react`](https://lucide.dev) — it's stroke-compatible and a drop-in. **Flagged as a substitution.**
- **Colour:** icons inherit `currentColor`. Idle nav/utility icons are `neutral-500`; active nav icon is accent blue; icons never carry their own colour.
- **Component icons:** `Button`, `IconButton`, `NavItem`, `Alert`, `Stat` take icons as React nodes so you pass whatever set you like. Never bake colour into an icon.
- **No emoji. No unicode dingbats as icons.** The only glyph used as UI is the mono `⌘K` in the search field.
- **The full-stop** in `vision.` and the `v.` mark is a brand element (blue circle), not an icon — don't substitute a period glyph; it's a filled dot.

---

## Components

Reusable React primitives under `components/`, grouped by concern. Import from the compiled bundle: `const { Button } = window.VisionDesignSystem_7d86eb`.

**forms/** — `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`
**display/** — `Card`, `Badge`, `Tag`, `Avatar`, `Stat`
**feedback/** — `Alert`, `Tooltip`, `Toast`, `ProgressBar`
**navigation/** — `Tabs`, `Breadcrumb`, `NavItem`
**data/** — `Table`
**overlay/** — `Dialog`

Each component directory has `<Name>.jsx`, `<Name>.d.ts` (props contract), `<Name>.prompt.md` (usage), and one `@dsCard` HTML showing its states.

**Intentional additions** (beyond a generic starter set, because Vision is a data-dense operations app): `Stat` (dashboard KPI), `Table` (list views), `NavItem` (app sidebar rows), `ProgressBar`, `Breadcrumb`. Each earns its place in the UI kit screens.

---

## UI kits

**`ui_kits/vision-app/`** — high-fidelity, click-through recreation of the Vision web app.
- `index.html` — interactive shell: navigate the sidebar, open **Leads**, click a row to open the **quote detail**, view the **Diary**.
- Screens: `Dashboard.jsx`, `Leads.jsx`, `LeadDetail.jsx`, `Diary.jsx`; shell in `AppShell.jsx`; `icons.js` (icon set), `data.js` (fake data).
- Composes the component primitives above — it does not re-implement them.

---

## Foundations (Design System tab)
Specimen cards live in `guidelines/` (Colors, Type, Spacing, Brand) and each component directory (Components). They render live from `styles.css` tokens.

## File index
- `styles.css` — global entry point (consumers link this). `@import`s only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css` (spacing + radius + shadow + motion + layout).
- `assets/` — the four supplied logo/favicon PNGs.
- `components/` — reusable primitives (see above).
- `ui_kits/vision-app/` — the web-app recreation.
- `guidelines/` — foundation specimen cards.
- `thumbnail.html` — homepage tile.
- `SKILL.md` — Agent-Skill wrapper for use in Claude Code.

## Fonts
Inter, Inter Tight and JetBrains Mono load from Google Fonts (`tokens/fonts.css`, `@import`). For fully offline/self-hosted use, download the woff2 files and swap the `@import` for local `@font-face` rules — **flagged**: fonts are currently CDN-linked, not bundled binaries.
