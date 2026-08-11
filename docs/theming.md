# Theming

How color and theme tokens work in this app. Stack and layout live in
`README.md`; this file is the why and the rules for changing the palette.

## Source of truth

Color tokens live in `src/app/globals.css` as CSS variables. The project uses
shadcn's Neutral base (`baseColor: "neutral"` in `components.json`). Light
values sit under `:root`; dark values sit under `.dark`.

That file is the only source of truth for the palette. Change a variable there
and every consumer that reads the corresponding Tailwind token updates — there
is no second color map to keep in sync.

`@theme inline` maps those CSS variables onto Tailwind theme keys
(`--color-primary` → `bg-primary`, and so on). Components never need to know
the oklch values; they only name the role.

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
fonts). The Neutral base in `components.json` describes the install default; a
preset may overwrite the variables in CSS.

## Dark mode

Dark tokens already exist under `.dark` in `globals.css`, and the dark variant
is registered (`@custom-variant dark`). There is no theme toggle (and no
provider that sets the `dark` class) yet — the app stays on the light tokens
until that lands.
