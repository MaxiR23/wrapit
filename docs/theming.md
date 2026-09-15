# Theming

How color, radius, and theme tokens work in this app. Stack and layout live
in `README.md`; this file is the why and the rules for changing them.

## Source of truth

Color and radius tokens live in `src/app/globals.css` as CSS variables. The
project uses shadcn's Neutral base (`baseColor: "neutral"` in
`components.json`). Light color values sit under `:root`; dark color values
sit under `.dark`. Radius is the same in both.

That file is the only source of truth for the palette and the corner scale.
Change a variable there and every consumer that reads the corresponding
Tailwind token updates — there is no second map to keep in sync.

`@theme inline` maps those CSS variables onto Tailwind theme keys
(`--color-primary` → `bg-primary`, `--radius-md` → `rounded-md`, and so on).
Components never need to know the oklch or rem values; they only name the
role or the step.

## Semantic tokens

UI uses semantic classes — `bg-primary`, `text-destructive`, `border`,
`bg-background`, `text-muted-foreground`, and the rest of the shadcn set —
never hardcoded hex, rgb, or oklch in component class names.

Why: the theme stays a single edit. Swap the variables (or apply a new preset)
and light and dark both follow, because dark is the same semantic names with
different values under `.dark`. A hardcoded color would ignore that and break
the moment the palette moves.

Domain components and `src/components/ui/` already follow this. New UI should
too.

The projects shell adds a few roles that the Neutral preset does not include:
`--surface`, `--card-hover`, `--subtle`, `--border-strong`, and the status bar
colors `--status-in-progress`, `--status-done`, `--status-paused`, `--status-new`.
User presence tones are a separate catalog: `--user-status-green`,
`--user-status-gray`, `--user-status-red`, `--user-status-amber`,
`--user-status-blue`, `--user-status-violet`. Board cards add `--late` for
overdue due dates and eight label tones (`--label-blue`, `--label-green`,
`--label-amber`, `--label-red`, `--label-violet`, `--label-cyan`, `--label-pink`,
`--label-gray`). Archive swipe uses `--ok`, `--ok-soft`, and `--ok-edge`. All of
these extra roles are defined next to the other variables in `globals.css`
and mapped in `@theme inline`, so components use `bg-surface`, `text-subtle`,
`bg-status-in-progress`, `text-user-status-green`, `text-late`, `text-label-violet`,
`bg-ok-soft`, `text-ok`,
and so on. The six presence keys live in `src/lib/userStatus.ts`; the eight label
keys live in `src/lib/labelTones.ts`. JSX never inlines their oklch values.

## Radius scale

Corners use a named scale, not a per-component pixel value. The steps are
explicit rem in `globals.css`. This is a look change, not only a rename:
controls (`rounded-md`) go from 8px to 12px, cards and columns (`rounded-lg`)
from about 14px to 16px, dialogs and popovers (`rounded-xl`) to 20px. The app
is meant to read as rounder.

- `rounded-xs` (6px) — checkboxes, kbd, nested segmented thumbs
- `rounded-sm` (8px) — icon-only buttons, menu rows, inline chrome
- `rounded-md` (12px) — buttons, inputs, textareas, search, list rows, auth
  form, segmented wrappers, default `Skeleton`
- `rounded-lg` (16px) — cards, columns, empty frames, account/profile blocks,
  project tiles
- `rounded-xl` (20px) — dialogs, popovers, desktop overlays
- `rounded-2xl` (24px) — the phone tab bar inner surface, phone sheet tops
  (`rounded-t-2xl`)

The phone tab bar is a floating pill on `ProjectsMobileTabBar`. Chrome is
inline styles bound to the named tokens (`--spacing-mobile-tab-bar-inset`,
`--radius-2xl`, `--mobile-tab-bar`, `--shadow-mobile-tab-bar`) so Safari
cannot drop the layout. The pin is `fixed` with `safe-inset-x` and
`safe-inset-b` so the visual inset sits inside the device safe rect, then
`tablet:hidden` above `tablet`. No `backdrop-filter`. Tab links use inset
focus (`-outline-offset-2`).

Phone search and the add button share `--spacing-mobile-search` through
`src/components/mobileChrome.ts`. Search fields spread `searchFieldDomProps`
(`type=text`, `role=searchbox`). `type=search` is banned. `input[role=searchbox]`
uses unlayered `appearance: none` so WebKit does not paint a searchfield.
That reset does not set `border-radius`: standalone fields keep `rounded-md`.
Phone search is a normal `h-mobile-search` field with a leading icon.

`rounded-full` stays for circles and pills. `rounded-none` stays for
full-bleed phone cover dialogs (`dialog-phone-cover` also sets
`border-radius: 0`). Those are not rectangle corners that missed the scale.

Components name the step (`rounded-md`, `rounded-xl`). They do not write
`rounded-[10px]`, `rounded-[min(var(--radius-md),10px)]`, or a raw
`border-radius`. Adding a raw radius fails the build: `tests/app/radius.test.ts`
scans `src/components` and only an explicit `file:match` allowlist (kept
empty unless a case is forced) can pass.

The auth email CTA in `src/lib/emailLayout.ts` keeps a literal `6px` equal to
`xs`. CSS variables do not survive most mail clients.

## Changing the palette

shadcn presets can replace the theme without touching component files:

```bash
pnpm dlx shadcn@latest apply --preset <code> --only theme
```

`--only theme` applies colors and CSS variables only. Use `--only theme,font`
when the preset should also update fonts.

Always run this on a dedicated branch with a clean working tree. `apply` has
no dry-run; git is how you inspect and revert the diff if the preset is wrong.

After applying, review `src/app/globals.css` (and font wiring if you included
fonts), including `--radius` and the explicit radius steps. A preset may
overwrite those. The Neutral base in `components.json` describes the install
default.

## Dark mode

Dark tokens already exist under `.dark` in `globals.css`, and the dark variant
is registered (`@custom-variant dark`). There is no theme toggle (and no
provider that sets the `dark` class) yet — the app stays on the light tokens
until that lands.
