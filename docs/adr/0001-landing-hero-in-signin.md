# Landing hero lives in sign-in

## Status

Accepted

## Context

`/` mixed a session redirect with a device-dependent choice between a landing
hero (mobile) and the login screen (desktop). Resolving that choice in
JavaScript (`matchMedia`) or by sniffing the user-agent on the server risks a
hydration flash: the first paint can show the wrong presentation until the
client catches up, and a resize can disagree with whatever the server guessed.

## Decision

`/` is redirect-only. A session goes to `/projects`; otherwise the page
redirects to `/sign-in`. It renders no UI and does no device detection.

The hero lives in `/sign-in`. Desktop and tablet (`auth-sm` and up) keep the
existing split (brand panel and form). Mobile (below `auth-sm`) shows the hero
above the same form. The two presentations are the same page, switched with CSS
breakpoints (`hidden` / `flex`). There is no `matchMedia` and no user-agent
detection.

## Consequences

- `/` has a single responsibility: send the visitor to the right place.
- There is no hydration flash, and the layout stays responsive when the window
  is resized.
- The hero is now coupled to the sign-in screen. Sign-up, forgot-password and
  reset-password keep the shared split layout and do not show the hero.

## Alternatives considered

Server-side user-agent detection on `/` was rejected. It would make `/`
dynamic, the user-agent can be spoofed, and it is more moving parts than CSS
breakpoints on the sign-in page.
