# July Oven card: the brief (needs and wants)

> The input to the fresh Glass study (2026-09-27). The design that came out of it, and every decision since, is in [DESIGN.md](DESIGN.md).

Written 2026-09-27. This is the ONLY design input the fresh study carries over. All earlier layouts,
candidates and layout decisions are discarded. What is kept: these requirements, the research
evidence, and the *idea* of "Glass" (defined in section B), to be rethought from the ground up.

Priority key: **MUST** (hard constraint, fails the design if missed) · **SHOULD** (strong want,
explicitly asked for by the project lead or strongly evidence-backed; deviate only with a reason) ·
**COULD** (nice to have). Source key: [Lead] = the project lead asked for it · [Safety] ·
[HA] = Home Assistant platform constraint · [June] = continuity with the June oven/app ·
[Evidence] = UX research · [Data] = what the oven can actually report.

---

## A. What this is

Project July keeps June smart ovens working locally after Weber shut down the June cloud on
22 Sept 2026. A local server (`june-local`) runs on the oven; a Home Assistant (HA) integration
talks to it. We are designing the **Home Assistant dashboard card** ("July Oven card") that people
use to watch and control their June oven, plus whatever detail view it opens.

Users: households with a June oven, including older adults; used on phones, desktops, and wall
tablets read from 2–3 m away. Some households have more than one oven.

## B. "Glass" — the idea to keep (and nothing else from the old designs)

Glass = the card should feel like looking at **the June oven's own glass touchscreen**: a dark glass
surface, warm glowing elements, big clear numbers, June's calm cooking screen. The old Glass
layout (ring + side camera + tiles etc.) is NOT carried over; rethink how to express the glass idea.

- MUST [Lead] The card looks and feels like June (oven screen + app), while using July's own
  identity: no June wordmark, no June carrot orange as a brand colour, no copying June's
  commercial fonts (DIN Next, Tiempos). Use a similar open font (the lead asked for "the June app
  font or a similar open font").
- MUST [Lead] Light and dark options: Match Home Assistant (default, follows the viewer's HA theme),
  Light, Dark (dark = the oven's glass).
- The June oven's actual on-screen language (facts, from the decoded app and oven screens):
  black glass screen; centered clock and date at top of the home screen; home screen = pages of
  **square glowing tiles** (one per cook mode, icon shows which heating elements are on) that you
  **swipe left/right with dot page indicators**; Settings is a grey tile after the cook modes
  (then Clean, Connect); cooking screens show a large temperature/time with a progress ring.

## C. Platform constraints (Home Assistant)

- MUST [HA] Sections view grid: a section is 320–500 px wide, 12 columns, rows 56 px, gaps 8 px.
  A card's size is fixed by its grid cells: height = rows×56 + (rows−1)×8. The card does NOT
  resize to its content; content must fit the box it is given at any section width 320–500 px.
  The user picks the size by dragging; the card declares sizes via `getGridOptions`.
- MUST [HA] Needs a standard size (phone/desktop), a large size for wall tablets (may span two
  section columns), and a one-row compact size. Every size must include the camera (see D).
- MUST [HA] Root is `ha-card`; colours come from HA theme variables with July fallbacks; a visual
  card editor exists; feels native next to other HA cards.
- SHOULD [HA] A detail view (HA "more-info"-style dialog) can hold what doesn't fit the card.

## D. Camera

- MUST [Lead] The camera view/feed is part of **every** design and **every** size.
- MUST [Lead] The camera is NOT placed inside a temperature ring (the lead rejected that).
- MUST [Evidence] Uncropped 4:3 frame (the oven camera's aspect), a still that refreshes (≤ every
  2 s), labelled with its age ("Live", "3 min ago"); live video only when expanded, time-boxed
  (5 min), never auto-plays. Status stays primary; the camera is secondary.
- MUST [Data] When the oven is idle the camera is off; show an honest "Camera off" state with a
  way to turn it on (it runs for a limited time).
- [Lead, aesthetic] The lead found "cook-mode tiles squeezed to one side with the camera window
  next to them" aesthetically unpleasing.

## E. States the card must handle [Data]

Off (idle) · Preheating (current → target temp, estimate) · Ready (preheated, "put food in",
timer waits for food) · Cooking (timer and/or food probe, done-at time) · Done (take food out)
· Offline / stale (last known values, clearly stale). Also: **Door open → heating paused**
(the oven cuts its heating elements while the door is open, so door state is real data).
Commands show sending / confirmed / refused (e.g. refused because the door is open).

## F. Controls and features

- MUST [Safety] **Stop** is one tap, never confirmed, always visible while the oven heats.
- MUST [Safety] Starting is deliberate: two steps with outcome-labelled buttons and a review that
  expires after 5 minutes (UL 1026 remote-programming window). Nothing heats on one tap. Remote
  start is only offered where the oven allows it (Bake/Roast proven first).
- SHOULD [Lead] **Quick add time: +1, +5, +10 min** chips while a timer runs (the lead likes these).
- SHOULD [Lead] **Temperature graph**: oven temperature, food (probe) temperature and door-open
  incidents in one view (the lead likes this). Door marks come from real door data, never guessed.
- SHOULD [Lead, June] Idle "home" like the oven: square cook-mode tiles in swipeable pages with
  dot indicators, equal gaps both ways, centered clock and date at the top, no verbose hint text.
  Tapping a tile opens the start flow for that mode (never heats directly).
- SHOULD [Lead, June] **Settings** reachable like on the oven: a Settings tile (same shape, gear,
  "Settings") after the last cook mode.
- MUST Adjust target temperature and timer, set food-probe target (detail view is fine).
- MUST History of past cooks (detail view is fine).
- Settings content (three homes): card editor (look, size, which oven, options); in-card settings
  for people who cook (alerts, camera behaviour, remote-start status, oven info); integration
  configuration (address, TLS). Remote-start permission is changed only on the oven itself.

## G. Several ovens

- MUST [Evidence/Safety] Never hide an oven that is heating; every action names the oven it acts
  on when there is more than one; plain oven names ("Kitchen", "Garage").
- SHOULD [Lead] Ability to switch between ovens (for households with more than one).
- SHOULD [Lead] Ovens that are off appear smaller / quieter, without a highlight.
- Separate cards per oven remain possible (HA's normal model).

## H. Accessibility and glanceability

- MUST [Evidence] The hero value (temperature or time left) is the largest thing on the card;
  status in plain words; status uses at least colour + shape + word (never colour alone).
- MUST [Evidence] Targets ≥ 48 px (older adults: 14–20 mm), WCAG 2.2 AA contrast in all three
  looks, no drag-only / swipe-only / long-press-only path (swipe needs a tap alternative),
  respects reduced motion, screen-reader labels, stale data looks stale.
- MUST [Evidence] Wall-tablet size readable at 2–3 m (hero numerals ~110–150 px).
- SHOULD [Evidence] Calm at rest: colour only for active/abnormal states, no pulsing, dim idle
  wall panels.

## I. Data available (entities, current or planned) [Data]

climate (current/target temp, mode) · cook phase · progress % · done-at timestamp · estimate
status (estimating/acquired) · food probe temp + target · timer (set/extend, command 11006) ·
program name · heater/fan state · connected / last update · last command ack · camera still +
MJPEG stream + camera on switch · door (to be added by june-local) · history (HA recorder).

## J. What went wrong last time (why we are restarting)

"Schlimmbesserung" — improvements that made it worse. Each request was bolted onto the same card
without re-balancing: ring + side camera + context line + bar + probe bar + Stop, then swipe
pages for idle tiles, then oven chips with underline tabs and inline Stop, then a second swipe
page for the graph, then an add-time group beside Stop, then a header camera window. The result
had too many element types, two different paging systems, cramped camera sizes, and no clear
hierarchy. The fresh design must start from a **budget**: decide per state what the card's one
job is, what is on the card, what lives one tap away, and what lives in alerts — before drawing.

## K. How designs will be judged

Glanceability (can you read the state in < 2 s?), safety (Stop, deliberate start, stale honesty),
older adults, feels native to HA, camera integration quality, June continuity (does it feel like
the oven's glass?), works at every size and width, visual calm / aesthetics (does it look clean,
balanced, intentional?), and build cost. Every design is checked against the MUSTs above.

---

## L. Corrections from the fresh research (read research/r1–r3 for detail)

- June's own home-screen renders show **no page dots**; the lead reports the real oven has them.
  Treat dots as the lead's account of the device (SHOULD), not as verified in renders.
- On the oven, **Settings / Clean / Connect are circles** (grey / green / blue), not ember tiles.
  The lead asked for a Settings *tile* in the same shape as the modes; either is defensible — say which and why.
- Oven tiles are slightly wider than square (107 × 92 px) with labels below; pages 2–3 have no clock.
- The oven has **two rings**: preheat = thermal gradient ring (blue → red) with the current temperature
  inside; cooking = flat ember ring that drains with time left, tiny qualifier ("or more") under the number,
  2–3 small centred lines below. One huge thin condensed numeral is always the hero.
- June's buttons name the outcome ("Start Broiling", "Finish", "Keep Roasting") and stack full-width.
- June has **no +1/+5/+10 chips**; it adds time via "Keep Cooking" after the timer ends. The lead still
  wants quick-add chips (SHOULD) — this is new ground, place it with care (r2: keep secondary actions apart
  from Stop by space, style and alignment).
- Every comparable product puts the full temperature graph **one tap away**, never on a small card (r2, r3).
  On the card at most a word-sized sparkline, only if it answers that state's question.
- Swipe pages with dots on a dashboard have weak evidence (r2): acceptable for the idle mode picker only,
  ≤ 3 pages, one paging system per card, tap alternative, never for status / graph / camera.
- Budget method (r2): per state one job line; slots = 1 hero value, status word + shape + colour, ≤ 1 time
  projection, ≤ 2 supporting facts, camera still, ≤ 1 prominent action, ≤ 1 quiet group of ≤ 3, ≤ 5
  distinct element types. Bigger sizes add at most one layer, never a new job or a new paging system.
