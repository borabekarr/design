# Proving it feels right (web)

`scripts/try.mjs` uses the running app the way a person would, in the person's own Chrome
(headless, a throwaway profile: no logins, no extensions): it presses, taps, drags and navigates,
records every frame, judges each move against `principles.md`, does it all again with Reduce
Motion on, and saves a filmstrip of each move. You write the plan; it does the rest.

## The plan: `.feel/plan.json`

```json
{
  "url": "http://localhost:3000",
  "device": "phone",
  "steps": [
    { "move": "press", "page": "/", "target": "Add to bag" },
    { "move": "press", "page": "/", "target": ".product-card", "name": "product card" },
    { "move": "sheet", "page": "/", "open": "Filters", "close": "Escape" },
    { "move": "sheet", "page": "/", "open": "Account", "close": "Account", "sheet": "[role=menu]", "name": "account menu" },
    { "move": "drag",  "page": "/", "open": "Filters", "dy": 320, "expect": "dismiss" },
    { "move": "drag",  "page": "/", "open": "Filters", "dy": 60, "expect": "return" },
    { "move": "toast", "page": "/item/1", "trigger": "Add to bag" },
    { "move": "page",  "page": "/", "go": "Linen shirt", "expectPath": "/item/1" },
    { "move": "page",  "page": "/item/1", "go": "All items", "expectPath": "/", "direction": "back", "name": "back" }
  ]
}
```

- `url`: the running app. `device`: `phone` (390×844, touch, iPhone user agent) or `desktop` (1280×800).
- `page`: the path to open first (a fresh load for every step).
- Elements are named by **the words on them** or their `aria-label` (icon buttons) (`"Add to bag"`, matched like a person would: exact
  first, then contains) or by a **CSS selector** (`".product-card"`, `"[data-testid=filters]"`).
- `before`: steps to get there first, e.g. `"before": [{ "tap": "Accept cookies" }, { "wait": 300 }]`
  (also `{ "key": "Escape" }`, `{ "scroll": 600 }`).
- `name`: a label for the report when the target's words aren't clear.

| move | fields | what it measures |
|---|---|---|
| `press` | `target`, `hold` (ms, default 260) | answers within 100 ms of the press (not the click); how deep it sinks (0.95–0.98); how long down and back; whether it jumps down or snaps back in one frame; reduce motion: no shrinking, and the dim eases in and out (not one frame); a press that goes to another page isn't asked to come back |
| `sheet` | `open`, `close` (`"Escape"`, `"backdrop"`, or the words/selector of a close control), `sheet` (selector, when it isn't a dialog/role=dialog/menu/listbox/`[popover]`/`[class*=sheet]`/`[class*=modal]`), `menu: true` (a menu or popover: no dialog role or focus trap expected; automatic for `[role=menu]`, `[role=listbox]`, `[popover]`) | enters over frames and from its edge (bottom sheets from below, no rise past rest); enter time; focus moves in; closes; exit animated and quicker than enter (with reduce motion too), timed from its first visible change like the enter, and starting at once; focus returns to the trigger; opened again 60 ms after closing (mid-exit) it comes back and rests on screen, with focus inside it (modal sheets and dialogs); menus: three quick taps on the trigger end in one clear state (on screen and `aria-expanded` agreeing, nothing left half there); reduce motion: no travel |
| `toast` | `trigger`, `toast` (selector if not found), `wait` (ms to watch for it leaving, default 8000) | announced (role=status/alert/aria-live); enters over frames from its edge (the side is read from its farthest frame, not its first); stays ≥ 3 s (aim 4+); leaves animated; reduce motion: no travel |
| `page` | `go` (link words/selector), `expect` (part of the new URL), `expectPath` (the exact new path, e.g. `"/"`, where `expect` would match anything), `direction`: `forward` \| `back` \| `fade` (what this step should do; a step named or labelled "back"/"←" expects `back`), `sameUrl: true` for apps that change screens without changing the address | navigated; a transition played (View Transition, or CSS on arrival on the root, `<main>`, `data-feel="page"` or the view straight inside one of them; other things moving on arrival don't count); its length (what is seen: the old and new pages' own animations and any shared element that flies, not a group that holds still or the browser's default crossfade of what didn't change); which way it really moved (from the old and new page's own keyframes: forward = the new page comes from the right) against `direction` and against the app's `data-feel-nav`; reduce motion: no sliding, and no shared element (a named `::view-transition-group`, not root, not a header or tab bar held still) flying |
| `drag` | `target` (or `open` to open a sheet first and drag that), `handle`, `dx`/`dy` (px), `ms` or `fast: true`, `expect`: `dismiss` \| `return` \| `resist` | follows the finger (1:1 in its free direction); thrown away past the line or with speed, without jumping back first; or springs back to rest without snapping (something that never moved with the finger is only told so) |

- A "return" drag must stay well under the dismiss line: the kit dismisses past 30% of the
  element's size, so use `dy` under 20% of its height (40 px for a 200 px sheet). A "dismiss" drag
  goes past 40%, or use `fast: true`.
- To drag something that isn't a sheet (a toast), get it on screen first:
  `{ "move": "drag", "page": "/", "before": [{ "tap": "Save" }, { "wait": 500 }], "target": ".toast", "dx": 200, "fast": true, "expect": "dismiss" }`.
- Drags start on the element's handle when it has one (`data-feel-handle`, a "grab"/"handle"
  class), otherwise 24 px below its top edge; set `handle` to be exact.
- Exits are timed like enters, from the first frame that changes; the wait from the key or tap to
  that frame is kept apart (`exitLag` in report.json) and flagged over 200 ms.
- "A tap 60 ms after closing does not open it again" usually means the leaving backdrop still
  catches taps: give it `pointer-events: none` once it is closing. "It never comes back on screen"
  means the leaving copy was reused and left invisible: a FIX.

Write one step per **kind** of thing, not per instance: the main button, a card, each different
sheet or dialog component, the menu, the toast, one push and one back, one drag per draggable kind.
6–14 steps is normal.

Construct Design components are not the app's: `scan.mjs` writes their roots (their class prefix,
`bs-`, `pyb-`…) into `.feel/map.json`, and `try.mjs` never takes anything inside one for the app's
sheet, toast or page arrival (their hand-tuned intro is not a page transition). Add other roots
with `"library": "<selector>"` in the plan. A step that names its own `sheet`/`toast` selector is
taken as written.

## Running it

```bash
node <skill>/scripts/try.mjs <app> --label before          # before changing anything
node <skill>/scripts/try.mjs <app> --label after --compare before
node <skill>/scripts/try.mjs <app> --only 3,5               # just those steps (the label's other steps are kept: report.md, report.json and the summary)
node <skill>/scripts/try.mjs <app> --slow                   # 4x slower CPU, like a mid-range phone
node <skill>/scripts/try.mjs <app> --device desktop
```

It needs the app running (start the dev server in the background first) and Chrome, Edge, Brave
or Chromium installed (`FEEL_BROWSER=/path/to/browser` if it isn't found). Output:
`.feel/<label>/report.md`, `report.json`, one strip per step (`01-press.png` …), and with
`--compare` one before/after picture per step in `.feel/`.

Exit code 0 = all good, 1 = something to fix, 2 = something could not be tested (a missing
element, the app not running: fix the plan or the app, don't skip it).

## Reading the results

- **FIX** lines are things a person feels: fix every one, then run the step again.
- **LOOK** lines need judgement: fix them unless there is a reason (say the reason in the hand-over).
- **CAN'T** means the step never ran: an element wasn't found, or the app didn't respond. Correct the
  plan (a better selector, a `before` step) and run it again.
- **Open the strips and look at them.** Numbers can pass while something looks wrong (a sheet
  arriving from the wrong side, a toast under the tab bar, two things animating at once).
- Frame timing in a headless browser is a rough guide. "Slow frames" lines are worth a look with
  `--slow`, not a verdict.

## What it can't check

- Native apps (SwiftUI, React Native): it only drives web pages. Check those by building them, and
  list the moves for the person to try by hand.
- Haptics, sound, and how a real finger's speed feels on glass.
- Safari's and Firefox's own quirks: it runs Chromium. The kit is written for all three; the
  support notes in `web.md` say where Firefox and Safari differ.
- Pages behind a login: add `before` steps that sign in with a test account, or test a page that
  doesn't need one and say what wasn't covered.
