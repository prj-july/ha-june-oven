# R1: What the June oven's glass screen and the June app actually look like

Research for the fresh "Glass" card study. This file reports facts only, not design proposals. Each claim is tagged with its evidence. **[V]** means seen directly in an image or file. **[T]** means stated in text by a source. **[I]** means my inference, which needs checking.

The images cited below as `frames/…` (crops of the decoded app's screens, frames from a video, and review photos) were working copies and are **not included in this repository**: most are other people's copyrighted photos. Each one's source page is linked inline, so the evidence can be checked there.

Sources used: the decoded June Android app 1.24.1.11 (its screen images, colours and strings), Project July's reference photos of the oven, and frames from a Facebook video that films a real 3rd-gen oven screen in the background. The web sources are listed inline.

---

## 1. The oven screen, state by state

**Physical frame.** The screen is a 5-inch capacitive IPS LCD in portrait orientation, inset at the lower right of the black glass door ([juneoven.com/pages/technology](https://juneoven.com/pages/technology) [T]; photos [V]). The app's screen renders are 340×604, about 9:16 [V]. An ambient light sensor adjusts brightness, and the screen is "nearly invisible until you start interacting with the oven" ([TechCrunch 2016](https://techcrunch.com/2016/11/15/the-june-oven-makes-the-art-of-cooking-a-science/) [T]). The 1st-gen oven had a steel knob under the screen. Later generations removed it for a touch-only interface ([Core77](https://designawards.core77.com/home-living/86478/June-Oven.html) [T]; `subscription_control_oven` [V]).

**Idle / home.** Page 1 (`oven_screen_1`) [V]:
- The background is pure black (#000000).
- A very large thin condensed clock ("4:07") is centred at the top. Its digits are about 66 px tall on the 604 px screen (11 %).
- Below the clock is a grey date on one line ("Monday, November 25"), about 20 px tall.
- A 2-column grid holds 4 tiles: Programs, Bake, Roast, Reheat. Each tile has a white sentence-case label below it.
- Measured tiles are 107×92 px, so they are slightly wider than tall (1.16:1), with rounded-square corners of about 15 % radius. They are not exact squares.
- Horizontal gap between tiles: 45 px. Vertical pitch: 184 px, because each label sits in the gap below its tile. The gaps are therefore not equal both ways.

Pages 2 and 3 (`oven_screen_2/3`) have **no clock**. They are 3×2 grids that start at the top [V]:
- Page 2: Broil, Toast, Air Fry, Grill, Proof, Pizzaiolo.
- Page 3: Dehydrate, Slow Cook, Keep Warm, **Settings**, **Clean**, **Connect**.

Pages are swiped **horizontally**. The project's pairing guide says "swipe left twice from the home screen and select **Connect**" (`G:\Programming\June\ha-june-oven\README.md:161` [T]), and the manual calls Clean "the cleaning app found on the last screen" ([manual p.14](https://www.manualslib.com/manual/1502018/June-June.html?page=14) [T]). **No page dots appear in any of the three official renders**, even though each has 50–60 px of empty black at the bottom [V].

I also saw a separate **clock-only idle state** in the Facebook video (`frames/unk_36.png`) [V]: a thin "12:41", with the date on two lines ("Wednesday / August 5") and no tiles. [I] It is probably a dimmed or screensaver state.

**Mode selection / program start.** Tapping a Program leads through category lists to a food item. The start screen (Homes & Gardens photos, `frames/hg/m2.png`) [V] shows:
- a cut-out food photo at the top (a burger)
- the name and duration, "Burgers / 23½ minutes"
- a full-width **orange-gradient primary button labelled with the outcome**, "Start Broiling"
- a dark secondary full-width button for the doneness option ("Medium")
- a dark full-width row holding only a "×" to cancel

When the door closes, food recognition offers two choices, such as "salmon or tilapia" ([Digital Trends](https://www.digitaltrends.com/home/june-oven-review/) [T]).

**Setting temperature and time.** Not seen on the oven (see Gaps). The app uses a horizontal **tick-mark ruler with a red needle** (#FF2A00): white ticks, the value in orange #FB5028 at 25 sp, and the unit in grey #949494 (`item_tick_slider`, `view_*_slider` [V]). The timer subtitle reads "Timer will start when you put food in oven" [V].

**Preheating.** In the Facebook-video frames and reference photo 04 [V]:
- A thick **ring drawn as a thermal gradient**: blue/teal at the top right, through green and yellow, to orange and red on the left.
- A small blue dot sits at 12 o'clock.
- The centre shows the current cavity temperature in large thin numerals ("166°", "52°").
- Below the ring, small grey text reads "Preheat 350°F / Bake".

The app's temperature colours match this ramp: temp_blue #75D4DF, temp_dark_blue #5097D9, temp_yellow #FFFF4B, temp_orange #FC4C02, each with a 40 % variant [V colors]. [I] I could not tell whether the dot moves or what it marks.

**Ready (preheated).** The 1st-gen render (`subscription_control_oven`) [V] shows a food icon, bold "Ready to Cook", grey "Put food in oven to start timer", and a dark grey full-width ✓ button. The preheat auto-cancels after the Auto-Stop time (default 30 min, [support](https://support.juneoven.com/hc/en-us/articles/16093275109396-General-Settings-Menu) [T]), with the message "Preheat canceled to conserve energy" [V].

**Cooking with a timer.** From reference photo 01, H&G photos, and product shot 02 [V]:
- A **thick single-colour ring** fills the top ~55 % of the screen. The stroke is roughly 18–20 % of the diameter, with a rounded cap and a visible notch at 12 o'clock.
- Inside the ring: large white condensed numerals ("11:45", "13:37").
- Under the numerals, a tiny muted qualifier: "or more" / "or less", or "or sooner" in the app.
- Below the ring, 2–3 small centred lines, for example "Chocolate Chip Cookies / Step 1 of 3 · Bake" or "Convection roast 500°F / Medium rare steak".

The ring colour looks orange (#FB5028 in the app, `timer_orange`) to pale amber in photos. In photo 01 the ring is full early in the cook. In the app shot at 2:35 it is about a quarter arc on a dim ember track. [I] So the ring shows **time remaining** and drains as the cook proceeds. Photo 01 also shows a row of about 8 short dashes under the text, with the first one orange. [I] This may be a step indicator.

**Cooking with the food probe.** The layout is the same, with a third line in **bold white**: "Food temp 56°F" / "Food temp 69°F" [V]. The app strings are "Target food temp %s", "Food is now %s", "Estimating / cook time", "Reestimating / cook time" [V]. There is an `indeterminate_donut` for the estimating phase, and "shimmer" gradient colours: timer #802600→#4D0B00, green #105E00→#0A3E00 [V colors].

**Done.** The H&G photo (`frames/hg/z_done2.png`) [V] shows a food cut-out, bold "Plate & Rest 5 min.", smaller "Cooking complete", an orange-gradient "Finish" button, and a dark "**Keep Roasting**" button. Keep Cooking adds 30 s to 1 min per tap ([support](https://support.juneoven.com/hc/en-us/articles/360005709854) [T]), and reviewers pressed it repeatedly ([InsideHook](https://www.insidehook.com/food/june-oven-review) [T]). A separate **rest timer** screen shows a stopwatch dial reading "5:00", the instruction "After cooking, remove & rest for 5 minutes", a thin progress bar, and "Continue" / "×" [V]. After done, the oven cuts heat and keeps food warm ([TechCrunch](https://techcrunch.com/2016/11/15/the-june-oven-makes-the-art-of-cooking-a-science/) [T]). The app also has a green timer colour, #1CA600 [V].

**Door open.** Heating elements "shut off temporarily" and resume when the door closes ([support](https://support.juneoven.com/hc/en-us/articles/360000084153) [T]). The app alert reads "Shut the Door – Cooking is disabled while the oven door is open." [V]. I could not verify what the oven screen shows.

**Other system screens** [V]:
- Terms and update screens use blue circle icons, cyan or blue bars, and thin progress bars.
- Pairing keypad (`oven_screen_enter_code`): grey title #9B9B9B, blue input bar #198CFF with a "×", #262626 keys on 1 px black gaps, and thin #B3B3B3 digits.

## 2. Visual language

**Surface and colour.** The screen is black glass: the app sets `oven_screen_background` #000000 [V]. In photos, the LCD black reads as a deep blue-black or navy, and secondary buttons look dark slate [V, H&G].

The tiles glow ember-orange (sampled from `oven_screen_1` [V]):
- body #1C1111 at the top, deepening to #481616 and to red near the lit element
- rim #652E28 with a brighter orange edge
- element glyph core #FFDB30 to #FFD025, fading to #D66C1D / #D14417 at its edges
- a soft orange bloom spreading into the tile
- a faint diagonal specular sheen across the top right, like a glass reflection (`frames/tile_zoom.png`)

Tile labels are #DFDFDF.

Utility actions are **circles, not ember tiles**:
- Settings: light grey disc #ECECEC with a dark gear #5E6567
- Clean: green disc #43A910 with a spray bottle
- Connect: blue disc #22B8FF with a phone
- Press or selected state: a dark rounded rectangle #333333 behind the item

The oven's primary buttons use a yellow-orange to orange-red gradient pill [V]. Menu icons are small coloured circles (blue, orange, yellow, cyan, purple) [V "OVEN CARE"].

The app palette [V colors_resolved]: carrot #FF4000, accent #F95933, timer #FB5028; surfaces #000000, #161616, #2C2C2C, #434343; text greys #676767, #949494; isometric element on #FF4000, off #2C2C2C.

**Typography.** The app bundles **DIN Next LT Pro** in Light, Light Condensed, Condensed, Regular and Medium [V apk_findings].
- The oven uses the same family: thin/light condensed for the clock and timer numerals, and regular or medium for labels.
- Menus use large left-aligned **condensed medium** type ("Regular Cleaning / Deep Cleaning / Blow Dry") under small UPPERCASE tracked headers ("OVEN CARE", "OVEN INTERIOR") [V].
- Text is sentence case except those headers.
- Tiempos Headline (a serif) appears only in app recipe and editorial screens [V `purchase`].

**Iconography.** Each tile glyph draws **the heating elements that the mode uses** [V; mode definitions from the [12 Cook Modes](https://support.juneoven.com/hc/en-us/articles/16093194375060-12-Cook-Modes) page, T]:

| Mode | Glyph |
|---|---|
| Bake | bottom bar |
| Broil | top bar |
| Roast, Toast | top and bottom bars |
| Reheat | three wavy lines |
| Air Fry | fan |
| Grill | diagonal bars |
| Proof | dough blob |
| Pizzaiolo | peel |
| Dehydrate | sun |
| Slow Cook | pot |
| Keep Warm | three dots |
| Programs | dot pyramid (older renders say "Presets" with bars) |

The app's dashboard uses an **isometric line-drawn oven** in white on dark, with each element (bake, broil, roast × front/rear) lit individually and a 4-frame fan animation (`view_iso_metric`, `elements_*`, `fans_on_1..4` [V names]).

**Glow and light.** Light comes *from inside* the glyphs, as if the element were glowing behind glass, and the tile body picks up that colour [V]. The ring on the cooking screen is flat and bright with no glow [V].

**Motion.** The app uses only plain tweens (fade, slide, scale-in), a 4-frame fan animation, and a pairing guide that cycles through the three home renders [V names]. I did not verify any on-oven motion.

**Sound.** A "pleasant little tune" plays when food is ready ([Reviewed](https://www.reviewed.com/cooking/features/june-oven-review-heres-how-the-smart-oven-actually-works) [T]). Volume can be low, medium, high or mute, and the sound themes are **Melody, Muffle, Blaster** ([support](https://support.juneoven.com/hc/en-us/articles/360006469413) [T]).

## 3. Interaction

- **Pages.** Horizontal swipe through 3 home pages. Settings, Clean and Connect sit at the end of the last page (above). I found no tap alternative for paging.
- **Tile shapes.**
  - Cook modes: rounded near-square ember tiles.
  - System items: circles.
  - Lists: full-width rows or pills stacked vertically. The primary action is an orange gradient, the secondary is dark, and cancel is a separate "×" row [V].
- **Settings.** Opened from the Settings tile. It covers General (unit, Food Recognition, Screen Lock, Auto-Stop), Sounds, Maintenance › Updates, About, App Permissions (remote start) and Clock ([support](https://support.juneoven.com/hc/en-us/articles/16093275109396-General-Settings-Menu) [T]). With Screen Lock on, you "tap the clock on the oven's home screen" to lock. You unlock by holding the lock icon for 2 s or by opening the door [T].
- **Clean.** Opens "OVEN CARE" (Oven Interior, Heating Elements, Camera, Touchscreen, Accessories). Its footer begins "For your safety, connected apps can't start the oven…" [V]. The touchscreen option deactivates the screen for wiping (manual p.14 [T]).
- **Connect.** Opens the device list and a "+" button, leading to the 8-digit code keypad.
- **Stop / cancel.**
  - Before start: the "×" row.
  - During a cook: the "**Cook Settings** menu on your oven screen" ([Bake](https://support.juneoven.com/hc/en-us/articles/16093399623572-Bake-Cook-Mode) [T]). [I] It is probably opened by tapping the cook screen.
  - In the app, the edit sheet lists: Oven Temperature, Set/New Timer, Set/New Thermometer, Turn Convection Fans On/Off, and **Stop Cooking** [V strings]. Its "cancel" button colour is #FC4C02 with white text [V colors]. I could not tell which button that colour is applied to.
  - The only confirmation dialog I found is "Disconnect from oven" [V strings].
- **Adding time.** Only through **"Keep <verb>ing"** after the timer ends (30 s to 1 min per tap), or "Set/New Timer" in Cook Settings. I found **no +1/+5/+10 chips** in the oven or the app. Cook-Programs lock their time and temperature (support [T]).

## 4. The app

- **Bottom navigation** (Android 1.24): Oven (remote), Programs, Cookbook, History [V]. The iOS 1.8 release notes add an "**Oven tab badge**: keep track of preheat or timer progress from anywhere in the app" ([App Store notes, archived 2023](https://apps.apple.com/us/app/june/id1052913622) [T]).
- **Oven tab.** Sub-tabs Dashboard / **Cooking** / **Live Video** [V strings]:
  - tab bar #161616; selected tab white with an orange underline; unselected #676767 [V]
  - Cooking view: dark screen, a large ring (330/350/360 dp by screen size [V dimens]), thin numerals, "or sooner", three centred lines with the last in bold white, and one full-width orange "Edit Cook Settings" button [V `onboarding_page_control`]
  - status labels use bold white against normal #676767 text [V colors]
- **Camera ("Live Video").** In practice this is **refreshed stills relayed via June's servers**. An early reviewer found it "really just a still photo that updates" ([Reviewed 2016](https://www.reviewed.com/ovens/features/i-cooked-dinner-in-a-1500-june-oven-heres-what-happened) [T]). It is available only while cooking; a reviewer wanted it after the cook ended (Tom's Guide [T]). After each cook, a time-lapse is saved in History ([support](https://support.juneoven.com/hc/en-us/articles/360000082753) [T]).
- **Graph.** "Temperature Graph" [V]: cavity line #FF5500 and probe line #FFAA00, each with a fill; grid #434343, axis #676767. The app shows a chart of oven and food temperature after each cook (Tom's Guide [T]).
- **Adjusting.** Temperature and timer use the tick sliders. The app can't turn the oven on unless App Permissions allow it on the oven [V strings]. Preheating requires picking Bake or Roast (v1.16.1 notes [T]).
- **Notifications:** Preheat Finished, Timer Progress (ETA changes, one minute left), Timer Ended / probe reached, flip alerts, and new recipes. They go to every paired device and to watches ([support](https://support.juneoven.com/hc/en-us/articles/16093206077332-App-Notifications) [T]).
- **Multiple ovens.** I found no oven switcher. Settings shows one oven identifier and "Disconnect from Oven" [V]. Many devices can pair to one oven (manual p.9 [T]).

## 5. What makes it feel like June's glass

1. **Black is the canvas.** Pure #000 behind everything, on a screen that disappears into the black door until touched. Evidence: `oven_screen_background` #000000; TechCrunch's "nearly invisible".
2. **Light comes from inside the controls.** Mode tiles are dark glass lit by their own ember glyph (#FFDB30 core, #D66C1D edge, red bloom, specular sheen). Evidence: `tile_zoom.png`.
3. **The glyph is the heating element.** Icons show which elements heat: bottom bar = Bake, top bar = Broil, fan = Air Fry. Evidence: tiles plus the 12 Cook Modes definitions, and the app's isometric per-element lighting.
4. **One huge thin number.** The clock, timer or temperature in light condensed DIN dominates, and everything else is small and centred beneath it. Evidence: screens 1, 01, H&G, and the video frames.
5. **The thick ring.** A fat, flat ring frames the hero number. It is a thermal blue→red gradient while preheating and solid orange while cooking, draining as time passes. Evidence: photos 01/04, video frames, app shot.
6. **An honest qualifier under the number.** "or more", "or less", "Estimating cook time", and the bold white food temperature line. Evidence: strings and photos.
7. **Outcome-worded buttons in a vertical stack.** An orange-gradient "Start Broiling" / "Finish", a dark "Keep Roasting", and a separate "×". Evidence: H&G photos.
8. **Warm colour only for heat.** Orange marks heat and primary actions. Utilities are other colours (grey gear, green Clean, blue Connect) and circular. Evidence: `oven_screen_3`.
9. **Calm and sparse.** Almost no chrome: no title bars on home, no hint text, sentence-case labels. Evidence: all screen renders; TechCrunch's "isn't cluttered".
10. **A pleasant tune when done, not an alarm.** Evidence: Reviewed; the Melody/Muffle/Blaster themes.

## 6. Gaps: what I could not verify

- **Page dots.** None appear in June's official home renders. The brief's "dot page indicators" claim is unconfirmed. Clock-only-on-page-1 is confirmed.
- **On-oven temperature and time setting** after tapping Bake (ruler, wheel, or +/−). I only have the app's ruler.
- **On-oven cooking screen interaction.** How Cook Settings opens, whether Stop is one tap, and whether it asks for confirmation.
- **The oven's door-open, offline and error screens.**
- **What the preheat ring's dot means, and whether it animates.** Also whether a green done ring appears on the oven.
- **Screen transitions and animations** on the oven. There is no footage of them.
- **Exact button gradient hexes on the oven.** Photos are affected by camera white balance, and the LCD black reads as navy in photos.
- **App multi-oven support.** No evidence found.
- **Oven UI source.** The oven's UI app (`com.junelife.device.chef`, inside the eMMC image) was not extracted. It would settle all of the above.
- **Manuals, patents, portfolios.** The archive.org manual PDFs are truncated at 1 MB, so I used manualslib instead. I found no patent UI figures and no designer portfolio.
