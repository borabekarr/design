# FEEL on the web

The kit is in `kit/web/` (the skill's folder). Read `references/principles.md` first: this file is
only the *how*, per setup. Use what the app already has; add the kit only for what's missing.

**Construct Design files** (scan.mjs lists them: a `// Construct Design · <slug>` line under
`"use client"`, usually in `components/design/`): their motion is tuned by hand. Never add or change
motion inside one, no `data-feel`, no wrapper styles that reach into it. Put the five moves around
them: the app's own buttons, sheets, toasts and routes. If a library component is itself the sheet
or the toast, leave it as it is. check.mjs skips them, and flags FEEL's moves put inside one.

## 1. Install the kit (once)

| file | what | where it goes |
|---|---|---|
| `feel.css` | the tokens and every move in CSS (press, toggle, resize, sheet, drawer, dialog, pop, toast, backdrop, page, reduced motion) | next to the global stylesheet, imported once, after the reset/Tailwind import |
| `ts/drag.ts` (or `js/drag.js`) | follow the finger, rubber band, throw with the finger's speed | the project's lib folder, e.g. `lib/feel/` |
| `ts/presence.ts` | `settled(el)`: wait for an element's exit animation; `show(el)` / `hide(el)` for plain JS; `shut(el)`: close a native `<dialog>`/`[popover]` with its exit in Safari and Firefox too | same |
| `ts/morph.ts` | `morph(from, to, { within })`: a picture flying from a small thing into a big one over the page, and back | same |
| `ts/react.ts` | `usePresence`, `useDrag` for React | same (React apps only) |
| `ts/vue.ts` | `feelEnter`, `feelLeave`: `<Transition :css="false">` hooks for Vue 3 | same (Vue apps only) |
| `ts/svelte.ts` | `enter`, `leave`: `in:enter out:leave` transitions for Svelte 4/5 | same (Svelte apps only) |
| `ts/nav.ts` | `go(update, "forward"\|"back"\|"fade")`: page changes as View Transitions; `startVT(update, way)` for routers that run the change themselves (Vue Router, SvelteKit) | same (apps that route in the browser, not Next) |
| `ts/spring.ts` | the spring maths drag.ts uses | same, whenever drag.ts goes in |
| `feel.global.js` | all of it as one `<script>` (window.Feel) | plain HTML sites without a bundler |

Copy `.ts` files into TypeScript projects, `js/*.js` into JavaScript ones (they import each other
with `./x.js`). Copy only what you use. Keep the file names and the header comments.

- **Tone**: `<html data-feel-tone="crisp|soft|lively">`. Next: on `<html>` in `app/layout.tsx`;
  Vite (React or Vue): `index.html`; SvelteKit: `src/app.html`; Nuxt: `app: { head: { htmlAttrs } }`.
- **Where the CSS goes**: Next App Router → `import "./feel.css"` in `app/layout.tsx` (or
  `@import "./feel.css";` at the end of `globals.css`); Vite/React → `main.tsx`; Vite/Vue →
  `src/main.ts`, after the app's own CSS imports (`import "./lib/feel/feel.css"`); Nuxt → `css: [...]`
  in nuxt.config; SvelteKit → `import "$lib/feel/feel.css"` (Kit 1–2) or `import "#lib/feel/feel.css"`
  (Kit 3+) in `src/routes/+layout.svelte`; Astro → the base layout; plain HTML → `<link>`.
- **Import paths**: Vue recipes below use paths relative to `src/components/` (`../lib/feel/…`):
  plain `npm create vite` has no `@/` alias (only create-vue and Nuxt set one up). SvelteKit 1–2:
  `$lib/feel/…`. **SvelteKit 3+** has no `$lib`: add `"imports": { "#lib/*": "./src/lib/*" }` to
  `package.json` and import with the extension, `#lib/feel/nav.ts` (CSS: `#lib/feel/feel.css`);
  Kit 3's config moved from `svelte.config.js` into `sveltekit({ … })` in `vite.config`. Plain
  Vite + Svelte: relative paths.
- **Global, not scoped**: rules the kit needs to reach (`::view-transition-*`,
  anything on `html`) go in a global stylesheet, never in a Vue `<style scoped>`, a Svelte component
  `<style>` (unless wrapped in `:global(...)`) or a CSS module.
- **Tailwind v4**: keep `feel.css` *outside* any `@layer`: utilities live in `@layer utilities`, and
  unlayered rules win, so the kit's transitions aren't overridden by `transition-colors` & co.
- **iOS Safari press**: `:active` only applies on iPhone when the page listens for touches. Add once,
  on the client: `document.addEventListener("touchstart", () => {}, { passive: true });` (Next: a
  tiny `"use client"` component in the root layout with a `useEffect`).
- **Tune later in one place**: the token block at the top of `feel.css`. Never retype a duration.

## 2. If the app already uses `motion` (or `framer-motion`)

Keep it for React moves and give it the same tokens instead of adding the CSS moves on top. Put
this in `lib/feel/motion.ts` (import from `motion/react`, or `framer-motion` if that's what's installed):

```ts
// FEEL tokens for motion. crisp | soft | lively: change TONE only.
const TONE = "crisp" as "crisp" | "soft" | "lively";
const T = {
  crisp:  { press: 0.97, fast: 0.1,  base: 0.18, slow: 0.26, bounce: 0 },
  soft:   { press: 0.98, fast: 0.14, base: 0.24, slow: 0.34, bounce: 0 },
  lively: { press: 0.95, fast: 0.1,  base: 0.22, slow: 0.32, bounce: 0.25 },
}[TONE];
export const out = [0.22, 1, 0.36, 1] as const, inn = [0.4, 0, 1, 1] as const;
export const feel = {
  press: { whileTap: { scale: T.press }, transition: { type: "spring", visualDuration: 0.25, bounce: T.bounce } },
  sheet: { initial: { y: "100%" }, animate: { y: 0, transition: { duration: T.slow, ease: out } }, exit: { y: "100%", transition: { duration: T.slow * 0.5, ease: inn } } },
  dialog: { initial: { opacity: 0, scale: 0.96, y: 8 }, animate: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", visualDuration: T.base, bounce: T.bounce * 0.6 } }, exit: { opacity: 0, scale: 0.98, transition: { duration: T.base * 0.7, ease: inn } } },
  pop: { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1, transition: { type: "spring", visualDuration: T.base, bounce: T.bounce * 0.6 } }, exit: { opacity: 0, scale: 0.97, transition: { duration: T.base * 0.7, ease: inn } } },
  toast: { initial: { opacity: 0, y: 24, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", visualDuration: T.base + 0.08, bounce: T.bounce } }, exit: { opacity: 0, scale: 0.96, transition: { duration: T.base * 0.7, ease: inn } } },
  backdrop: { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: T.slow, ease: out } }, exit: { opacity: 0, transition: { duration: T.slow * 0.5, ease: inn } } },
  // reduce motion: what travels (a sheet, a drawer) fades instead. reducedMotion="user" drops y, leaving a pop.
  still: { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: T.base, ease: [0, 0, 0.58, 1] } }, exit: { opacity: 0, transition: { duration: T.base * 0.7, ease: inn } } },
};
```

Exits follow the kit: what travels (sheet, backdrop) leaves in about half its time (`slow × 0.7 × 0.7`,
principles.md), menus, dialogs and toasts in 70% of base.

- Wrap the app once in `<MotionConfig reducedMotion="user">`: it drops transform and layout
  animations for people who asked, and keeps opacity. A sheet only moves, so it would just appear:
  `const reduce = useReducedMotion();` and `{...(reduce ? feel.still : feel.sheet)}` on it (drawers too).
- Exits need `<AnimatePresence>` around the conditional element (`mode="popLayout"` when siblings
  should close the gap smoothly).
- `whileTap` fires on pointer down: that is the press. It also fires on Enter for keyboard users.
- Drag: `drag="y"`, `dragConstraints={{ top: 0, bottom: 0 }}`, `dragElastic={{ top: 0.1, bottom: 0.6 }}`,
  and in `onDragEnd(_, info)` dismiss when `info.offset.y > height * 0.3 || info.velocity.y > 450`
  (px/s), else let it spring back. Put `dragListener={false}` + `useDragControls` on a handle if the
  sheet's content scrolls.
- In motion only `opacity`, `filter`, `clipPath` and a whole `transform` string run off the main
  thread; `x`/`y`/`scale` run on its frame loop. That's fine for these moves; keep pages light while
  they play.
- motion's `transition.duration` is in **seconds**.

## 3. Press

Plain CSS (tokens, reduced motion and the release spring included):

```html
<button data-feel="press">Add to cart</button>
<a class="card" data-feel="press" data-feel-size="large" href="/item/3">…</a>
```

- With a shared Button component (shadcn's `components/ui/button.tsx`, the app's own `<Button>`),
  put `data-feel="press"` on its root once: every button gets it. Same for `Card` if it's clickable.
- The kit sets `transition` on scale *and* the colour properties a button usually animates. If
  the element's own rule sets a `transition` and it **loads after `feel.css` or is more specific**
  (a class beats `[data-feel~="press"]` only when later, but Vue `<style scoped>`, Svelte component
  styles and CSS modules add an attribute or hash, so they always win), the press loses its spring
  and snaps. Add the kit's tokens to that rule:
  `transition: background-color .2s, scale var(--feel-release-time) var(--feel-release), opacity var(--feel-fast) ease-out;`
  (the `:active` sink still comes from the kit; `opacity` because under reduce motion the kit dims
  a pressed thing to 0.7 instead of shrinking it, and without it in the list the dim snaps).
  `try.mjs` reports "jumps down in one frame" when that happens.
- Tailwind, if the team prefers classes over attributes: `active:scale-[0.97] transition-[scale,background-color] duration-100 ease-out motion-reduce:active:scale-100 motion-reduce:active:opacity-70`
  (v4's `scale-*` uses the `scale` property; v3's uses `transform`).
- Things that only *look* like buttons (`div onClick`) should become `<button>`s while you're there:
  only real buttons get keyboard and screen-reader behaviour.

- Toggles (heart, star, follow, checkbox buttons): `data-feel="press toggle"` and the state in
  `aria-pressed` / `aria-checked` (or `data-on`): the icon pops when it turns on. If the app swaps the
  icon's markup on toggle, that's fine: the new icon pops.
- A picture whose size follows state (cover art smaller when paused): `data-feel="resize"` on it and
  keep the app's own state rule (`.paused .art { scale: .78 }`; use `scale`, not `transform`, so it
  doesn't fight the press). It springs with the tone.

## 4. Sheets, dialogs, drawers, menus

Find the library first (scan.mjs lists it) and use the matching row:

| the app uses | do this |
|---|---|
| **Radix / shadcn** (`Dialog`, `Sheet`, `Drawer`, `Popover`, `DropdownMenu`, `Select`, `HoverCard`, `Tooltip`) | Put `data-feel="sheet"` (bottom), `"drawer"` (+ `data-feel-side="left"` if left), `"dialog"` (centred) or `"pop"` (menus/popovers/selects) on the **Content**, and `data-feel="backdrop"` on the **Overlay**. **Remove** the `data-[state=open]:animate-in … slide-in-from-* zoom-in-95` classes from those same elements: two animations fight. Radix waits for CSS **keyframe** animations before unmounting, and feel.css uses keyframes, so exits play. Menus open out of their trigger by themselves (Radix's `--radix-*-transform-origin`). |
| **Headless UI v2** | Add the `transition` prop to `DialogPanel`/`DialogBackdrop`/`MenuItems`/`PopoverPanel` and the matching `data-feel`. The kit reads `data-closed` / `data-enter` / `data-leave`. |
| **Native `<dialog>`** | `data-feel="sheet"` (or dialog/drawer) on the `<dialog>`, open it with `showModal()`. Enter uses `@starting-style` (all three). Only Chrome keeps a closing dialog on screen (`overlay` + `display` transitions); Safari and Firefox take it away at once (tested WebKit 27.2, Firefox 155), so close it with `shut(dialog)` instead of `dialog.close()`, and Escape with `dialog.addEventListener("cancel", (e) => { e.preventDefault(); shut(dialog); })`. `<form method="dialog">` and `closedby` close it directly: no exit in Safari/Firefox. |
| **`[popover]`** | `data-feel="pop"`; set `--feel-origin` to the side of the trigger (`top left`, `bottom right` …). Close from code with `shut(menu)` (not `hidePopover()`) so the exit plays in Safari and Firefox. Their light dismiss (Escape, a tap outside) can't be delayed and closes at once; for an exit there too, use `popover="manual"` and call `shut` from your own Escape `keydown` and outside `pointerdown` listeners. |
| **Vaul** | It already rises, drags and throws. Leave it (it is unmaintained, but working). Only check the close timing and that a backdrop fades. |
| **motion** | `AnimatePresence` + the `feel.sheet / dialog / pop / backdrop` variants above. |
| **Hand-made** (`{open && <div className="modal">}`) | React: `usePresence` from `react.ts` and `data-feel-state={state}` (example below). Vue: `<Transition :css="false" @enter="feelEnter" @leave="feelLeave">` from `vue.ts` around the `v-if` element (feel.css has no `.feel-*-enter/-leave` classes; Vue's own must be off). Svelte: `in:enter out:leave` from `svelte.ts`, both. Anything else: set `data-feel-state="closed"`, `await settled(el)`, then remove it, but only if it is still the one closing: if it was opened again meanwhile, leave it (otherwise a tap during the exit opens a sheet that the old exit then deletes). Vue and Svelte: also `data-feel-state="open"` in the markup. |

Hand-made React sheet, complete:

```tsx
"use client";
import { useRef } from "react";
import { usePresence, useDrag } from "@/lib/feel/react";   // Next's default @/ alias; elsewhere a relative path

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null), grab = useRef<HTMLDivElement>(null);
  const { mounted, state } = usePresence(open, sheet);
  useDrag(sheet, { axis: "y", dismiss: 1, handle: grab, fade: backdrop, onDismiss: onClose }, mounted && open);
  if (!mounted) return null;
  return (
    <>
      <div ref={backdrop} className="backdrop" data-feel="backdrop" data-feel-state={state} onClick={onClose} />
      <div ref={sheet} role="dialog" aria-modal="true" aria-label="Filters" className="sheet" data-feel="sheet" data-feel-state={state}>
        <div ref={grab} className="grabber" data-feel-handle />
        …
      </div>
    </>
  );
}
```

The grabber is a hit area, not the bar: at least 24 px tall across the sheet's top (a 5 px bar
alone is too small for a finger), the bar drawn inside it. The same in every sheet recipe here:

```css
.grabber { height: 24px; display: grid; place-items: center; }
.grabber::before { content: ""; width: 36px; height: 5px; border-radius: 3px; background: currentColor; opacity: 0.25; }
```

React reuses the element when a sheet is reopened mid-exit (`usePresence` keeps it mounted), and
`useDrag` re-binds on `open`; for focus, key the effect on `open` too:
`useEffect(() => { if (open) sheet.current?.focus({ preventScroll: true }); }, [open]);` (with
`tabIndex={-1}` on the sheet).

Hand-made Vue sheet, complete (Vue 3.3+, `<script setup>`, in `src/components/`):

```vue
<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { drag } from "../lib/feel/drag";          // relative: plain Vite has no @/ alias
import { feelEnter, feelLeave } from "../lib/feel/vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const sheet = ref<HTMLElement | null>(null), backdrop = ref<HTMLElement | null>(null), grab = ref<HTMLElement | null>(null);
let opener: HTMLElement | null = null;

watch(() => props.open, async (open) => {
  if (open) { opener = document.activeElement as HTMLElement | null; await nextTick(); sheet.value?.focus({ preventScroll: true }); }
  else opener?.focus({ preventScroll: true });
});
// drag lives as long as the element: Vue nulls the ref when the sheet starts leaving, onCleanup stops it
watch(sheet, (el, _, onCleanup) => {
  if (el) onCleanup(drag(el, { axis: "y", dismiss: 1, handle: grab.value, fade: backdrop.value, onDismiss: () => emit("close") }));
}, { flush: "post" });
</script>

<template>
  <Transition :css="false" @enter="feelEnter" @leave="feelLeave">
    <div v-if="open" ref="backdrop" class="backdrop" data-feel="backdrop" data-feel-state="open" @click="emit('close')" />
  </Transition>
  <Transition :css="false" @enter="feelEnter" @leave="feelLeave">
    <div v-if="open" ref="sheet" class="sheet" role="dialog" aria-modal="true" aria-label="Filters" tabindex="-1"
         data-feel="sheet" data-feel-state="open" @keydown.esc="emit('close')">
      <div ref="grab" class="grabber" />
      …
    </div>
  </Transition>
</template>
```

Pass the hooks as they are (`@leave="feelLeave"`, not `@leave="(el) => …"`): Vue waits for `done`
only when the hook takes two arguments. `v-show` works the same way.

Hand-made Svelte sheet, complete (Svelte 5; in Svelte 4 the same with `export let` and `on:`):

```svelte
<script lang="ts">
  // Kit 1–2: "$lib/feel/…" · Kit 3+: "#lib/feel/drag.ts", "#lib/feel/svelte.ts" (§1, import paths)
  import { drag } from "$lib/feel/drag";
  import { enter, leave } from "$lib/feel/svelte";

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
  let sheet = $state<HTMLElement>(), backdrop = $state<HTMLElement>(), grab = $state<HTMLElement>();
  let opener: HTMLElement | null = null;

  // before the DOM changes: remember who opened it, give focus back when it closes
  $effect.pre(() => {
    if (open) opener = document.activeElement as HTMLElement | null;
    else opener?.focus({ preventScroll: true });
  });
  // focus in on every open: keyed on `open` too, because a reopen mid-exit reuses the same element
  $effect(() => { if (open && sheet) sheet.focus({ preventScroll: true }); });
  // drag while the element exists (onclose is read inside the callback, so it isn't tracked)
  $effect(() => {
    if (!sheet) return;
    return drag(sheet, { axis: "y", dismiss: 1, handle: grab, fade: backdrop, onDismiss: () => onclose() });
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div bind:this={backdrop} class="backdrop" data-feel="backdrop" data-feel-state="open" onclick={onclose} in:enter out:leave></div>
  <div bind:this={sheet} class="sheet" role="dialog" aria-modal="true" aria-label="Filters" tabindex="-1"
       data-feel="sheet" data-feel-state="open" onkeydown={(e) => e.key === "Escape" && onclose()} in:enter out:leave>
    <div bind:this={grab} class="grabber"></div>
    …
  </div>
{/if}
```

`in:enter` is required, not only `out:leave`: reopened mid-exit, Svelte 5 keeps the same element
and plays only its intro, and without `enter` it stays closed, off screen. Svelte 5.29+ can use
`{@attach}` on the sheet instead of the second `$effect`. Svelte's own `transition:fly` & co. on
the same element would fight the kit: remove them.

Also, for any hand-made dialog: move focus inside on open (the dialog itself with `tabIndex={-1}`,
or its first control), close on Escape, return focus to the trigger on close, and stop the page
behind from scrolling (`overscroll-behavior: contain` on the sheet's scroll area; lock the body if
the app already has a helper). Libraries above do all of this already.

### A hand-made menu (Vue, Svelte)

A menu opens out of its trigger (`--feel-origin` = the corner next to the trigger), focuses its
first item, moves with the arrow keys, closes on Escape and on a tap outside, and gives focus back to
the trigger (not after a tap outside: that tap put focus where the person meant it).
`.menu-wrap { position: relative; } .menu { position: absolute; top: calc(100% + 6px); right: 0; }`.

Vue (`src/components/SortMenu.vue`):

```vue
<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from "vue";
import { feelEnter, feelLeave } from "../lib/feel/vue";

const emit = defineEmits<{ pick: [value: string] }>();
const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null), menu = ref<HTMLElement | null>(null);
const items = () => Array.from(menu.value?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);

async function show() { open.value = true; await nextTick(); items()[0]?.focus(); }
function close(back = true) { if (!open.value) return; open.value = false; if (back) trigger.value?.focus(); }
function pick(value: string) { emit("pick", value); close(); }
function step(by: number) {
  const all = items(), i = all.indexOf(document.activeElement as HTMLElement);
  all[(i + by + all.length) % all.length]?.focus();
}
function outside(e: PointerEvent) {
  const t = e.target as Node;
  if (open.value && !menu.value?.contains(t) && !trigger.value?.contains(t)) close(false);
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
</script>

<template>
  <div class="menu-wrap">
    <button ref="trigger" aria-haspopup="menu" :aria-expanded="open" data-feel="press" @click="open ? close() : show()">Sort</button>
    <Transition :css="false" @enter="feelEnter" @leave="feelLeave">
      <div v-if="open" ref="menu" role="menu" class="menu" data-feel="pop" data-feel-state="open" style="--feel-origin: top right"
           @keydown.esc="close()" @keydown.down.prevent="step(1)" @keydown.up.prevent="step(-1)">
        <button role="menuitem" @click="pick('new')">Newest</button>
        <button role="menuitem" @click="pick('price')">Price</button>
      </div>
    </Transition>
  </div>
</template>
```

Svelte 5 (`SortMenu.svelte`):

```svelte
<script lang="ts">
  import { enter, leave } from "$lib/feel/svelte";   // Kit 3+: "#lib/feel/svelte.ts"

  let { onpick }: { onpick: (value: string) => void } = $props();
  let open = $state(false);
  let trigger = $state<HTMLButtonElement>(), menu = $state<HTMLElement>();
  const items = () => Array.from(menu?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);

  // keyed on `open` as well as `menu`: a reopen mid-exit reuses the element
  $effect(() => { if (open && menu) items()[0]?.focus(); });
  function close(back = true) { if (!open) return; open = false; if (back) trigger?.focus(); }
  function pick(value: string) { onpick(value); close(); }
  function keys(e: KeyboardEvent) {
    if (e.key === "Escape") return close();
    const by = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    const all = items(), i = all.indexOf(document.activeElement as HTMLElement);
    all[(i + by + all.length) % all.length]?.focus();
  }
  function outside(e: PointerEvent) {
    const t = e.target as Node;
    if (open && !menu?.contains(t) && !trigger?.contains(t)) close(false);
  }
</script>

<svelte:document onpointerdown={outside} />
<div class="menu-wrap">
  <button bind:this={trigger} aria-haspopup="menu" aria-expanded={open} data-feel="press" onclick={() => (open ? close() : (open = true))}>Sort</button>
  {#if open}
    <div bind:this={menu} role="menu" tabindex="-1" class="menu" data-feel="pop" data-feel-state="open" style="--feel-origin: top right"
         onkeydown={keys} in:enter out:leave>
      <button role="menuitem" onclick={() => pick("new")}>Newest</button>
      <button role="menuitem" onclick={() => pick("price")}>Price</button>
    </div>
  {/if}
</div>
```

### A full-screen sheet over the page (a player, a composer)

Rounded top corners (`border-radius: 38px 38px 0 0`), a scrim of about 40% that follows the drag
(`fade:`), and when a small thing opens it (a mini player, a thumbnail, a button with a picture), its
picture flies in with `morph` and flies back on close, also when the sheet is thrown away by a drag.
Plain JS, complete (`Feel.*` with feel.global.js, or the same names imported from the kit's js/):

```js
const player = document.querySelector("#player"), scrim = document.querySelector("#scrim");
const miniArt = document.querySelector("#miniArt"), playerArt = document.querySelector("#playerArt");
let opener = null;
function openPlayer() {
  opener = document.activeElement;
  Feel.show(scrim); Feel.show(player);
  Feel.morph(miniArt, playerArt, { within: player });   // the sheet is still rising: land where it rests
  player.focus({ preventScroll: true });
}
function closePlayer(flying = false) {
  if (!flying) Feel.morph(playerArt, miniArt);          // a drag already started it (onThrow)
  Feel.hide(scrim); Feel.hide(player);
  opener?.focus({ preventScroll: true });
}
Feel.drag(player, { axis: "y", dismiss: 1, fade: scrim, ignore: "button, input, [role=slider]",
  onThrow: () => Feel.morph(playerArt, miniArt), onDismiss: () => closePlayer(true) });
```

`show`/`hide` keep the exit on screen and cope with reopening mid-exit; the HTML is
`<div id="scrim" data-feel="backdrop" hidden>` and `<section id="player" role="dialog" aria-modal="true" data-feel="sheet" tabindex="-1" hidden>`.
Only morph a picture that is the same on both ends (the same cover, the same photo). With no small
thing on screen (opened from a menu), the sheet just rises.

## 5. Toasts

| the app uses | do this |
|---|---|
| **Sonner** | Keep it. `<Toaster position="bottom-center" duration={4000} />` (or top on phones if the app has a bottom bar); `swipeDirections` if needed. Don't add the kit's toast move. |
| **react-hot-toast / react-toastify / Chakra / MUI Snackbar** | Keep them. Check the duration (≥ 4 s) and that it isn't `role="alert"` for normal messages. |
| **Radix Toast** | `data-feel="toast"` on `Toast.Root` (it uses data-state). Radix handles swipe; set `swipeDirection`. |
| **Hand-made** | A host with `role="status" aria-live="polite"` that is always in the page; each toast `data-feel="toast"` (+ `data-feel-from="top"` if it sits at the top); `usePresence` or `settled()` before removing; `drag(toast, { axis: "x", dismiss: "both", onDismiss })` with `touch-action: pan-y` on the toast (or `axis: "y", dismiss: 1` and `pan-x` for a bottom toast); 4 s plus about 1 s per 15 words past ten; pause the timer on hover and focus; one at a time (a new one replaces the old). Vue and Svelte below. |

- **Replacing a toast**: the old one leaves while the new one arrives, so both are on the page for a
  moment. Put each toast `position: absolute` inside the host, so they overlap in one place instead
  of the new one stacking above or below the leaving one and jumping when it goes.
- **Centring**: a flex host (`justify-content: center`) or `margin-inline: auto` on the toast. Never
  `translate: -50%` (or `transform: translateX(-50%)`): the kit animates `translate`, so that toast
  would slide in diagonally and its centring is lost while it plays.
- **A bottom toast and a fixed tab bar**: the toast rises from `100% + 24px` below where it rests, so
  on the way in it crosses the bar. Give the toast host a **lower** `z-index` than the bar, so it
  comes out from under the bar instead of being drawn across it; and rest it above the bar
  (`bottom: calc(var(--tabbar-height) + 12px)`) so it can be read.

The host, for both recipes below (a bottom-centre toast):

```css
.toasts { position: fixed; inset-inline: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 40; pointer-events: none; } /* below the tab bar's z-index */
.toast { position: absolute; bottom: 0; inset-inline: 0; margin-inline: auto; width: fit-content; max-width: 420px; pointer-events: auto; touch-action: pan-y; }
```

Vue: a small store, so any component can call `toast("Saved")` (`src/lib/toast.ts`):

```ts
import { shallowRef } from "vue";

export type Toast = { id: number; text: string };
export const current = shallowRef<Toast | null>(null);
let n = 0, timer: ReturnType<typeof setTimeout> | undefined, left = 0, since = 0;
const holds = new Set<string>();

// 4 s, plus about 1 s for every 15 words past ten
const readingTime = (text: string) => 4000 + Math.max(0, text.split(/\s+/).filter(Boolean).length - 10) * (1000 / 15);
function run() { if (timer !== undefined || holds.size || !current.value) return; since = Date.now(); timer = setTimeout(() => dismiss(), left); }
function stop() { if (timer === undefined) return; clearTimeout(timer); timer = undefined; left -= Date.now() - since; }

export function toast(text: string) { stop(); holds.clear(); current.value = { id: ++n, text }; left = readingTime(text); run(); } // one at a time: it replaces the old
export function dismiss(id?: number) { if (id !== undefined && current.value?.id !== id) return; stop(); current.value = null; }
export function pause(why: "hover" | "focus") { holds.add(why); stop(); }
export function resume(why: "hover" | "focus") { holds.delete(why); run(); }
```

The host, once, in `App.vue` (`src/components/Toasts.vue`):

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { drag } from "../lib/feel/drag";
import { feelEnter, feelLeave } from "../lib/feel/vue";
import { current, dismiss, pause, resume } from "../lib/toast";

const el = ref<HTMLElement | null>(null);
// a new element for every toast (keyed): bind the swipe to it, stop it when it goes
watch(el, (node, _, onCleanup) => {
  const id = current.value?.id;
  if (node) onCleanup(drag(node, { axis: "x", dismiss: "both", onDismiss: () => dismiss(id) }));
}, { flush: "post" });
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <Transition :css="false" @enter="feelEnter" @leave="feelLeave">
      <div v-if="current" :key="current.id" ref="el" class="toast" data-feel="toast" data-feel-state="open"
           @pointerenter="pause('hover')" @pointerleave="resume('hover')" @focusin="pause('focus')" @focusout="resume('focus')">
        {{ current.text }}
      </div>
    </Transition>
  </div>
</template>
```

Svelte 5: the store (`src/lib/toast.svelte.ts`, runes need the `.svelte.ts` name):

```ts
export type Toast = { id: number; text: string };
export const toasts = $state<{ current: Toast | null }>({ current: null });
let n = 0, timer: ReturnType<typeof setTimeout> | undefined, left = 0, since = 0;
const holds = new Set<string>();

// 4 s, plus about 1 s for every 15 words past ten
const readingTime = (text: string) => 4000 + Math.max(0, text.split(/\s+/).filter(Boolean).length - 10) * (1000 / 15);
function run() { if (timer !== undefined || holds.size || !toasts.current) return; since = Date.now(); timer = setTimeout(() => dismiss(), left); }
function stop() { if (timer === undefined) return; clearTimeout(timer); timer = undefined; left -= Date.now() - since; }

export function toast(text: string) { stop(); holds.clear(); toasts.current = { id: ++n, text }; left = readingTime(text); run(); } // one at a time: it replaces the old
export function dismiss(id?: number) { if (id !== undefined && toasts.current?.id !== id) return; stop(); toasts.current = null; }
export function pause(why: "hover" | "focus") { holds.add(why); stop(); }
export function resume(why: "hover" | "focus") { holds.delete(why); run(); }
```

The host, once, in the root `+layout.svelte` (`{@attach}` needs Svelte 5.29+):

```svelte
<script lang="ts">
  // Kit 1–2: "$lib/…" · Kit 3+: "#lib/feel/drag.ts", "#lib/feel/svelte.ts", "#lib/toast.svelte.ts"
  import { drag } from "$lib/feel/drag";
  import { enter, leave } from "$lib/feel/svelte";
  import { toasts, dismiss, pause, resume } from "$lib/toast.svelte";
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts.current ? [toasts.current] : [] as t (t.id)}
    <div class="toast" data-feel="toast" data-feel-state="open" in:enter out:leave
         {@attach (el) => drag(el, { axis: "x", dismiss: "both", onDismiss: () => dismiss(t.id) })}
         onpointerenter={() => pause("hover")} onpointerleave={() => resume("hover")}
         onfocusin={() => pause("focus")} onfocusout={() => resume("focus")}>
      {t.text}
    </div>
  {/each}
</div>
```

The keyed `{#each}` (one item at most) gives every toast its own element, so the old one plays
its exit while the new one enters. `dismiss(id)` from a swipe only closes that toast, not one that
replaced it meanwhile. Errors that need an action: `role="alert"` on their own host, and no timer.

## 6. Page change

| setup | do this |
|---|---|
| **Next.js 16.3+ (App Router)** | No config. Create `app/template.tsx` (a template remounts on every navigation, so its `<ViewTransition>` enters and exits): `import { ViewTransition } from "react"; export default function Template({ children }) { return <ViewTransition enter={{ "feel-forward": "feel-forward", "feel-back": "feel-back", default: "feel-fade" }} exit={{ "feel-forward": "feel-forward", "feel-back": "feel-back", default: "feel-fade" }} default="none"><div>{children}</div></ViewTransition>; }` (if a template exists, wrap its content instead). Tag links: deeper → `<Link transitionTypes={["feel-forward"]}>`, up/back → `["feel-back"]`, tabs and anything sideways → no type (crossfade). `router.push(href, { transitionTypes: [...] })` too. The header in the layout stays outside, so it holds still. |
| **Next.js 16.2** | Same, plus `experimental: { viewTransition: true }` in `next.config`. (Tested on Next 16.2.7.) |
| **Next.js 13–16.1** | `app/template.tsx` that renders `<div data-feel="page">{children}</div>` (an arrival on every navigation; no exit, no direction). Say so in the hand-over. |
| **Next.js Pages Router** | Leave page changes alone, or the `data-feel="page"` arrival on the page root. |
| **React Router 6.22+ / 7, Remix** | `<Link viewTransition>` / `navigate(to, { viewTransition: true })`, and the `::view-transition-*(root)` rules in feel.css with `data-feel-nav` set by `go()` for direction; simplest is calling `go(() => navigate(to), "forward")`. |
| **SvelteKit** | `onNavigate` in the root layout with `startVT` from `nav.ts` (complete recipe below). |
| **Vue Router** (Vite + Vue) | A `router.beforeResolve` hook with `startVT` from `nav.ts` (complete recipe below): it covers `<RouterLink>`, `router.push` and the browser's back button. Don't wrap each `router.push` in `go()`. |
| **Nuxt** | `experimental: { viewTransition: true }` in nuxt.config (no direction), or the Vue Router recipe as a client plugin (`plugins/feel.client.ts`, `useRouter()`). |
| **Astro** | `<ClientRouter />` in the head, or the cross-document rule below. |
| **Plain multi-page site** | Add `@view-transition { navigation: auto; }` to every page's CSS. The transition is drawn by the **new** page, so set the direction there, in a script in its `<head>`: `addEventListener("pagereveal", (e) => { if (!e.viewTransition) return; const a = window.navigation?.activation; const back = a?.navigationType === "traverse" && a.from && a.entry.index < a.from.index; document.documentElement.dataset.feelNav = back ? "back" : "forward"; e.viewTransition.finished.finally(() => delete document.documentElement.dataset.feelNav); });` (for an "up" link like "← All items", mark it and check `document.referrer`, or use the page's depth). Chrome 126+, Safari 18.2+ (no Navigation API there before Safari 26: it slides forward); Firefox loads pages normally. |
| **Client-routed app, anything else** | `go(() => router.push(to), "forward")`; tabs: `go(() => setTab(t), "fade")`. |

Both recipes below take the direction from the path: deeper is forward, shallower is back, another
tab (also leaving a detail page through the tab bar) crossfades. Set `tabs` to the tab bar's roots
(`["/"]` if there is no tab bar). `startVT` sets `data-feel-nav`, clears it when the change ends
(unless a newer one started), and guards taps made while it plays.

**Vue Router**, complete. `src/lib/feel/router.ts`:

```ts
import { nextTick } from "vue";
import { START_LOCATION, type Router } from "vue-router";
import { startVT, type Way } from "./nav";

const tabs = ["/", "/search", "/library"];                                  // the tab bar's roots
const tabOf = (p: string) => tabs.find((t) => t !== "/" && (p === t || p.startsWith(t + "/"))) ?? "/";
const depth = (p: string) => p.split("/").filter(Boolean).length;
const way = (from: string, to: string): Way =>
  tabOf(from) !== tabOf(to) ? "fade" : depth(to) > depth(from) ? "forward" : depth(to) < depth(from) ? "back" : "fade";

export function feelRouter(router: Router): void {
  const landing = new Set<() => void>();
  // the new page is on screen once the route has changed and Vue has rendered it
  router.afterEach(() => nextTick(() => { landing.forEach((done) => done()); landing.clear(); }));
  router.beforeResolve((to, from) => {
    if (from === START_LOCATION || to.path === from.path) return;            // first load, or only query/hash changed
    return new Promise<void>((resolve) => {
      // the old page is captured; now let the router go on, and finish the update when it has landed
      const vt = startVT(() => new Promise<void>((done) => { landing.add(done); resolve(); }), way(from.path, to.path));
      if (!vt) resolve();                                                     // no View Transitions: it just changes
    });
  });
}
```

`src/main.ts`:

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { feelRouter } from "./lib/feel/router";
import "./style.css";
import "./lib/feel/feel.css";                                   // after the app's own CSS
document.addEventListener("touchstart", () => {}, { passive: true }); // iOS :active
feelRouter(router);
createApp(App).use(router).mount("#app");
```

And the tone on `<html>` in `index.html`. Remove any `<Transition>` the app wraps around
`<RouterView>` for page changes: it fights the View Transition.

**SvelteKit**, complete. `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  // Kit 1–2: "$lib/feel/…" · Kit 3+: "#lib/feel/feel.css", "#lib/feel/nav.ts" (§1, import paths)
  import "$lib/feel/feel.css";
  import { onMount } from "svelte";
  import { onNavigate } from "$app/navigation";
  import { startVT, type Way } from "$lib/feel/nav";
  let { children } = $props();

  const tabs = ["/", "/search", "/library"];                                // the tab bar's roots
  const tabOf = (p: string) => tabs.find((t) => t !== "/" && (p === t || p.startsWith(t + "/"))) ?? "/";
  const depth = (p: string) => p.split("/").filter(Boolean).length;

  onNavigate((n) => {
    const from = n.from?.url.pathname, to = n.to?.url.pathname;
    if (!from || !to || from === to || !document.startViewTransition) return;
    let way: Way = "fade";                                                   // another tab
    if (tabOf(from) === tabOf(to)) {
      const d = depth(to) - depth(from);
      way = d > 0 ? "forward" : d < 0 ? "back"
        : n.type === "popstate" ? ((n.delta ?? 0) < 0 ? "back" : "forward") : "fade"; // the browser's back/forward
    }
    return new Promise<void>((res) => { startVT(async () => { res(); await n.complete; }, way); });
  });
  onMount(() => { const t = () => {}; document.addEventListener("touchstart", t, { passive: true }); return () => document.removeEventListener("touchstart", t); });
</script>

{@render children()}
```

The tone goes on `<html>` in `src/app.html`. `::view-transition-*` rules (the still header, the
shared element) go in a global CSS file, not a component `<style>` (or wrap them in `:global(...)`).

- Browser support: same-document View Transitions Chrome 111, Safari 18, Firefox 144 (types:
  Chrome 125, Safari 18.2, Firefox 147). Without support the page changes normally: no fallback code.
- Plain JS with a hash router: `hashchange` fires after the URL changed but before your render, so
  wrap the render: `addEventListener("hashchange", (e) => go(route, way(e.oldURL, e.newURL)))`, where
  `way` says "forward" when the new route is deeper, "back" when it is shallower, and "fade" when
  it's another tab (also when you leave a detail page through the tab bar). Same for History API
  routers on `popstate`.
- When a shared element carries the change, the rest of the page should not slide (principles,
  Page change): give that navigation its own type (`go(update, "fade")`, or a `feel-morph` type
  in React) so the root crossfades while the picture morphs.
- Keep the header and tab bar still: give them `view-transition-name: site-header` (or React
  `style={{ viewTransitionName: "site-header" }}`) and `::view-transition-group(site-header) { animation: none; }`.
- Shared element (card → detail): the same `view-transition-name` (React: `<ViewTransition name={"item-" + id} share="feel-morph">`)
  on the thumbnail and on the detail image. Only where it is literally the same picture, and
  **not under reduce motion**: then give no name (React: render it without `name`), and the page
  only crossfades (feel.css also stops named groups flying under reduce, as a backstop). It is
  on-screen to on-screen, so it moves with **ease-in-out** (with ease-out nearly all of it happens
  in the first frames and the morph doesn't read). What makes it look right:
  - `::view-transition-group(.feel-morph) { animation-duration: var(--feel-slow); animation-timing-function: var(--feel-in-out); }`
    (plain apps: name the group, e.g. `::view-transition-group(hero)`).
  - Different crops of the same photo: `::view-transition-old(.feel-morph), ::view-transition-new(.feel-morph) { inset: 0; width: 100%; height: 100%; object-fit: cover; }`
    and `::view-transition-image-pair(.feel-morph) { overflow: clip; }`: each snapshot fills the
    moving box and is cropped like the real picture (no empty sides on the way back, no double image
    sliding over itself).
  - The same picture on both ends (the same cover): show only the new one, or the crossfade between
    two identical snapshots washes it out halfway:
    `::view-transition-old(.feel-morph) { display: none; } ::view-transition-new(.feel-morph) { animation: none; }`.
  - Rounded card → square hero: animate `border-radius` on the **image pair**, never the group (an
    `animation` on the group replaces the browser's own move-and-resize, and the morph is lost):
    `::view-transition-image-pair(hero) { animation: hero-corners var(--feel-slow) var(--feel-in-out) both; }`
    with `@keyframes hero-corners { from { border-radius: 18px; } to { border-radius: 0; } }` (the
    other way round going back).
  - Things that sit on the photo on the detail page (a panel, buttons) need their own names, or
    they hide under the morph and pop in at the end. Fade the buttons in late.
  - Open the page strips to check it: the numbers can't see layering or a double image.
  - Plain JS, complete (the name must be on exactly one element on each side, both on screen):
    ```js
    function openAlbum(card, id) {
      const cover = card.querySelector("img");
      const name = matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : "hero"; // reduce: crossfade only
      cover.style.viewTransitionName = name;                         // old side, before the change
      go(() => {
        cover.style.viewTransitionName = "";
        history.pushState(null, "", "#/album/" + id); route();      // render now (pushState fires no hashchange)
        document.querySelector(".album-cover").style.viewTransitionName = name; // new side
      }, "fade").finally(() => { const c = document.querySelector(".album-cover"); if (c) c.style.viewTransitionName = ""; });
    }
    ```
    Back is the mirror: name the big cover, go back, name the card's cover (find it by id).
- The browser's own back button and swipe-back carry no direction type: they crossfade. That's fine.
- React's `<ViewTransition>` does not check reduced motion; feel.css's reduced-motion keyframes do
  (pages become fades, named groups stop flying).

## 7. Drag

`drag(el, options)` (or `useDrag(ref, options, active)` in React) from the kit:

| thing | options |
|---|---|
| bottom sheet | `{ axis: "y", dismiss: 1, handle: grabberOrHeader, fade: backdrop, onDismiss: close }` |
| side drawer (right) | `{ axis: "x", dismiss: 1, fade: backdrop, onDismiss: close }` (left: `dismiss: -1`) |
| toast | `{ axis: "x", dismiss: "both", onDismiss: remove }` or bottom: `{ axis: "y", dismiss: 1, … }` |
| sheet with a half and a full height | `{ axis: "y", dismiss: 1, snaps: [-(fullHeight - halfHeight)], onSettle }` |
| a card that only wiggles back (playful) | `{ axis: "x" }` (no dismiss: it always returns) |
| a row you swipe to reveal an action (Play Next, Delete) that runs past a line | `{ axis: "x", min: -96, max: 0, ignore: "", onMove: (x) => (pastLine = x < -70) }`, run the action on release when `pastLine`; the row springs back by itself (no `dismiss`) |
| keep the app's own threshold or speed | `distance` (share of its size, default 0.3), `speed` (px/ms, default 0.45) |
| don't start on some parts | `ignore: "button, input, [role=slider]"` (replaces the default list) |
| start something the moment it is thrown (a picture flying home) | `onThrow` (fires on release; `onDismiss` fires when it is off screen) |

- A grab handle needs a hit area at least **24 px** tall (the whole width of the sheet's top, or
  ≥ 44 px wide): a 5 px bar alone is too small for a finger. Draw the bar inside it (`.grabber` in §4),
  or make the sheet's whole header the handle.
- The handle gets `touch-action: none` from the kit (`data-feel-handle` is set for you). When the
  **whole element** is the handle (no `handle` option: a toast, a sheet without a grabber), give it
  `touch-action: none` yourself (`pan-x` for a vertical drag, so sideways scrolls still go through;
  `pan-y` for a sideways one like a toast swipe, so the page still scrolls), or phones start
  scrolling the page and cancel the drag. Exception: a sheet with
  a scrolling list inside: leave the list alone; the kit moves the sheet only when the list is at
  its top.
- A thrown sheet sets `data-feel-dragged="out"` so its CSS exit doesn't play a second time; the kit
  resets it when the sheet opens again.
- Carousels: prefer CSS scroll snapping (`scroll-snap-type: x mandatory`) over a JS drag: the
  browser's own momentum is the best drag there is.
- Don't put a drag on anything that already scrolls in the same direction.
- The click that ends a drag is eaten by the kit (a drag is not a tap). If the app already had its
  own "skip the next click after a swipe" flag, remove it or clear it right after the swipe, or the
  next real tap on that element is lost.

## 8. Vue, Svelte, Angular, Solid

The CSS moves work anywhere (they read attributes). Vue: `vue.ts` hooks, the sheet and menu in §4,
the toast host in §5 and the router in §6. Svelte/SvelteKit: `svelte.ts` transitions, the sheet and
menu in §4, the toast host in §5 and `onNavigate` in §6.
Angular, Solid and the rest: `drag`, `settled`, `go` and `startVT` are plain functions: call them
from `ngAfterViewInit`/`onMount` and run the cleanup on destroy. For exits, set
`data-feel-state="closed"`, `await settled(el)`, then remove the element. In every framework,
component-scoped styles beat the kit: see §3 (press) and §1 (global, not scoped).
