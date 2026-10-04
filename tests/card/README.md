# July Oven card test pages

Browser test pages for `custom_components/june_oven/www/july-oven-card.js`. They load the real card file
with a mock Home Assistant (`hass`), so the card can be checked without an oven or a Home Assistant install.

Serve the repository root with any static server, then open the pages:

```bash
python -m http.server 8000
```

- **http://localhost:8000/tests/card/index.html**: every state (off, preheating, ready, cooking with
  a timer, probe cook, done, offline) at the standard 12 × 6 size, the wall-tablet size and the
  compact one-row size, plus several ovens with icons and a card outside a sections grid. Each card
  sits in a box the size of its Home Assistant grid cells. Service calls are listed at the bottom.
  - `?w=500,358,320` sets the section widths to draw (Home Assistant sections are 320–500 px).
  - `?theme=auto|light|dark` sets the card's look; `?ha=light` uses Home Assistant's light theme.
  - In the browser console, `fitCheck()` returns everything that spills out of its card box or has
    clipped text. It should return `[]`.
  - The sheets open in a layer over each card: tap an oven's icon (the oven menu), **Camera** (the
    camera window, showing the bench's still picture), **Settings**, or a mode tile (the review,
    with its slider and typed temperature). Escape or × closes them. Settings are kept in
    `localStorage`; clear it to go back to each card's config.
- **http://localhost:8000/tests/card/registry-swap.html**: replaces `window.customElements` after the
  card loads, the way a scoped-registry polyfill does in Firefox. After about 2 seconds,
  `customElements.get("july-oven-card")` should return the card class and `SWAP.rebuilt` should be `true`.

Check every change at 500, 358 and 320 px, in all three looks, before releasing.
