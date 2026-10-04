# Concept harness

Neutral tooling for drawing card concepts inside real Home Assistant grid boxes. It contains no design.

## Files
- `harness.js` — exposes `window.HX`: grid maths (`frame`, `cardH`), sample oven states `HX.S` (keys in
  `HX.STATE_ORDER`: off, preheat, ready, cooking, cookingProbe, doorOpen, done, offline), a second oven
  `HX.GARAGE`, graph data `HX.HISTORY`, cook modes `HX.MODES`, a 4:3 camera still `HX.cameraStill(s)`
  (an `<svg>` that fills its box; letterbox it yourself to keep 4:3), and `HX.checkFit()`.
- `preview.html?c=<id>` — loads `../concepts/<id>.js` and draws every size × state, several ovens, and the
  detail view, with look (Match HA / Light / Dark), HA page theme, and section width (500 / 358) switches.
  It prints overflow problems at the top. Served at http://localhost:8131/harness/preview.html?c=<id>.

## Concept contract (`concepts/<id>.js`)
```js
window.CONCEPTS["<id>"] = {
  name: "Concept name",
  css: `/* all rules scoped under .c-<id> */`,
  // grid size per card size: [columns, rows] or [columns, rows, sectionSpan]
  sizes: { standard: [12, 6], wall: [24, 8, 2], compact: [12, 1] },
  // Return the card's inner HTML. Root element: <div class="c-<id> ..."> filling 100% × 100%.
  // opts = { size, theme: "auto"|"light"|"dark", width: section px }
  render(s, opts) { return "..."; },
  // Optional: several ovens in one card. ovens = [state, state]; return frames via HX.frame(...)
  multi(ovens, opts) { return HX.frame(html, 12, 7, opts.width, 1, "caption"); },
  // Optional: the detail view (HA dialog, ~420 px wide, free height). pages listed in detailPages.
  detailPages: ["now", "graph"], detail(s, { page, theme }) { return "..."; },
  // Optional: wire interactions after render (no requestAnimationFrame/smooth scroll: the preview
  // pane may be hidden). root = container element.
  wire(root) {}
};
```
Rules: the root must fill the `.hx-card` box and nothing may spill out of it at 358 or 500 px. Mark an
intentional horizontal pager's scroller with `data-hx-scroll` so the fit checker ignores off-screen pages.
"Match HA" must read HA variables (`--primary-text-color`, `--card-background-color`,
`--secondary-text-color`, `--divider-color`, `--ha-card-border-radius`, …). Fonts: Google Fonts via
`@import` at the top of `css` is fine.
