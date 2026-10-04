# R2 — The glance budget: what goes on a small fixed-size card, per state

Research for the fresh July Oven card study (input: `glass2/requirements.md`). Written 2026-09-27.
Tags: **[P]** = primary source fetched and read in this pass · **[K]** = from background knowledge, URL given but not re-read in this pass · **[Own]** = my own synthesis/threshold, not a source's number.

---

## 1. What the sources say

### Platform guidelines

**Apple HIG — Widgets [P]** — https://developer.apple.com/design/human-interface-guidelines/widgets
- "Choose simple ideas that relate to your app's main purpose."
- Small widgets "typically show a single piece of information." Larger sizes add "layers," but "avoid expanding a smaller widget's content to simply fill a larger area."
- "Reserve complexity for your app"; "avoid creating app-like layouts."
- A tap deep-links to the right place. Text ≥ 11 pt.

*Why it matters:* the wall size may add layers, not jobs.

**Apple HIG — Live Activities [P]** — https://developer.apple.com/design/human-interface-guidelines/live-activities
This is the closest analogue to a running oven: a time-bound task.
- "Doesn't need to display everything."
- Buttons "take up space…"; "prefer limiting it to a single element."
- Use large, heavier text.
- Alert "only for essential updates," and never duplicate them as pushes.
- When several activities run, each shows a *minimal* live view, not a logo.

*Why it matters:* it covers Stop plus the +time chips, notifications, and several ovens.

**Apple HIG — Buttons, watchOS/complications, Notifications [P]** — https://developer.apple.com/design/human-interface-guidelines/buttons · …/complications · …/notifications
- Buttons: "Keep the number of prominent buttons to one or two per view." Hit region ≥ 44 pt.
- Complications: lines ≥ 2 pt ("difficult to see at a glance" otherwise); never colour alone.
- Notifications: one per event ("avoid sending multiple notifications for the same thing"). Up to four actions that save a trip. "Prefer nondestructive actions."

**Apple HomeKit HIG [P]** — https://developer.apple.com/design/human-interface-guidelines/homekit
There is **no** public tile-layout guidance. Put detail in an "accessory detail view," and "don't block camera images." Apple Home groups accessories into one tile only when one tap controls them together (https://support.apple.com/guide/iphone/control-accessories-iph0a717a8fd/ios).

**Android widgets + quality tiers [P]** — https://developer.android.com/design/ui/mobile/guides/widgets · https://developer.android.com/docs/quality-guidelines/widget-quality
- "Choose a single primary use case to highlight."
- Larger breakpoints add ≥ 48 dp buttons; smaller ones hide the less-used buttons.
- Stale content fails (WT-3). Cap the size if growing "only adds blank space" (WL-4.1).

**Wear OS tiles + principles [P]** — https://developer.android.com/design/ui/wear/guides/surfaces/tiles · …/design-for-wearables/principles
- "Show only the most critical bits of information. Avoid providing a superfluous amount of functionality."
- "Focus on one or two tasks," done in seconds.
- Tiles themselves sit in a swipeable carousel. Platforms do use paging, but for *equal peers*, not for sub-views of one task.

**Google Home app [P]** — https://support.google.com/googlehome/answer/7071794
- A tile shows status plus one quick action (tap on/off).
- "Touch and hold your device's tile to open all of its settings or controls."
- Camera tiles show live video. Each device gets its own tile.

**Home Assistant — Dashboard chapters 1 & 2 [P]** — https://www.home-assistant.io/blog/2024/03/04/dashboard-chapter-1/ · https://www.home-assistant.io/blog/2024/07/26/dashboard-chapter-2/
- "Each card used for controls should have a clear primary action."
- Interactive things "should look clickable."
- "Features get better results than icon buttons."
- "Don't clutter up the card."
- Grid: 56 px rows, 8 px gutter, 36 px icon, 42 px feature row. Keeping **spatial memory** stable matters.

**HA Tile card & features [P]** — https://www.home-assistant.io/dashboards/tile/ · https://www.home-assistant.io/dashboards/features/
- Tile = icon (quick action) + name + state; tapping the card opens **more-info**.
- A *trend graph* feature (sparkline, 24 h) is one feature row, not a page.

**HA Home dashboard 2025.9/2026.1 [P]** — https://www.home-assistant.io/blog/2026/01/07/release-20261/
Summaries come first, with no "extra taps": status first, controls second.

### Theory

**Mankoff et al., Heuristic Evaluation of Ambient Displays, CHI 2003 [P]** — https://www.ocf.berkeley.edu/~morganya/research/chi2003-ambient.pdf
- *Sufficient information design*: "just enough"; too much "cramps the display."
- *Consistent and intuitive mapping*: users shouldn't have to remember what states mean.
- *Visibility of state*: transitions "easily perceptible."
- *Easy transition to more in-depth information.*
- *Aesthetic and pleasing design.*
- 3–5 evaluators found 40–60 % of known issues, so use it to audit candidates.

**Weiser & Brown, calm technology [P]** — https://calmtech.com/papers/coming-age-calm-technology · **Amber Case principles [P]** — https://calmtech.com/
- Weiser & Brown: calm technology moves "back and forth" between centre and periphery.
- Case: "the minimum needed to solve the problem"; "should work even when it fails."
- For the card: quiet when idle, and it takes the centre only on a state change.

**Maeda / Rams [P; SHE is K]** — http://lawsofsimplicity.com/ · https://www.vitsoe.com/us/about/good-design
- Maeda, Reduce: "thoughtful reduction." In SHE (Shrink, Hide, Embody), *Hide* means moving things to detail, and *Embody* means what stays must feel like quality, which is the Glass idea.
- Maeda, Organize: "makes a system of many appear fewer."
- Rams: "Less, but better."

**NN/g — progressive disclosure [P]** — https://www.nngroup.com/articles/progressive-disclosure/
Show "a few of the most important options" first. The split must be right, the way to more must be obvious, and there should be **at most two levels**.

**Feature creep: NN/g [P] / Sierra featuritis curve [K]** — https://www.nngroup.com/articles/simplicity-vs-choice/ · https://signalvnoise.com/posts/3781-kathy-sierras-featuritis-curve-helps
Extra features raise task time and selection errors. Past the "happy user peak," each feature lowers satisfaction. This is the brief's *schlimmbesserung*.

**Cooper, posture [K]** — https://en.wikipedia.org/wiki/Application_posture
The card is *auxiliary*: always shown, small, limited. More-info is *transient*: "a single, high-relief function." Nothing on the card should demand *sovereign* attention.

**NHTSA visual-manual guidelines [P]** — https://www.federalregister.gov/documents/2013/04/26/2013-09883/visual-manual-nhtsa-driver-distraction-guidelines-for-in-vehicle-electronic-devices
Single glances ≤ 2 s, total ≤ 12 s per task, with 1.5 s occlusion shutters. It is a dual-task standard; a cook stirring a pot while glancing at a tablet is a fair analogue.

**Endsley, situation awareness (1995) [P abstract]** — https://www.researchgate.net/publication/210198492
Level 1 perceive (what is happening), Level 2 comprehend (what it means for my goal), Level 3 project (what happens next). A good oven glance answers all three: *192 °C* / *preheating, not ready* / *ready ~6:42*.

**Stephen Few [P]** — https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf
"…on a single screen so the information can be monitored at a glance."
- Pitfall 1 is *exceeding the boundaries of a single screen*, which paging does.
- Others: excessive detail, **meaningless variety**, weak highlighting, decoration, overused colour.

**NN/g — dashboards [P]** — https://www.nngroup.com/articles/dashboards-preattentive/
- Length and 2D position are read fastest. Gauges and donuts (angle, area) are read poorly.
- *Operational* dashboards (act now) differ from *analytical* ones (investigate later).

**Tufte, sparklines [P]** — https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/
"Intense, simple, word-sized graphics" placed where a word or number would go, with no axes or boxes.

**NN/g — carousels [P]** — https://www.nngroup.com/articles/designing-effective-carousels/ · https://www.nngroup.com/articles/mobile-carousels/
- Often only frame 1 is seen.
- "Dots are a particularly poor cue on mobile," and are rarely known to be tappable.
- Most users stop after 3–4 pages.
- Put the most important items first, show a peek of the next, and give another route to key items.

**NN/g — glanceable type [P]** — https://www.nngroup.com/articles/glanceable-fonts/
In 1–2-word glances, bigger type was read faster. Lowercase took 26 % longer than uppercase, and condensed took 11 % longer than regular width. This favours a short status word in caps and a regular-width font.

**NN/g — consequential options [P]** — https://www.nngroup.com/articles/proximity-consequential-options/
Keep consequential actions apart from routine ones. Use space *plus* further cues (colour, icon, size, alignment).

**Older adults and gestures [P abstract]** — https://www.researchgate.net/publication/257004572
Standard gestures are not easily discoverable by older adults; swipe needs visible cues.

---

## 2. The budget method

Do these steps **per state** (Off, Preheating, Ready, Cooking, Done, Door-open, Offline, plus a command-status overlay) before drawing. Every rule below can be tested.

### Step 1 — Write the card's job for that state in one line, with one verb [Own; Android/Wear/HA]
- *Preheating:* "Tell me when it'll be ready." *Ready:* "Tell me to put food in." *Cooking:* "Tell me when it's done; let me stop it." *Done:* "Tell me to take it out." *Off:* "Let me start something." *Offline:* "Tell me the data is old."
- **Test:** if the job needs "and" plus a second verb (other than Stop, which the safety rules force), the state is overloaded.

### Step 2 — Fill the glance budget (Endsley L1–L3, Live Activities, Mankoff)
| Slot | Budget | Rule |
|---|---|---|
| Hero value | **exactly 1** | Largest thing on the card (Level 1). |
| Status | **1 word/phrase + shape + colour** | Level 2. Never colour alone (Apple, WCAG). |
| Projection | **≤ 1** (done-at / ready-at / "3 min ago") | Level 3. |
| Supporting facts | **≤ 2** (e.g. target temp, probe) | Must be real data for this state. |
| Camera still | **1** (brief MUST) | Secondary weight: never larger than the hero's visual weight [Own]. |
| Prominent action | **≤ 1** | HA "clear primary action"; Live Activities "single element". |
| Quiet secondary actions | **≤ 1 group of ≤ 3** | Only in the running states; see §3c. |
| Distinct element *types* | **≤ 5 visible at once** [Own] | Few's "meaningless variety". Count ring, bar, chip, tile, pill, sparkline, dot row etc. as types. The failed design had ~9. |

**Tests:**
- **2-second test:** show the card for 2 s (NHTSA single-glance bound; 1.5 s in occlusion style is stricter). Three people must be able to answer *what state? what number? do I need to act?*
- **2–3 m test (wall size):** the hero and status word must read correctly from 2.5 m. Human-factors practice (ANSI/HFES 100) prefers characters of about 20–22 arc-minutes [K]. At 2.5 m that is about 15 mm cap height; measure on the real tablet.
- **Squint test [Own]:** blur the screenshot. The hero value must still be the first thing you see, and the Stop control the second while heating.

### Step 3 — Sort every feature into one of three homes (Apple, Google, HA, NN/g, Cooper)
- **Card**: needed *in this state*, within seconds, by most users. Status, hero, projection, camera still, Stop, and the one next action.
- **One tap away (more-info / detail)**: adjusting values, history, the full graph, probe target, settings, oven info, live video. **Max 2 levels** (NN/g). The door to it must look clickable (HA) and deep-link to the right section (Apple).
- **Notification**: only *events you might miss*:
  - Ready, Done, probe target reached;
  - door left open while heating;
  - a command was refused;
  - oven offline while heating.

  **One per event**, never repeated (Apple). Actions are non-destructive and save a trip ("+5 min", "Open camera"). Stop in a notification needs its own safety review.
- **Test:** every feature on the list has exactly one primary home. Features that are *adjustments* (target temp, timer value) are never on the card at rest; they are behind a tap.

### Step 4 — Sizes add layers, not jobs (Apple widgets, Android WL-4.1)
- **Compact (1 row):** hero + status word + tiny camera thumbnail + Stop while heating. Nothing else.
- **Standard:** the Step 2 budget.
- **Large (wall):** the *same* elements larger (numerals ~110–150 px per brief). At most **one** extra layer (e.g. a sparkline or larger camera), and never an extra *job* or an extra paging system.
- **Test:** every element on the large size has a counterpart on the standard size, or is explicitly listed as "the one extra layer."

### Step 5 — The anti-schlimmbesserung rule [Own; Sierra, Maeda]
- **One in, one out.** A new request enters a state's card only if it (a) serves that state's job line, and (b) replaces something or fits the unused budget. Otherwise it goes to detail or notifications.
- Record the budget table in the design spec, and re-run the 2-second test after every change.

### Step 6 — Calm and honest (Weiser/Case, Mankoff, Android WT-3)
- At rest (Off), use no accent colour and no motion (brief).
- Stale data is shown by **degrading the hero** (dimmed, with age label, not a small footnote). This follows Case's "work even when it fails."

---

## 3. Specific questions

### a) Swipe pages with dots on a dashboard card
**Against:**
- NN/g: people often see only frame 1, and dots go unnoticed and aren't seen as tappable.
- Few: paging breaks the "single screen" glance.
- HA research: spatial memory matters, and content that moves undermines it.
- Older adults: gestures are hard to discover.
- Brief: no swipe-only paths.
- A swipe inside a scrolling dashboard can also clash with page scroll [Own].

**For:**
- It is the June oven's own home screen, and familiarity helps (Maeda: Learn).
- Platforms page *equal peers* with dots (Wear OS tiles, iOS home screens). Missing page 2 costs little if page 1 holds the common modes.

**Verdict:** acceptable **only** for a homogeneous, non-urgent picker (idle cook-mode tiles), with these conditions:
- ≤ 3 pages;
- most-used modes and a visible way to Settings on page 1 (or Settings reachable elsewhere);
- a peek or arrow cue plus tappable ≥ 48 px page controls;
- **never** for status, safety, the graph or the camera;
- **one paging system per card**, only in the Off state.

### b) Graphs on small cards
- A three-series graph (oven, probe, door marks) is **analytical** (NN/g/Few). It belongs one tap away, full-width, with axes and labels.
- On the card, only a **word-sized sparkline** (Tufte; HA trend graph) is justified, and only if it answers a glance question in that state. Example, while cooking: "holding temperature / recovering after the door opened?"
  - Use one series, no axes, a line ≥ 2 pt.
  - Show door ticks only from real data.
- A sparkline counts as the large size's "one extra layer," or it replaces a supporting fact. It is never a swipe page.
- Avoid rings and gauges for comparing quantities (NN/g: angle is read poorly). A progress ring is tolerable for a single part-of-whole value, but a bar is read more precisely.

### c) Secondary actions next to Stop
- Stop is the one prominent action while heating. It is a *safety* action, so the Apple rule against making a destructive button primary does not apply in its usual sense. It still must not sit where a slip hits it by accident, or where a slip meant for it hits something else.
- Put **+1/+5/+10** in a separate group:
  - **space** between the groups of at least one target width [Own]; NN/g gives no number;
  - **different style**: quiet outline chips vs. the filled Stop;
  - **different alignment**, and Stop's position **fixed across states** (spatial memory).
- Show the chips only while a timer runs (the job line).
- On compact size, drop the chips; they live in detail and in the Done/Ready notification actions.
- **Test:** a mis-tap on any chip edge can never land on Stop, and the reverse.

### d) Several ovens: one card or separate cards
- The evidence leans to **separate tiles per device**: the HA Tile model, the Google Home app, Android's "single primary use case". Apple groups accessories only when one tap controls them together, which ovens don't need.
- Live Activities shows how to put several running things in one space: each gets a *minimal* live view, never just a logo.
- **Recommendation:** default is one card per oven. A multi-oven card, if offered, is a **summary/switcher**:
  - every *heating* oven always shows its name, hero value and Stop (never hidden behind a tab);
  - off ovens are shown compressed to a name chip;
  - every action names its oven.
- **Test:** with two ovens heating, a 2-second glance identifies both states.

---

## 4. Where the evidence is thin

- **No studies of HA cards or smart-oven dashboards.** HA's guidance is design-team blog posts, not published research.
- **Home glance time is unmeasured.** The 2 s / 12 s limits come from driving (dual task); they are an analogue, not a kitchen norm.
- **Carousel evidence comes from web/marketing carousels.** Nothing tests launcher-style dot pages inside a dashboard card, or with older adults.
- **The numeric caps are my synthesis** (≤ 5 element types, ≤ 2 facts, one-target gap). The only source numbers are Apple's "one or two prominent buttons" and "prefer a single element."
- **Sparklines on small, distant wall displays** are untested; Tufte argues for reading distance.
- **Several devices in one card:** no study found; the advice is inferred from platform conventions.
- **Wall legibility (HFES arc-minutes)** was not re-read here; test physically at 2–3 m.
- **Camera still sizing on status cards:** platforms only say "don't block camera images" (Apple) and camera tiles show live video (Google). It needs user testing.
