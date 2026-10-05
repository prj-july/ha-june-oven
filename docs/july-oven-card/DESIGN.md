# July Oven card: design record

The July Oven card is the Home Assistant dashboard card for the June oven, served by this
integration (`custom_components/june_oven/www/july-oven-card.js`). Its design is called
**Still Glass**: it should feel like the oven's own glass screen, and stay calm.

This document records what the card does and why, how the design was reached, and what is still
open. The card file itself is the source of truth for the code; edit it directly.

- [brief.md](brief.md): the needs and wants every design had to meet
- [research/](research/): the three research reports behind the fresh study
- [study/index.html](study/index.html): the Glass study page, with all three concepts drawn live in
  Home Assistant grid boxes (open it from a local web server, see [README.md](README.md))
- [study/concepts/](study/concepts/): each concept's spec and mockup code; `d2.md` is Still Glass,
  with its full revision log
- [archive/first-study.html](archive/first-study.html): the first study, kept as history
- [../../tests/card/](../../tests/card/): test pages for the real card file

## How the design was reached

1. **First study (2026-09-26 to 27).**
   - Five directions were drawn and scored: Tile, Glass, Status line, Window and Timeline.
   - The lead chose Glass, a dark ring with a big number, over the higher-scoring Status line.
   - Request by request, Glass gained a ring, a side camera, bars, swipe pages, oven chips, a graph
     page and a header camera. The lead called the result *Schlimmbesserung*: improvements that
     made it worse. Nothing had been taken away to make room for each addition.
2. **Fresh study (2026-09-27).**
   - Only the requirements ([brief.md](brief.md)), the June look, and the *idea* of Glass were kept.
   - Three new research reports were written: [R1](research/r1-june-glass.md) on what June's own
     screen does, [R2](research/r2-glance-budget.md) on what fits a glanceable surface, and
     [R3](research/r3-comparables.md) on how comparable products do it.
   - Three designers who had never seen the first study each drew one concept: **Second Screen**
     (the oven's own rings), **Still Glass** (budget first) and **Door** (the oven's front).
   - Every concept had to plan each state before drawing anything: its one job, what goes on the
     card, what is one tap away, and what becomes a notification.
   - Scores (glanceable 20, safety 15, June feel 15, calm 15, camera 10, older adults 10,
     HA-native 5, sizes 5, cost 5): Second Screen 4.08, **Still Glass 4.33**, Door 4.23.
   - Still Glass was recommended because it meets every must-have without stretching one. Door was
     at risk on "status first, camera second", because its camera wins the first glance.
3. **Revisions with the lead (2026-09-27 to 28)**: see the decision log below.
4. **Built (2026-09-28)** as a plain web component with no build step, served by the integration
   ([PR #3](https://github.com/prj-july/ha-june-oven/pull/3)). It was then made robust for Firefox
   ([PR #4](https://github.com/prj-july/ha-june-oven/pull/4)).

## The rules every state follows

From the brief and R2, checked on every change:

- **One job per state.** At most: 1 large number; 1 status (word + shape + colour, never colour
  alone); 1 time estimate; 2 supporting facts; the camera; 1 main action; 1 quiet button group
  (3 buttons or fewer). At most 5 kinds of element, and one paging system at most.
- **Stop:** one tap, never confirmed, always visible while the oven heats.
- **Starting is deliberate:** a review with outcome-labelled buttons that closes itself after
  5 minutes, following the UL 1026 remote-programming window. Nothing heats on one tap.
- **Camera:** in every size and state, never inside a ring, an uncropped 4:3 frame labelled with
  its age, and never auto-playing.
- **Targets:** 48 px or larger, for older adults.
- **Contrast:** WCAG 2.2 AA in all three looks.
- **Swipe:** never the only way to do anything.
- **Fit:** the card fits its fixed Home Assistant grid box at any section width from 320 to 500 px.
- **New features:** they take an existing place or go one tap away. If a request would add a new
  kind of element, something else leaves.

## The design as built

**Sizes.** Chosen from the card's box, or set with `display_mode`:

- **Standard:** 12 × 6.
- **Wall tablet:** full width × 8.
- **Compact:** 12 × 1.
- **Several ovens:** one extra row per extra oven.

**A running oven (standard size)**

| Place | What sits there |
|---|---|
| Top left | The oven's name (22 px; 33 px on the wall), with its icon if one is set |
| Top right | **Stop**: red (#c62828, white label 5.6:1), exactly as wide as the camera. With several ovens it reads "Stop / Kitchen" |
| Under the header | The large number in Barlow Condensed, with the degree sign at half size. Under it, the status mark, word and a short unit-free qualifier ("· left", "· holding", "· food · target 145°") |
| Then | The progress bar (heat line), then two short lines (projection, facts) |
| Right column | The camera, 4:3 and uncropped, spanning from the top of the degree sign to the foot of the bar. A corner label reads **LIVE**, or the picture's age in amber |
| Bottom band | **+1 · +5 · +10 min**, only while a timer runs: drawn 36 px tall with a 48 px tap area, well away from Stop |

The number, bar and camera sit at the same height in every running state: preheating, ready,
cooking, probe cook, door open, done and offline. The group is anchored under the header rather
than centred, so text that wraps, or the quick-add buttons, never shift it.

The camera's size follows the number group, not the card's width, so both edges line up in any
box from 358 px wide, however tall. The number gives up at most 10% of its size to make that fit
and never runs into the camera. Timers over an hour ("1:05:00") use a smaller number in the same
box. Below about 340 px, where two status lines are kept free, the camera keeps its foot on the bar
and starts a little lower. On the wall size the camera is still taller than the number group.

**States**

| State | Mark | Number | Bar |
|---|---|---|---|
| Preheating | ↑ up arrow | oven temperature | blue to ember |
| Ready | ✓ in a ring | "holding" | full |
| Cooking | orange flame | time left, or food temperature in a probe cook | ember |
| Done | filled ✓ | the words "Take food out", with **Food is out** to dismiss. Done lasts 30 minutes after the oven reports the cook completed | green |
| Offline | dashed ring | last values, dimmed, with their age | grey dashes |

The **door open** mark (amber triangle, "heating paused") is designed, but the oven does not
report its door yet.

**Idle (off).**

- The oven's home screen: a centred clock (no AM/PM, as on the oven) and the date, with the
  oven's icon and name at the top left.
- Square glowing mode tiles in two rows. Every margin is the card's padding (16 px, 28 px on a
  wall tablet), measured to the ink: the icon's drawing and the clock's digits at the top, the
  outer tiles at the sides, the labels at the bottom. Spare height goes between the date and the
  tiles; on a wall tablet's single row the tiles sit midway instead.
- The card offers the five modes Home Assistant can start: Bake, Roast, Broil, Air fry and Toast.
  These plus **Camera** and **Settings** (the last tiles, in grey glass) fit 4 × 2 on one page.
- **Camera** opens a floating window inside the card with the camera at the chosen frame rate
  and × to close. While the oven is off it says "Camera off": Home Assistant answers 503 for a
  camera that is off.
- **Settings** opens in the card: appearance, camera frame rate, the name, cook mode order, the
  clock, icons, and a link to the oven's device page. Icons have one row per June oven in Home
  Assistant, each with its icon (lit as on the card), name, state and a Change button; the open row
  (the current oven at first) is outlined in ember and labels its grid and `mdi:` field "Icon for
  <oven>". The card's version shows at the foot of Settings. Choices are kept per browser; YAML
  is the default.
- **Most used first** (off by default) orders the mode tiles by the cooks started from the card,
  counted per oven in that browser when Start succeeds. Ties keep the oven's order; Camera and
  Settings stay last. Reset clears the settings but keeps the counts.
- A mode tile opens the review:
  - the temperature, set with a slider (the oven's min, max and step), − and +, or by typing it
    into the number (snapped to the step and clamped on Enter or leaving the field);
  - the warning "Make sure the oven is empty and the door is closed";
  - a countdown;
  - **Start preheating** (with several ovens, "Start preheating Kitchen").

**Looks.**

- **Match Home Assistant** (the default) reads the theme's variables.
- **Light** and **Dark**. Dark is the oven's own black glass.
- Fonts: Barlow Semi Condensed for words, Barlow Condensed for numbers. Both are open-licence
  stand-ins for June's DIN Next, loaded from Google Fonts unless `load_fonts: false`.

**Several ovens.**

- **Focus:** the focused oven gets the full card. That is the one picked last (remembered per
  browser for that set of ovens), otherwise the first that is heating, otherwise the first listed.
- **Other heating ovens:** each gets a row in dimmed text, with its own red Stop in the camera
  column at the same width as the top Stop.
- **Ovens that are off:** they share one row of small pills.
- **Switching:** tapping a row or pill focuses that oven.

**The oven's icon.** Every oven has one (`oven` by default). It is the oven's lamp: orange with
a glow while it heats, the text colour (white on the glass) while it is off, grey when offline.
It replaces the idle "Off" mark. On the home screen (the mode tiles) the name beside it tucks into
the icon 5 s after the screen appears or another oven is picked, and comes back on hover, keyboard
focus, or with the menu open. During a cook (preheating to done, and offline) the name always
shows. Tapping
it opens a menu of every June oven in Home Assistant, each with its lamp, name and state; picking
one shows it (an oven the card doesn't list takes the first oven's place).

**Oven icons.** Pick from a set of 12 (oven, kitchen, house, garage, basement, apartment, cabin,
patio, office, camper, bread, star), or use any `mdi:` icon. The icon shows next to the oven's
name, in its row, and on its pill.

**Refusals.** The oven's refusals are shown in plain words:

- `session-start-disabled`: "Remote start is off on this oven. Turn it on at the oven:
  Settings › App permissions."
- `door-open`: "Close the oven door, then try again."
- Cleaning, not ready, and food or a probe in the oven get their own messages.

## Decision log

| Date | Decision | Why |
|---|---|---|
| 09-27 | Restart from the brief; keep only the idea of Glass | Additions without a budget had made the card worse |
| 09-27 | Still Glass over Second Screen and Door | Meets every must-have, reads fastest, calmest; Door's camera wins the first glance |
| 09-27 | Several ovens: one card per oven by default, optional focus + rows | All three designers arrived at it independently; a heating oven is never hidden |
| 09-27 | Ovens that are off share one row of pills | Three ovens no longer cost a grid row each |
| 09-27 | Name top left; status under the number; no repeated °F; half-size degree sign | Lead's review: clearer hierarchy, less noise |
| 09-27 | Red Stop at the top right, exactly the camera's width, on the name's line | Lead's preference; Stop is never next to the add-time buttons |
| 09-27 | Up arrow for preheating; dimmed text for other ovens' rows | Taken from Second Screen at the lead's request |
| 09-27 | Camera top level with the top of the degree sign | Lead's request; measured against the font's ink, not its box |
| 09-27 | Barlow Semi Condensed for words | Matches Second Screen; closer to the oven's tight labels |
| 09-28 | One LIVE/age pill style on every camera | Consistency between the main camera and other ovens' rows |
| 09-28 | Other ovens' Stop under the camera, at the same width as the top Stop | Lead's request; Stops line up in one column |
| 09-28 | Flame for cooking (from Second Screen), in orange | Lead's request |
| 09-28 | Short +1/+5/+10 in the bottom band; group anchored, not centred | Nothing moves between states |
| 09-28 | Two rows of idle tiles, centred between the date and the dots | Lead's request; tiles size to both width and height |
| 09-28 | Start names the oven; the picked oven is remembered; per-oven icons | Lead's requests (temperature on off pills declined as too verbose) |
| 10-03 | Re-check registration every 2 s (v0.3.1) | Firefox: another card's scoped-registry polyfill replaced `window.customElements` after the card loaded |
| 10-03 | Size the camera from the number group (v0.3.2) | On boxes other than 12 × 6 at 500 px the camera ended up to 48 px short of the bar |
| 10-03 | Keep the repository name `ha-june-oven`, domain `june_oven`, name "June Oven" | Drop-in replacement for upstream jclima/ha-june-oven; easy to merge upstream fixes |
| 10-04 | The icon is the oven's lamp and opens an oven menu; the name tucks into it after 5 s on the home screen only; no idle "Off" mark (v0.4.0) | Lead's request: calmer top row, every oven one tap away |
| 10-04 | Camera becomes a tile and opens a floating window in the card | Lead's request: Home Assistant's camera dialog offered a broken snapshot download while the oven was off |
| 10-04 | Settings open in the card, kept per browser | Lead's request: the device page's sensor list was not settings |
| 10-04 | Review gets a slider and a typed temperature | Lead's request |
| 10-04 | Optional "most used first" order for the mode tiles, counted on Start | Lead's request; a review opened and cancelled is not a use |
| 10-04 | Equal margins on every side, measured to the ink | Lead's request: the gap above the name read tighter than the sides and bottom |
| 10-04 | Oven icon rows name the oven they edit, with state and Change/Done; version in Settings (v0.4.2) | Lead's feedback: the picker read as a generic icon picker |
| 10-04 | Sheets (review, settings, camera, menu) in their own layer over the card | Re-renders would otherwise interrupt a slider drag or typing |
| 10-04 | Camera edge: a faint inside ring like the tiles, Stop-matched corners; empty pictures hidden (v0.4.1) | Lead's pick over borderless; the uneven ring was Chrome's outline around an empty image, clipped by the corners |
| 10-04 | Re-check registration every 50 ms for the first 30 s, then every 2 s; a loading panel fades in after 0.3 s if nothing has rendered; settings read safely before setConfig (v0.4.3) | Lead's report: the card was blank for a few seconds after a refresh. Home Assistant's own app installs a scoped-registry polyfill after the card file runs, and Lovelace waits for the new registry, so the card waited for the next 2 s check. In that state the card was attached without a config and its tap handlers never attached |
| 10-04 | A cut-off oven name scrolls (back and forth, about 40 px/s, edges faded) while hovered or focused; only when it overflows; not with reduced motion (v0.4.3) | Lead's request: a long name was unreadable even on hover |
| 10-04 | Camera frame rate 1, 5, 10 or 15 fps, default 15, noting 1 fps is the stock June app; card pictures refresh at most once a second, only the camera window runs faster (v0.4.4) | Lead's request. The oven sends about one new still a second, so higher rates mostly re-fetch the same picture; capping the card's small pictures keeps the default from loading 5 pictures a second whenever a cook is on screen |
| 10-05 | Wall layout: oven and food temperature graph for the current cook (at most the last hour) under the camera, from Home Assistant's recorder plus live readings; target as a dashed line; tap opens more-info (v0.4.5) | Lead asked about the graph (a SHOULD in the brief) and it had only existed in the study; under the camera it never meets the +1/+5/+10 chips |
| 10-05 | Dark is the default look; new cards write theme dark, size automatic and Barlow fonts on, so the editor shows them; in a panel view the glass runs to the bottom of the window (above the edit bar while editing) (v0.4.6) | Lead's requests. A missing toggle reads as off in Home Assistant's editor, so the defaults are written into new cards |

## Open questions

- **Add time.** `june_oven.add_cook_time` sends 11006 with *time left + minutes*. It is
  unverified whether the oven reads `duration` as time left or as the step's total. Read as a
  total, the cook gets shorter, never longer. Check **Time remaining** after +1.
- **Door state.** The oven cuts its elements while the door is open, so it knows. But the door is
  not in the captured telemetry: june-local needs to report it. Until then there is no door-open
  state and no door marks on graphs.
- **Camera turn-on.** june-local's camera wake endpoint is unverified, so the camera window shows
  "Camera off" without a Turn on button.
- **Camera rate.** The window asks Home Assistant for a picture at the chosen rate, but the oven
  only sends a new picture now and then; how often is unmeasured.
- **Temperature graph.** The wall layout shows oven and food temperature for the current cook
  under the camera (v0.4.5); the full history is one tap away in Home Assistant's more-info. Door
  bands need a door sensor, which the integration doesn't have yet.
- **Undo after adding time.** This is in the design, not built: the action has no negative step.
- **Remote start.** Only Bake is proven on a real oven. The card offers the five modes the
  integration can send.
- **Fonts.** These load from Google Fonts by default. Bundling them would keep the card fully local.

## Checking a change

1. Open [tests/card/index.html](../../tests/card/README.md) and check every state at 500, 358 and
   320 px in all three looks. `fitCheck()` must return `[]`.
2. Click through Stop, add time, the start review (slider, typing, − and +, a refused start),
   Settings (each choice, reload to see it kept), the camera window (Escape and ×), the oven
   menu, switching ovens, the name tucking and coming back on hover, and the remembered oven. Each must send the expected service call
   (listed at the bottom of the page).
3. For changes to the integration's setup, run the unit tests and the config-flow tests against
   Home Assistant. See [MAINTAINER.md](../../MAINTAINER.md) and the `tests/` folder.
