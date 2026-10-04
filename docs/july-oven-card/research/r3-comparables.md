# R3 — Comparable products: how others present oven / cook status

Written 2026-09-27 for the fresh July Oven card study. Sources are web-fetched official docs, app-store
listings and reviews. Many vendor help centres (MEATER, Traeger, Anova support, Vorwerk) returned
HTTP 403 to automated fetch, so some facts come from search-engine excerpts of those pages; these are
marked **(excerpt)**. Anything I could not confirm is marked **UNVERIFIED**. No screenshots were
inspected, so claims about exact pixel layout are avoided.

---

## 1. Ovens with cameras or apps

**Anova Precision Oven 2.0 (app + on-oven screen).** Camera is inside the cavity, upper right
(excerpt, support.anovaculinary.com/hc/en-us/articles/33293480124301). In the app the camera is *not*
on the cook screen by default: you tap the oven icon, choose **Live Video**, and a Stop button leaves
video mode; after the cook a **timelapse** lands in "My Cooks" history
(https://anovaculinary.com/blogs/blog/how-to-use-the-anova-precision%E2%84%A2-oven-app). Live video
is subscription-gated on Oven 2.0 (https://apps.apple.com/us/app/anova-oven/id1482204597). App shows
real-time temperature, steam, timer and probe; multi-stage cooks with notifications "for the next
hands-on step". A low-authority review claims Matter exposes status, probe and time remaining
(https://hometoolhq.com/anova-precision-oven-2-review-2026/) — treat as UNVERIFIED. Graph, add-time
chips: UNVERIFIED (none found).

**Brava.** The oven's own touchscreen shows the fisheye camera view; the app "essentially mimics the
front panel" (excerpt, https://www.digitaltrends.com/appliance-reviews/brava-review/). Reviewers note
the front-mounted camera struggles to see the rear of the tray and wished the light stayed on
(excerpt, Tom's Guide / Digital Trends). No Verge review found.

**Tovala.** Scan-to-cook; the oven programmes itself; the phone gets a push when the meal is done
(https://www.tovala.com/blog/what-is-scan-to-cook-how-qr-codes-are-replacing-oven-dials). Useful
negative evidence: after an app update, users complained the stage-of-cooking view was replaced by
"a small timer … as a notification bubble" and the app "took several steps backwards" (excerpt of
app reviews via https://apps.apple.com/us/app/tovala/id1166594440). People notice when stage is
hidden.

**Suvie.** App schedules and monitors cooks, pushes "about to start" and "ready", lets you change
the start time only before cooking begins (excerpt, https://apps.apple.com/us/app/suvie/id1227142052).
Detailed cook-screen UI: UNVERIFIED.

**Breville Joule Oven Air Fryer Pro.** "Autopilot" runs a multi-phase plan; app gives progress and
notifications (https://www.breville.com/us/en/joule-oven/home.html). At the end the oven asks whether
to keep food warm, and an **"A Bit More"** button adds cooking time (excerpt, Digital Trends / NBC).
One review found notifications "intrusive for simple tasks" (excerpt,
https://www.tomsguide.com/reviews/breville-joule-oven-air-fryer-pro). Exact increment of A Bit More:
UNVERIFIED.

**GE Profile / SmartHQ (CookCam).** Live-streamed in-oven video in SmartHQ
(https://www.geappliances.com/ge/connected-appliances/ranges-ovens-cooking.htm). Remote control only
after **Remote Enable** is pressed on the appliance; pushes for *preheated*, *timer finished*,
*probe reached temp* (https://products.geappliances.com/appliance/gea-support-search-content?contentId=23810).
CookCam AI: when the door closes the camera identifies food and the oven "will chime and recommend"
a mode on its LCD; "images stay on the device, not in the cloud"
(https://pressroom.geappliances.com/news/ge-profileTM-leads-the-way-in-ai-technology-and-precision-cooking-modes-with-cookcamTM-ai).

**Samsung Bespoke AI Oven (SmartThings).** Camera in the cavity roof; view on the 7-inch oven screen
or live-stream in SmartThings (https://www.engadget.com/samsung-bespoke-smartthings-wall-oven-hood-fridge-sustainability-164725174.html).
AI works from **periodic stills**, not continuous video; suggestions are approve/decline — "it never
overrides you" (https://elevatedhomereview.com/samsung-bespoke-wall-oven-review.html). SmartThings
device card shows minutes remaining (excerpt, SmartThings community); exact card layout UNVERIFIED.

**Miele (FoodView, Dialog, Miele app, M Touch).** FoodView takes an HD **still every minute**; to
limit data only the **latest image** is available; support tells users to wait ~1 min for refresh
(https://www.miele.com.au/support/customer-assistance/oven-1229/all/foodview_image_is_black-91576898443,
excerpt). App dashboard shows all networked appliances' status at once ("is the oven hot?"), pushes
when preheat is reached, and messages if the forecast finish time moves by more than 30 min
(excerpt, https://www.miele.com.au/domestic/miele-app-5175.htm). M Touch shows the clock when the
oven is off (excerpt, Miele press / mykitchens.de).

**Bosch / Siemens Home Connect.** Remote Start must be enabled by a button **on the appliance**. Oven
safety level: within a **15-minute window** remote start survives a door-open; after that a door
opening **cancels** it and you must press the button again
(https://www.home-connect.com/ba/en/discover-home-connect/discover/remote-start, excerpt). Siemens
iQ700 camera: view from app, time-lapse, browning sensor that switches off at the chosen browning
level (https://mykitchens.de/en/magazine/siemens-oven-2023/).

**Thermomix TM7 (Red Dot 2025, Interface & UX).** 10-inch touchscreen, all-black body; Cookidoo
recipes "front and center" (https://www.businesswire.com/news/home/20250902118001/en/). Award page
lists the category but the jury text was not retrievable
(https://www.red-dot.org/project/thermomixr-tm7-cookidoor-85135). Cooking-screen layout: UNVERIFIED
(Vorwerk GUI article returned 403).

**Wolf / Sub-Zero Owner's App.** **Remote Ready** must be enabled on the oven *before each use* and
"stays on the display until the oven is accessed from the app"; several modes (Broil, Proof, Clean…)
cannot be started remotely
(https://www.subzero-wolf.com/assistance/answers/sub-zero-group-owners-app---set-up-remote-access).
Probe: current **and** target shown on the dashboard tile; the doc openly says the app updates every
**30 s** so it "will rarely match" the oven display
(http://www.subzero-wolf.com/assistance/answers/sub-zero-group-owners-app---oven-probe).
Configurable alerts: Door Ajar, Error, Timer.

## 2. Thermometers and grills with graphs

**MEATER.** Graph of internal and ambient over time (https://meater.com/app-features). Honest
"not yet" states: the estimate appears only after ~16 °F rise; ambient shows **a dash** until it is
10 °F above internal (excerpt, support.meater.com Cook-Time-Estimate article). At target: **"Remove
from Heat"**, then a **resting** timer; critical alerts repeat until cleared or resting begins
(https://meater.com/changelog). Many probes on one dashboard; Lock-Screen Live Activity with temps and
cook time; graph sharing and notes on past cooks.

**Combustion Inc.** Core / surface / ambient plotted live; **tap a temperature to show the graph**,
hide it from the ⋮ menu; **colour-coded dots under each number toggle its line**; trend arrows;
pinch-zoom (excerpt, combustion.inc setup guide; https://apps.apple.com/us/app/combustion-inc/id1658858290).
Prediction shown as relative ("ready in") **or clock time**; 5-minute warning; Live Activity for one
probe; cook history with notes and export. Add-time controls: none found.

**Traeger WiFIRE.** Grill and probe temps plus the timer are pinned "at the top" of every app screen
(https://www.engadget.com/traeger-grills-app-redesign-video-guides-personal-customization-191141115.html).
Live Activity shows temps, progress, time remaining, later pellet level
(https://apps.apple.com/us/app/traeger/id1094569463). A "Lid Open" alert exists
(https://support.traeger.com/hc/en-us/articles/6412437046427-Alert-Lid-Open — page 403, content
UNVERIFIED). Long-running user complaint: no full-cook graph.

**Weber Connect 2.0.** Live graph of grill and food temps, graph share and CSV export; multi-grill via
"two tabs"; flip/doneness alerts; dark mode (https://apps.apple.com/us/app/weber-connect/id1480540695;
https://www.weber.com/US/en/pr-release-050223.html). Lid events on graph: UNVERIFIED.

**ThermoWorks (Signals / Cloud).** Device list shows name, location and **last connection time**;
readings turn **blue/red** past low/high alarm; graph covers 24 h, tap channel name to hide a line,
zoom sliders; alarm thresholds drawn as lines; settings in a top-right menu; sessions with notes
(https://help.thermoworks.com/knowledge-base/thermoworks-cloud/;
https://www.smokedbbqsource.com/thermoworks-signals-bbq-thermometer-review/).

**FireBoard Drive (extra).** "Lid detect" is **inferred** from a rapid temperature drop and pauses the
fan (default 7 min) (https://docs.fireboard.io/drive/settings.html). How it appears on the graph:
UNVERIFIED.

**Key gap:** I found **no** comparable that verifiably plots door/lid-open events as markers on its
temperature graph. Our door marks from real door data would be novel; there is no proven visual to copy.

## 3. Smart-home dashboards and system surfaces

**Apple Home / Google Home.** Matter 1.3 defines ovens and cooktops, but no major appliance brand
exposes ovens in Apple Home and Google Home lags on appliance device types
(https://easybear-appliancerepair.com/blog/apple-homekit-appliance-compatibility;
https://www.matteralpha.com/explainer/does-google-home-support-matter). There is no mainstream
"oven tile" to copy.

**Apple Live Activities.** "Present only the most essential content"; update only when there is new
content; alert only when essential; keep compact and expanded layouts consistent; tap opens the app at
the right place; avoid custom backgrounds in the Dynamic Island
(https://9to5mac.com/2022/09/26/iphone-14-pro-live-activities-guidelines/;
https://developer.apple.com/news/?id=qpqf1gru). The 2022 guidance said no buttons; iOS 17 later
allowed App-Intent buttons — not re-checked here (UNVERIFIED).

**Android 16 Live Updates.** `ProgressStyle` uses **segments** for phases and **points** for
milestones on one bar, a tracker icon (Google's own example uses a skillet for "cooking"), concise
text, and only relevant actions
(https://developer.android.com/about/versions/16/features/progress-centric-notifications). Google
Clock's timer notification offers a **+1:00** button (excerpt, makeuseof.com).

**Home Assistant cards.**
- *ha-appliance-card (firstof9):* glassmorphic look, 7-segment readouts, supports the Sections view
  (https://github.com/firstof9/ha-appliance-card).
- *ha-appliance-card (ADNPolymerase):* normalises many vendor states into Idle / Running / Done; for
  ovens "the bar becomes a preheat gauge"; `compact: true` "keeps only the text"; controls only
  appear if configured (https://github.com/ADNPolymerase/ha-appliance-card).
- *M3 Appliance Card:* rule-based status line (first match sets label, icon, colour); unavailable
  sliders vanish, while **buttons dim but stay** "for layout stability"
  (https://github.com/j0sp0r/m3-cards/pull/11).
- *Bubble Card:* "hiding content by default"; details live in pop-ups
  (https://github.com/Clooos/Bubble-Card).
- *Native tile card features:* trend graph, target-temperature buttons, bar gauge; placed
  **Bottom or Inline** (https://www.home-assistant.io/dashboards/features/).
- *Community oven thread:* people build their own; they want current versus target, and colour
  (orange heating / green ready) (https://community.home-assistant.io/t/nice-dashboard-card-for-ovens/922094).

---

## 4. Cross-product pattern table

| Pattern | Who uses it | Evidence it works / notes |
|---|---|---|
| Camera **one tap away**, not on the main status view | Anova (oven icon → Live Video), Home Connect, GE SmartHQ | Vendor choice across premium brands; Anova adds a Stop to leave video. Adoption evidence only, no usability data. |
| Camera as **periodic still** that refreshes, not video | Miele FoodView (1/min, latest only), Samsung AI (periodic) | Miele says this limits data; users accept a ~1 min lag. Supports our "still ≤2 s, video only when expanded". |
| Camera **on the oven's own screen** | Brava, Samsung (7-inch) | Makes "looking at the oven glass" literal; reviewers complain about framing and lighting, not placement. |
| **Timelapse / cook history** after the cook | Anova, Siemens iQ700, MEATER/Combustion/ThermoWorks (graphs + notes) | Keeps the live view light; history belongs in detail/history. |
| **Current + target shown together** | Wolf probe tile, HA community oven cards, ha-appliance-card | Users build it themselves when it is missing. |
| **Honest "not yet" placeholders** (dash, "estimating") | MEATER (ambient dash, estimate after 16 °F), Combustion prediction | Stops false precision early in a cook; maps to our estimate status. |
| **Stale-data honesty** | Wolf (30 s note), ThermoWorks (last-connection time) | Rare but explicit; supports our stale requirement. |
| **Remote start armed on the appliance, time-boxed, cancelled by door** | Home Connect (15 min, door cancels), Wolf Remote Ready (per use), GE Remote Enable | Industry-standard safety model; matches our deliberate-start and remote-start-only-on-oven rules. |
| **Phase words for the end state** ("Remove from Heat", resting, keep warm) | MEATER, Joule | Plain verb tells you what to do; better than "Done". |
| **Add time at the end** | Joule "A Bit More", Google Clock +1:00 | Proven for "not quite done". No verified cook app puts +1/+5/+10 chips next to Stop mid-cook. |
| **Graph toggles on tapping the number / legend dot** | Combustion, ThermoWorks | Graph stays hidden until wanted; legend doubles as control. |
| **Alarm or threshold lines on the graph** | ThermoWorks | Target as a flat reference line reads at a glance. |
| **Milestone points on a single progress bar** | Android ProgressStyle | Platform-endorsed way to mark events on a timeline. |
| **Door / lid events on the graph** | None verified (FireBoard infers lid from a temperature drop) | Novel for us; keep marks minimal and data-true. |
| **Persistent mini status across screens** | Traeger (temps + timer pinned on top), Live Activities | Status stays primary when you navigate away. |
| **All devices on one dashboard; switch by tabs** | MEATER, Miele, ThermoWorks, Weber (two tabs), Traeger fleet list | Common; none found that hides an active device. |
| **Details in a pop-up / more-info** | Bubble Card, HA tile features | HA-native way to keep a card calm. |
| **Disabled controls stay in place** | M3 Appliance Card | Layout stability; nothing jumps when state changes. |
| **Only-essential, alert-only-when-needed** | Apple Live Activity HIG, Joule complaint | Over-notification is a named complaint. |

---

## 5. For the July Oven card

### Patterns to borrow
1. **Status first, camera second, video on request.** Show a refreshing still with an age label on the
   card; live video only in the expanded view (Anova, Miele, Samsung). Give a clear way out of live
   video (Anova's Stop-video), and don't label it just "Stop", which could be confused with stopping
   the oven.
2. **Current → target pairs** for oven and probe (Wolf, HA community), with **dash placeholders**
   until values mean something, e.g. "estimating" before done-at is known (MEATER).
3. **Plain instruction verbs for the end phases**: "Put food in" (Ready), "Take food out" (Done), in
   the style of MEATER's "Remove from Heat". Pair Done with one **"a bit more"** style add-time
   action (Joule).
4. **+1 / +5 / +10 as a small secondary group**, visually quieter than Stop and physically separated
   from it. The closest precedents are Google Clock's +1:00 and Joule's A Bit More. Our three-chip
   group next to Stop is **our own choice**, not a copied pattern.
5. **Graph in the detail view, opened by tapping the number** (Combustion). Legend dots double as
   line toggles; target as a flat reference line (ThermoWorks); door-open as **points or thin shaded
   bands on the time axis**, using the Android "points on a timeline" grammar. Door marks are new
   ground, so keep them to one mark type.
6. **Stale honesty like ThermoWorks/Wolf**: "Last update 3 min ago", greyed values.
7. **Remote-start model = Home Connect/Wolf**: armed on the oven, time-boxed, cancelled by the door,
   with the reason stated when a command is refused.
8. **One dashboard of ovens, quiet when off** (Miele/MEATER), with the active oven never collapsed.
   Use tabs or chips to switch (Weber).
9. **Layout stability**: unavailable buttons dim in place instead of disappearing (M3 card).
10. **Live Activity discipline for the card itself**: one job per state, update only on change, no
   decorative motion. On the oven's-glass dark surface, avoid tinted backgrounds except for alerts.

### Patterns to avoid
1. **Hiding the stage behind a tiny timer** (Tovala's update drew complaints).
2. **Camera as the hero** or cropped into a decorative shape. Nobody verified does this, and it
   conflicts with our 4:3 uncropped rule.
3. **Inferring door or lid events** from temperature drops (FireBoard's approach). Our brief requires
   real door data.
4. **Over-notifying** (Joule complaint); alert on preheated, done, probe reached, door-refused only.
5. **Graphs as a permanent card element.** Every graph found lives on a dedicated or expandable
   screen, and Combustion lets you hide it.
6. **Subscription or paywall-style gating cues** (Anova live video) — not applicable, but don't
   design the camera to look like a premium upsell.
7. **Relying on Apple/Google Home tiles as a model**: no mature oven tile exists there to copy.

### Open / unverified items worth a manual check
- Exact on-screen layouts (Anova 2.0 display, TM7 cooking screen, SmartThings oven card): needs
  screenshots from the app stores or a hands-on review.
- Whether Traeger or Weber mark lid-open on graphs (support pages blocked).
- Whether iOS 17+ cooking Live Activities (MEATER, Traeger) carry add-time buttons.
- A Bit More's exact increment on the Joule oven.
