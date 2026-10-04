/* July Oven card — concept d2 "Still Glass" (budget first).
 * One job per state, fixed slots, five element types at most. Glass is expressed through the
 * surface (near-black with one specular sheen), light that comes only from heat (the heat line and
 * the mode glyphs), one thin condensed numeral, and restraint.
 */
(function () {
  "use strict";
  const HX = window.HX;
  const ID = "d2";
  const CLOCK = "6:18", DATE = "Tuesday, September 22";
  const HEATING = new Set(["preheat", "ready", "cooking", "cookingProbe", "doorOpen", "offline"]);
  const ITEMS = HX.MODES.concat([["settings", "Settings"]]);
  // Two rows of tiles, as on the oven: 4 across on a standard card (2 pages), 7 on a wall panel (1 page).
  function pagesFor(size) {
    const cols = size === "wall" ? 7 : 4, rows = 2, per = cols * rows, pages = [];
    for (let i = 0; i < ITEMS.length; i += per) pages.push(ITEMS.slice(i, i + per));
    return { cols, rows, pages };
  }

  // ---- Icons -------------------------------------------------------------------------------------
  const svg = (vb, body, cls = "") => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
  const ST = {
    off: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>',
    preheat: '<path d="M10 17V3.8M4.6 9.2 10 3.8l5.4 5.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    cooking: '<g transform="scale(1.25)"><path d="M8.3 1.2c.4 2.6 4.4 4.2 4.4 8.4A4.7 4.7 0 0 1 3.3 9.8c0-2.1 1-3.4 2.1-4.3.1 1.6.9 2.5 1.7 2.7-.5-2.2-.1-4.6 1.2-7z" fill="currentColor"/></g>',
    ready: '<circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.6 10.3l2.3 2.3 4.6-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    done: '<circle cx="10" cy="10" r="8.5" fill="currentColor"/><path d="M6.3 10.3l2.6 2.6 4.9-5.4" fill="none" stroke="var(--knock)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    door: '<path d="M10 2.2 18.6 17.4H1.4z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M10 7.6v4.6M10 14.6v.2" stroke="var(--knock)" stroke-width="2" stroke-linecap="round"/>',
    offline: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3.2 2.4"/><path d="M4.2 15.8 15.8 4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  const statusIcon = { off: "off", preheat: "preheat", ready: "ready", cooking: "cooking", cookingProbe: "cooking", doorOpen: "door", done: "done", offline: "offline" };
  const I = {
    stop: svg("0 0 16 16", '<rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="currentColor"/>', "d2-ic"),
    power: svg("0 0 16 16", '<path d="M8 1.8v6M4.3 4.2a5.4 5.4 0 1 0 7.4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic"),
    camOff: svg("0 0 24 24", '<path d="M3 7.5h3l1.6-2h6.8l1.6 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', "d2-ic"),
    back: svg("0 0 24 24", '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', "d2-ic"),
    close: svg("0 0 24 24", '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic"),
    chev: svg("0 0 24 24", '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', "d2-ic"),
    minus: svg("0 0 24 24", '<path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic"),
    plus: svg("0 0 24 24", '<path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic"),
    check: svg("0 0 24 24", '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>', "d2-ic")
  };
  // Mode glyphs: the heating elements the mode uses (the oven's own tile language).
  const g = (d) => `<path d="${d}"/>`;
  const GLYPH = {
    bake: g("M10 37h28"),
    broil: g("M10 11h28"),
    roast: g("M10 11h28M10 37h28"),
    toast: g("M10 11h7M20.5 11h7M31 11h7M10 37h7M20.5 37h7M31 37h7"),
    reheat: g("M16 11q-5 4.5 0 9t0 9t0 8M24 11q-5 4.5 0 9t0 9t0 8M32 11q-5 4.5 0 9t0 9t0 8"),
    airfry: '<circle cx="24" cy="24" r="12.5" class="thin"/>' + [0, 120, 240].map((a) => `<path class="fill" transform="rotate(${a} 24 24)" d="M24 24c-1.5-5.5 1-9.5 5-9.2 2.6.3 2.8 4.4-5 9.2z"/>`).join(""),
    grill: g("M11 30 21 18M17 36 32 18M27 36 37 24"),
    proof: '<path class="fill" d="M10 35c0-8 6.5-12.5 14-12.5S38 27 38 35z"/><path d="M8 37h32"/>',
    pizza: '<circle cx="21" cy="21" r="9.5" class="thin"/><path d="M28 28l9 9"/><circle class="fill" cx="18.5" cy="19" r="1.8"/><circle class="fill" cx="23.5" cy="23.5" r="1.8"/>',
    dehydrate: '<circle class="fill" cx="24" cy="24" r="6.5"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a} 24 24)" d="M24 8.5v4"/>`).join(""),
    slowcook: '<path class="fill" d="M12 22h24v7.5a6.5 6.5 0 0 1-6.5 6.5h-11A6.5 6.5 0 0 1 12 29.5z"/><path d="M9 18.5h30M21 14h6"/>',
    warm: '<circle class="fill" cx="14" cy="24" r="3.2"/><circle class="fill" cx="24" cy="24" r="3.2"/><circle class="fill" cx="34" cy="24" r="3.2"/>',
    settings: '<circle cx="24" cy="24" r="9" class="thin"/><circle cx="24" cy="24" r="3.5" class="thin"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a} 24 24)" d="M24 11.5v3.5"/>`).join("")
  };
  const glyph = (k) => `<svg class="d2-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${GLYPH[k] || ""}</svg>`;

  // ---- The budget, per state (one job line each; see d2.md) -------------------------------------
  function tone(k) {
    return { off: "rest", preheat: "heat", cooking: "heat", cookingProbe: "heat", ready: "ok", done: "ok", doorOpen: "warn", offline: "stale" }[k];
  }
  function model(s) {
    const m = { tone: tone(s.key), word: s.word, icon: statusIcon[s.key], action: HEATING.has(s.key) ? "stop" : s.key === "done" ? "off" : null, chips: false, spark: false, stale: !!s.stale };
    const minFrom = (t) => (t || "").replace(/^about /, "~");
    switch (s.key) {
      case "off":
        Object.assign(m, { hero: CLOCK, qual: null, a: "", b: "", ca: s.oven });
        break;
      case "preheat":
        Object.assign(m, { hero: `${s.cav}°`, qual: null, bar: [s.pct, "preheat"], a: `Ready in ${s.eta}`, b: `Heating to ${s.tgt} °F · ${s.modeLabel}`, ca: `Ready in ${minFrom(s.eta)}` });
        break;
      case "ready":
        Object.assign(m, { hero: `${s.cav}°`, qual: "holding", bar: [1, "heat"], a: "Put food in", b: `${s.timer.replace(/ \(starts when food goes in\)/, "")} timer starts when food goes in`, ca: "Put food in" });
        break;
      case "cooking":
        Object.assign(m, { hero: s.left, qual: "left", bar: [1 - s.timerPct, "heat"], a: `Done at ${s.doneAt}`, b: `Oven ${s.tgt} °F · food ${s.probe}°`, ca: `Done ${s.doneAt}`, chips: true, spark: true });
        break;
      case "cookingProbe":
        Object.assign(m, { hero: `${s.probe}°`, qual: `food · target ${s.probeTgt}°`, bar: [(s.probe - 45) / (s.probeTgt - 45), "heat"], a: `Done around ${s.doneAt}`, b: `${s.modeLabel} at ${s.tgt} °F`, ca: `Done ~${s.doneAt}`, spark: true });
        break;
      case "doorOpen":
        Object.assign(m, { hero: s.left, qual: "left · paused", bar: [1 - s.timerPct, "paused"], a: "Close the door to keep cooking", b: `Heating paused · oven ${s.cav} °F`, ca: "Heating paused", spark: true });
        break;
      case "done":
        Object.assign(m, { hero: "Take food out", heroText: true, qual: null, bar: [1, "done"], a: `Done ${s.doneAgo}`, b: `Food ${s.probe} °F · ${s.modeLabel}`, ca: s.doneAgo });
        break;
      case "offline":
        Object.assign(m, { hero: `${s.cav}°`, qual: s.lastUpdate, bar: [0.5, "stale"], a: `No update for ${s.lastUpdate.replace(/ ago$/, "")}`, b: `Last seen cooking · ${s.left} left`, ca: s.lastUpdate });
        break;
    }
    return m;
  }

  // ---- Parts -------------------------------------------------------------------------------------
  const deg = (h) => String(h).replace(/°/g, '<span class="d2-deg">°</span>');
  const status = (m, cls = "") => `<span class="d2-st t-${m.tone} ${cls}">${svg("0 0 20 20", ST[m.icon], "d2-sti")}<b>${m.word}</b></span>`;

  function cam(s, o = {}) {
    if (s.camera === "off") {
      return `<button class="d2-cam is-off" aria-label="Camera off. Turn on for 5 minutes">${I.camOff}${o.compact ? "" : "<span>Turn on</span>"}</button>`;
    }
    const live = s.frameAge === "Live";
    const pill = `<span class="d2-pill${live ? "" : " is-old"}">${live ? "LIVE" : o.compact ? s.frameAge.replace(/ ago$/, "") : s.frameAge}</span>`;
    const btn = `<button class="d2-cam${s.stale ? " is-stale" : ""}" aria-label="Oven camera, ${live ? "live" : "picture from " + s.frameAge}. Open larger view"><span class="d2-win">${HX.cameraStill(s)}</span>${pill}</button>`;
    if (o.compact) return btn;
    return btn;
  }

  function bar(m) {
    const [p, k] = m.bar;
    return `<div class="d2-bar k-${k}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}" style="--p:${p.toFixed(3)}"><i></i></div>`;
  }

  function chips(s) {
    return `<div class="d2-chips" role="group" aria-label="Add time to the ${s.oven} timer">${[1, 5, 10].map((n) => `<button class="d2-chip" aria-label="Add ${n} minute${n > 1 ? "s" : ""} to ${s.oven}">+${n}</button>`).join("")}<span class="d2-min" aria-hidden="true">min</span></div>`;
  }

  function action(s, m, o = {}) {
    if (!m.action) return "";
    const off = m.action === "off";
    const word = off ? "Turn off" : "Stop";
    const label = o.multi ? `<span class="d2-two">${word}<small>${s.oven}</small></span>` : `<span>${word}</span>`;
    return `<button class="d2-stop${off ? " is-off" : ""}" aria-label="${word} the ${s.oven} oven">${off ? I.power : I.stop}${label}</button>`;
  }

  function spark() {
    const H = HX.HISTORY, W = 300, h = 44;
    const x = (t) => (t / H.end) * W, y = (v) => h - 4 - ((v - 60) / (420 - 60)) * (h - 8);
    const pts = H.cav.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const doors = H.doors.map(([a, b]) => `<rect class="d2-sp-door" x="${x(a).toFixed(1)}" y="0" width="${Math.max(3, x(b) - x(a)).toFixed(1)}" height="${h}"/>`).join("");
    return `<button class="d2-spark" aria-label="Oven temperature over the last 30 minutes; the door was opened once. Open the graph"><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" aria-hidden="true">${doors}<polyline points="${pts}" vector-effect="non-scaling-stroke"/></svg><span class="d2-sp-cap"><span>Oven °F · last 30 min</span><span class="d2-sp-key"><i></i>door open</span></span></button>`;
  }

  function tile([k, label]) {
    const util = k === "settings";
    return `<button class="d2-tile${util ? " is-util" : ""}" aria-label="${util ? "Settings" : label + ": choose settings and start"}"><span class="d2-face">${glyph(k)}</span><span class="d2-lab">${label}</span></button>`;
  }

  // ---- Card bodies ------------------------------------------------------------------------------
  function idle(s, m, o = {}) {
    const { cols, rows, pages } = pagesFor(o.size);
    const n = pages.length;
    return `<div class="d2-idle${n > 1 ? "" : " no-dots"}">
      <div class="d2-top">
        <div class="d2-id"><div class="d2-name">${s.oven}</div>${status(m)}</div>
        <div class="d2-clock" role="timer" aria-label="Time ${CLOCK}, ${DATE}"><div class="d2-time">${CLOCK}</div><div class="d2-date">${DATE}</div></div>
        <div class="d2-camslot">${cam(s)}</div>
      </div>
      <div class="d2-pager" data-hx-scroll aria-label="Cook modes${n > 1 ? `, ${n} pages` : ""}">${pages.map((p, i) => `<div class="d2-page" style="--cols:${cols};--rows:${rows}" role="group" aria-label="Page ${i + 1} of ${n}">${p.map(tile).join("")}</div>`).join("")}</div>
      ${n > 1 ? `<div class="d2-dots">${pages.map((_, i) => `<button class="d2-dot" data-i="${i}" aria-label="Show page ${i + 1} of ${n}"${i === 0 ? ' aria-current="true"' : ""}><i></i></button>`).join("")}</div>` : ""}
    </div>`;
  }

  function run(s, m, o) {
    return `<div class="d2-run${m.heroText ? " is-texthero" : String(m.hero).includes("°") ? " has-deg" : ""}">
      <div class="d2-name d2-title">${s.oven}</div>
      <div class="d2-foot">${action(s, m, o)}</div>
      <div class="d2-up">
        <div class="d2-hero${m.heroText ? " is-text" : ""}${m.stale ? " is-stale" : ""}">${deg(m.hero)}</div>
        <div class="d2-sline">${status(m)}${m.qual ? `<span class="d2-q">· ${m.qual}</span>` : ""}</div>
      </div>
      <div class="d2-barrow">${bar(m)}</div>
      <div class="d2-low">
        <div class="d2-a">${m.a}</div>
        <div class="d2-b">${m.b}</div>
        ${o.size === "wall" && m.spark ? spark() : ""}
      </div>
      ${m.chips ? `<div class="d2-quick">${chips(s)}</div>` : ""}
      <div class="d2-camcol">${cam(s)}</div>
    </div>`;
  }

  function compact(s, m, o = {}) {
    const hero = m.hero;
    const line1 = o.multi ? `<div class="d2-m1 d2-cname">${s.oven}</div>` : `<div class="d2-m1">${status(m)}</div>`;
    const line2 = o.multi ? `<div class="d2-m2">${status(m, "is-small")}</div>` : `<div class="d2-m2">${m.ca}</div>`;
    let act = action(s, m, o);
    if (!act && s.key === "off") act = `<button class="d2-ghost" aria-label="Choose a cook mode for ${s.oven}">Start…</button>`;
    return `<div class="d2-crow">
      <div class="d2-ccam">${cam(s, { compact: true })}</div>
      <div class="d2-chero${m.heroText ? " is-text" : ""}${m.stale ? " is-stale" : ""}">${deg(hero)}</div>
      <div class="d2-meta">${line1}${line2}</div>
      ${act}
    </div>`;
  }

  function body(s, o) {
    const m = model(s);
    if (o.size === "compact") return compact(s, m, o);
    return s.key === "off" ? idle(s, m, o) : run(s, m, o);
  }

  function render(s, opts) {
    const o = { size: opts.size, multi: false };
    return `<div class="c-d2 d2-${opts.theme || "auto"} d2-${opts.size}${s.key === "off" ? " is-rest" : ""}"><div class="d2-pane">${body(s, o)}</div></div>`;
  }

  // ---- Several ovens: the heating oven is in focus; every other oven is a row below --------------
  function multi(ovens, opts) {
    let f = ovens.findIndex((o) => HEATING.has(o.key));
    if (f < 0) f = 0;
    const focus = ovens[f];
    const others = ovens.filter((o, i) => i !== f);
    const loud = others.filter((o) => HEATING.has(o.key) || o.key === "done");
    const quiet = others.filter((o) => !(HEATING.has(o.key) || o.key === "done"));
    const rows = loud.map((o) => `<div class="d2-other" role="button" aria-label="Show ${o.oven}">${compact(o, model(o), { multi: true, size: "compact" })}</div>`).join("") +
      (quiet.length ? `<div class="d2-other is-quiet" data-hx-scroll role="group" aria-label="Ovens that are off">${quiet.map((o) => `<button class="d2-quiet" aria-label="Show ${o.oven}, off">${svg("0 0 20 20", ST.off, "d2-sti")}<span class="d2-qn">${o.oven}</span><span class="d2-qs">Off</span></button>`).join("")}</div>` : "");
    const html = `<div class="c-d2 d2-${opts.theme || "auto"} d2-multi d2-standard"><div class="d2-pane">${body(focus, { size: "standard", multi: true })}</div>${rows}</div>`;
    const cap = ovens.map((o) => `${o.oven} ${o.word.toLowerCase()}`).join(", ");
    return HX.frame(html, 12, 6 + loud.length + (quiet.length ? 1 : 0), opts.width, 1, cap);
  }

  // ---- Detail view (HA more-info style dialog) ---------------------------------------------------
  function dHeader(s, m, page) {
    const tabs = [["now", "Now"], ["graph", "Graph"], ["history", "History"], ["settings", "Settings"]];
    return `<div class="d2-dhead"><button class="d2-icbtn" aria-label="Close">${I.close}</button><div class="d2-dtitle"><div class="d2-name">${s.oven}</div>${status(m)}</div><span class="d2-icbtn" aria-hidden="true"></span></div>
    <div class="d2-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === page}" class="d2-tab">${l}</button>`).join("")}</div>`;
  }

  function stepper(label, value, sub, dec, inc) {
    return `<div class="d2-row"><div class="d2-rt"><div class="d2-rl">${label}</div><div class="d2-rv">${value}</div>${sub ? `<div class="d2-rs">${sub}</div>` : ""}</div><div class="d2-rc"><button class="d2-round" aria-label="${dec}">${I.minus}</button><button class="d2-round" aria-label="${inc}">${I.plus}</button></div></div>`;
  }

  function detailNow(s, m) {
    const live = s.frameAge === "Live";
    const camBlock = s.camera === "off"
      ? `<div class="d2-dcam is-off">${I.camOff}<div>Camera off</div><button class="d2-ghost">Turn on for 5 min</button></div>`
      : `<div class="d2-dcam"><div class="d2-win">${HX.cameraStill(s)}</div></div><div class="d2-dcamrow"><span class="d2-age${live ? " is-live" : ""}"><i></i>${live ? "Live · new picture every 2 s" : s.frameAge}</span><button class="d2-ghost">Watch video · 5 min</button></div>`;
    const heroRow = s.key === "off" ? "" : `<div class="d2-dhero"><div><div class="d2-hero${m.heroText ? " is-text" : ""}">${deg(m.hero)}</div>${m.qual ? `<div class="d2-qual">${m.qual}</div>` : ""}</div><div class="d2-dproj"><div class="d2-a">${m.a}</div></div></div>${m.bar ? bar(m) : ""}`;
    const rows = HEATING.has(s.key) && s.key !== "offline" ? `<div class="d2-rows">
      ${stepper("Oven", `${s.tgt || "—"} °F`, s.modeLabel, "Lower oven temperature 5 degrees", "Raise oven temperature 5 degrees")}
      <div class="d2-row"><div class="d2-rt"><div class="d2-rl">Timer</div><div class="d2-rv">${s.left ? s.left + " left" : "Not set"}</div>${s.doneAt ? `<div class="d2-rs">Done at ${s.doneAt}</div>` : ""}</div><div class="d2-rc">${[1, 5, 10].map((n) => `<button class="d2-chip" aria-label="Add ${n} minutes">+${n}</button>`).join("")}</div></div>
      ${stepper("Food probe target", `${s.probeTgt || "—"} °F`, s.probe ? `Food is ${s.probe} °F now` : "Probe not in food", "Lower food target 5 degrees", "Raise food target 5 degrees")}
    </div>
    <div class="d2-ack">${I.check}<span>Oven confirmed: timer +5 min · 6:29 PM</span></div>` : "";
    const stop = m.action ? `<button class="d2-stop d2-wide${m.action === "off" ? " is-off" : ""}">${m.action === "off" ? I.power : I.stop}<span>${m.action === "off" ? "Turn off oven" : "Stop cooking"}</span></button>` : "";
    return `${camBlock}${heroRow}${rows}${stop}`;
  }

  function detailGraph() {
    const H = HX.HISTORY, W = 388, Ht = 232, L = 36, R = 58, T = 22, B = 26;
    const x = (t) => L + (t / H.end) * (W - L - R), y = (v) => T + (1 - (v - 40) / (440 - 40)) * (Ht - T - B);
    const line = (arr) => arr.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const grid = [100, 200, 300, 400].map((v) => `<path class="d2-gl" d="M${L} ${y(v)}H${W - R}"/><text class="d2-gt" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
    const xt = [0, 10, 20, 30].map((t) => `<text class="d2-gt" x="${x(t)}" y="${Ht - 8}" text-anchor="middle">${t}${t === 30 ? " min" : ""}</text>`).join("");
    const doors = H.doors.map(([a, b]) => `<rect class="d2-gdoor" x="${x(a)}" y="${T}" width="${x(b) - x(a)}" height="${Ht - T - B}"/><text class="d2-gdl" x="${(x(a) + x(b)) / 2}" y="${T - 7}" text-anchor="middle">Door</text>`).join("");
    const lc = H.cav[H.cav.length - 1], lp = H.probe[H.probe.length - 1];
    return `<div class="d2-gtitle"><span>This cook · 30 min</span><span class="d2-gleg"><i class="o"></i>Oven <i class="f"></i>Food <i class="d"></i>Door open</span></div>
    <svg class="d2-graph" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Oven and food temperature over 30 minutes. Oven reached 400 °F at 11 minutes. Door open from 13.4 to 14.8 minutes; oven dipped to 352 °F and recovered by 16 minutes. Food at 128 °F, target 145 °F.">
      ${grid}${doors}
      <path class="d2-gtgt o" d="M${L} ${y(H.cavTgt)}H${W - R}"/><path class="d2-gtgt f" d="M${L} ${y(H.probeTgt)}H${W - R}"/>
      <polyline class="d2-gline o" points="${line(H.cav)}"/><polyline class="d2-gline f" points="${line(H.probe)}"/>
      <text class="d2-gend" x="${W - R + 6}" y="${y(lc[1]) + 4}">${lc[1]}°</text><text class="d2-gend" x="${W - R + 6}" y="${y(lp[1]) + 4}">${lp[1]}°</text>
      <text class="d2-gt" x="${W - R + 6}" y="${y(H.probeTgt) - 6}">145 goal</text>
      ${xt}
    </svg>
    <p class="d2-gsum">The door was open once, for 1 min 24 s at 13 min. The oven dipped to 352 °F and was back at 399 °F by 16 min.</p>`;
  }

  function detailHistory() {
    const rows = [
      ["Convection bake · 400 °F", "Today, 6:17 PM · 25 min · food 146 °F", HX.S.done],
      ["Roast · 350 °F", "Sunday, 5:40 PM · 48 min · food 145 °F", HX.S.done],
      ["Toast", "Sunday, 8:02 AM · 4 min", HX.S.done],
      ["Air fry · 400 °F", "Friday, 7:11 PM · 18 min", HX.S.done]
    ];
    return `<div class="d2-list">${rows.map(([t, sub, st]) => `<button class="d2-hrow"><span class="d2-hthumb">${HX.cameraStill(st)}</span><span class="d2-rt"><span class="d2-rv">${t}</span><span class="d2-rs">${sub}</span></span>${I.chev}</button>`).join("")}</div>
    <p class="d2-note">Each cook keeps its graph and last camera picture.</p>`;
  }

  function sw(label, on, sub) {
    return `<div class="d2-row"><div class="d2-rt"><div class="d2-rv">${label}</div>${sub ? `<div class="d2-rs">${sub}</div>` : ""}</div><span class="d2-switch${on ? " on" : ""}" role="switch" aria-checked="${on}" tabindex="0" aria-label="${label}"><i></i></span></div>`;
  }

  function detailSettings(s) {
    return `<div class="d2-group"><div class="d2-gh">Alerts</div>
      ${sw("Ready to put food in", true)}${sw("Done / food reached target", true)}${sw("Door left open while heating", true, "After 30 s")}${sw("Oven stopped answering while heating", true)}</div>
    <div class="d2-group"><div class="d2-gh">Camera</div>
      ${sw("Turn on when cooking starts", true)}${sw("Keep on after done", true, "10 min, then off")}</div>
    <div class="d2-group"><div class="d2-gh">Remote start</div>
      <div class="d2-row"><div class="d2-rt"><div class="d2-rv">Allowed for Bake and Roast</div><div class="d2-rs">Change it on the oven: Settings › App permissions</div></div></div></div>
    <div class="d2-group"><div class="d2-gh">Oven</div>
      <div class="d2-row"><div class="d2-rt"><div class="d2-rv">${s.oven} · June 3rd gen</div><div class="d2-rs">june-local 0.9 · connected, updated ${s.lastUpdate}</div></div></div></div>`;
  }

  function detailStart() {
    return `<div class="d2-dhead"><button class="d2-icbtn" aria-label="Back to modes">${I.back}</button><div class="d2-dtitle"><div class="d2-name">Bake · Kitchen</div><span class="d2-st t-rest"><b>Step 2 of 2 · Review</b></span></div><button class="d2-icbtn" aria-label="Cancel">${I.close}</button></div>
    <div class="d2-review">
      <div class="d2-rface"><span class="d2-face">${glyph("bake")}</span></div>
      <dl class="d2-dl"><div><dt>Oven</dt><dd>Kitchen</dd></div><div><dt>Temperature</dt><dd>400 °F, convection</dd></div><div><dt>Timer</dt><dd>25 min, starts when food goes in</dd></div><div><dt>Preheat</dt><dd>Yes — alert when ready</dd></div></dl>
    </div>
    <button class="d2-go">Start baking on Kitchen</button>
    <button class="d2-ghost d2-wide">Change settings</button>
    <p class="d2-note">This review closes in <b>4:52</b>. Nothing heats until you press Start. Remote start is allowed on this oven for Bake and Roast.</p>`;
  }

  function detail(s, { page, theme }) {
    const m = model(s);
    let inner;
    if (page === "start") inner = detailStart();
    else {
      const content = page === "graph" ? detailGraph() : page === "history" ? detailHistory() : page === "settings" ? detailSettings(s) : detailNow(s, m);
      inner = dHeader(s, m, page) + `<div class="d2-dbody">${content}</div>`;
    }
    return `<div class="c-d2 d2-${theme || "auto"} d2-detail">${inner}</div>`;
  }

  // ---- Wiring: idle pager dots (tap alternative to swipe); instant, no animation ----------------
  function wire(root) {
    root.querySelectorAll(".c-d2 .d2-idle").forEach((el) => {
      const sc = el.querySelector(".d2-pager"), dots = [...el.querySelectorAll(".d2-dot")];
      const mark = (i) => dots.forEach((d, j) => (j === i ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
      dots.forEach((d, i) => d.addEventListener("click", () => { sc.scrollLeft = i * sc.clientWidth; mark(i); }));
      sc.addEventListener("scroll", () => mark(Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth))), { passive: true });
    });
  }

  // ---- Styles -----------------------------------------------------------------------------------
  const css = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@400;500;600&family=Barlow+Condensed:wght@300;400;500&display=swap');
.c-d2{--f:'Barlow Semi Condensed','Barlow',system-ui,sans-serif;--fn:'Barlow Condensed','Barlow',system-ui,sans-serif;position:relative;width:100%;height:100%;box-sizing:border-box;overflow:hidden;font-family:var(--f);color:var(--fg);border-radius:var(--ha-card-border-radius,12px);
  background:linear-gradient(112deg,transparent 0 63%,var(--sheen) 63.4%,transparent 84%),linear-gradient(180deg,var(--bg) 0%,var(--bg2) 100%);box-shadow:inset 0 0 0 1px var(--rim);-webkit-font-smoothing:antialiased}
.c-d2 *{box-sizing:border-box}
.c-d2 button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.c-d2 button:focus-visible,.c-d2 [tabindex]:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.c-d2 svg{display:block}
/* ---- Looks ---- */
.c-d2.d2-dark{--bg:#08090b;--bg2:#0f1115;--sheen:rgba(255,255,255,.04);--rim:rgba(255,255,255,.07);--fg:#f4f4f5;--fg2:#a1a1aa;--line:rgba(255,255,255,.10);--track:rgba(255,255,255,.11);
  --ember:#ff7a2e;--ember2:#ffb04a;--glow:rgba(255,106,26,.55);--glyph:#ffc247;--gglow:rgba(255,106,26,.75);--green:#4ade80;--amber:#fbbf24;--cool:#5ab0e8;--food:#7cc4f2;--grey:#8b9099;
  --btn:#f4f4f5;--btnfg:#0a0a0b;--chipb:rgba(255,255,255,.30);--win:#000;--knock:#08090b;--focus:#7cc4f2;--hw:300;
  --tA:#1d1210;--tB:#2e1511;--tRim:rgba(255,122,64,.36);--tGlow:rgba(255,86,24,.34);--tSheen:rgba(255,255,255,.07);--uA:#191a1d;--uB:#24262a;--uRim:rgba(255,255,255,.16);--uGlyph:#c9ccd1;--dlg:#101216;color-scheme:dark}
.c-d2.d2-light{--bg:#ffffff;--bg2:#f7f7f5;--sheen:rgba(255,255,255,0);--rim:rgba(0,0,0,.08);--fg:#18181b;--fg2:#5b5f66;--line:rgba(0,0,0,.10);--track:rgba(0,0,0,.09);
  --ember:#d9480f;--ember2:#f08a3c;--glow:transparent;--glyph:#d9480f;--gglow:rgba(240,122,42,.0);--green:#15803d;--amber:#b45309;--cool:#2f80c8;--food:#1f6fb2;--grey:#71717a;
  --btn:#18181b;--btnfg:#ffffff;--chipb:rgba(0,0,0,.30);--win:#111;--knock:#ffffff;--focus:#1f6fb2;--hw:400;
  --tA:#fbf7f4;--tB:#f5e9e2;--tRim:rgba(217,72,15,.26);--tGlow:rgba(240,122,42,.16);--tSheen:rgba(255,255,255,.7);--uA:#f6f6f7;--uB:#ececee;--uRim:rgba(0,0,0,.12);--uGlyph:#5e6567;--dlg:#ffffff;color-scheme:light}
.c-d2.d2-auto{--bg:var(--ha-card-background,var(--card-background-color,#fff));--bg2:var(--ha-card-background,var(--card-background-color,#fff));--sheen:transparent;--rim:var(--ha-card-border-color,var(--divider-color,rgba(0,0,0,.12)));
  --fg:var(--primary-text-color,#212121);--fg2:var(--secondary-text-color,#727272);--line:var(--divider-color,rgba(0,0,0,.12));--track:color-mix(in srgb,var(--primary-text-color,#212121) 12%,transparent);
  --ember:#e8590c;--ember2:#f5933f;--glow:rgba(232,89,12,.35);--glyph:#e8590c;--gglow:rgba(232,89,12,.35);--green:#2e9e4f;--amber:#d97706;--cool:#3b8fd9;--food:#3b8fd9;--grey:var(--secondary-text-color,#727272);
  --btn:var(--primary-text-color,#212121);--btnfg:var(--ha-card-background,var(--card-background-color,#fff));--chipb:color-mix(in srgb,var(--primary-text-color,#212121) 32%,transparent);--win:#000;--knock:var(--ha-card-background,var(--card-background-color,#fff));--focus:var(--primary-color,#03a9f4);--hw:300;
  --tA:color-mix(in srgb,var(--primary-text-color,#212121) 4%,transparent);--tB:color-mix(in srgb,#e8590c 11%,transparent);--tRim:color-mix(in srgb,#e8590c 32%,transparent);--tGlow:rgba(232,89,12,.16);--tSheen:transparent;
  --uA:color-mix(in srgb,var(--primary-text-color,#212121) 5%,transparent);--uB:color-mix(in srgb,var(--primary-text-color,#212121) 9%,transparent);--uRim:var(--divider-color,rgba(0,0,0,.12));--uGlyph:var(--secondary-text-color,#727272);--dlg:var(--ha-card-background,var(--card-background-color,#fff))}
/* ---- Sizes (all measures from the pane box: container query units) ---- */
.c-d2 .d2-pane{position:relative;width:100%;height:100%;container-type:size}
.c-d2.d2-standard{--lift:8cqh;--slh:26px;--px:16px;--py:14px;--camw:34cqw;--cg:16px;--rg:12px;--hs:min(26cqw,27cqh);--hts:min(9.5cqw,14cqh);--clock:min(15cqw,19cqh);--camoff:max(64px,16cqw);--tgap:clamp(10px,3.4cqw,20px);--tmax:88px}
.c-d2.d2-wall{--lift:0px;--slh:36px;--px:28px;--py:26px;--camw:30cqw;--cg:40px;--rg:20px;--hs:min(15cqw,25cqh);--hts:min(9cqw,16cqh);--clock:min(12cqw,19cqh);--camoff:min(11cqw,120px);--tgap:clamp(16px,3.4cqw,28px);--tmax:132px}
/* ---- Status mark: shape + colour + word ---- */
.c-d2 .d2-name{font:500 15px/20px var(--f);color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d2 .d2-st{display:flex;align-items:center;gap:6px;min-width:0;font:600 13px/20px var(--f);letter-spacing:.07em;text-transform:uppercase;color:var(--fg);white-space:nowrap}
.c-d2 .d2-st b{font-weight:600;overflow:hidden;text-overflow:ellipsis}
.c-d2 .d2-sti{width:16px;height:16px;flex:none;color:var(--tone,var(--grey))}
.c-d2 .t-heat{--tone:var(--ember)}.c-d2 .t-ok{--tone:var(--green)}.c-d2 .t-warn{--tone:var(--amber)}.c-d2 .t-stale,.c-d2 .t-rest{--tone:var(--grey)}
.c-d2 .t-heat .d2-sti{filter:drop-shadow(0 0 3px var(--glow))}
.c-d2 .d2-st.is-small{font-size:12px;line-height:16px}
.c-d2 .d2-st.is-small .d2-sti{width:14px;height:14px}
/* ---- Running states ---- */
.c-d2 .d2-run{height:100%;display:grid;grid-template-columns:minmax(0,1fr) var(--camw);grid-template-rows:auto var(--lift) auto auto auto minmax(0,1fr);column-gap:var(--cg);row-gap:var(--rg);padding:var(--py) var(--px)}
.c-d2 .d2-run>.d2-id{grid-column:1/3;grid-row:1;min-width:0;display:flex;justify-content:center;align-items:center;gap:10px;text-align:center}
.c-d2 .d2-run>.d2-id .d2-name{flex:0 1 auto;min-width:0}
.c-d2 .d2-up{grid-column:1;grid-row:3;align-self:start;min-width:0}
.c-d2 .d2-barrow{grid-column:1;grid-row:4;min-width:0}
.c-d2 .d2-barrow .d2-bar{margin-top:0}
.c-d2 .d2-low{grid-column:1;grid-row:5;align-self:start;min-height:0;min-width:0;display:flex;flex-direction:column}
.c-d2 .d2-low>:not(.d2-spark){flex:none}
.c-d2 .d2-low>.d2-a{margin-top:0}
.c-d2 .d2-camcol{grid-column:2;grid-row:3/6;align-self:start;min-width:0;position:relative;margin-top:calc(var(--hs) * .047)}
/* Every running state keeps the number box the same height, so the bar and camera never move:
   Done's text hero sits at the foot of a number-sized box, and on narrow cards two status lines
   are reserved because long qualifiers wrap there. */
.c-d2 .d2-run.is-texthero .d2-up{min-height:calc(var(--hs) * .84 + var(--slh));display:flex;flex-direction:column;justify-content:flex-end}
.c-d2 .d2-up{min-height:calc(var(--hs) * .84 + var(--slh))}
@container (max-width:340px){.c-d2 .d2-run{--slh:46px}}
.c-d2 .d2-run .d2-camcol .d2-age{position:absolute;left:0;right:0;top:100%}
.c-d2 .d2-idle .d2-name{font-size:22px;line-height:28px}
.c-d2.d2-wall .d2-idle .d2-name{font-size:33px;line-height:40px}
.c-d2 .d2-run>.d2-title{grid-column:1;grid-row:1;align-self:center;min-width:0;font-size:22px;line-height:28px}
.c-d2.d2-wall .d2-run>.d2-title{font-size:33px;line-height:40px}
.c-d2 .d2-sline{display:flex;flex-wrap:wrap;align-items:center;gap:0 8px;margin-top:6px;min-width:0}
.c-d2 .d2-sline .d2-st{flex:none}
.c-d2 .d2-sline .d2-q{font:400 14px/20px var(--f);color:var(--fg2);white-space:nowrap}
.c-d2.d2-wall .d2-sline{margin-top:10px;gap:12px}
.c-d2.d2-wall .d2-sline .d2-q{font-size:20px;line-height:26px}
.c-d2 .d2-foot{grid-column:2;grid-row:1;display:flex;min-width:0}
.c-d2 .d2-foot .d2-stop{width:100%;min-width:0}
/* Quick add sits in the bottom band, outside the centred group, so the number, status and bar
   stay at the same height whether or not a timer runs. */
.c-d2 .d2-quick{grid-column:1;grid-row:6;align-self:end;min-width:0}
.c-d2 .d2-hero{font-family:var(--fn);font-weight:var(--hw);font-size:var(--hs);line-height:.84;letter-spacing:-.005em;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--fg)}
.c-d2 .d2-hero.is-text{font-size:var(--hts);font-weight:400;line-height:1;letter-spacing:0}
.c-d2 .d2-hero.is-stale,.c-d2 .d2-chero.is-stale{opacity:.42}
.c-d2 .d2-qual{font:400 14px/18px var(--f);color:var(--fg2);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d2 .d2-bar{position:relative;flex:none;height:6px;border-radius:3px;background:var(--track);margin-top:12px}
.c-d2 .d2-bar i{position:absolute;left:0;top:0;bottom:0;width:calc(var(--p)*100%);border-radius:inherit}
.c-d2 .k-heat i{background:linear-gradient(90deg,var(--ember),var(--ember2));box-shadow:0 0 10px 1px var(--glow)}
.c-d2 .k-preheat i{background:linear-gradient(90deg,var(--cool),#e9c24a 60%,var(--ember));background-size:calc(100% / var(--p)) 100%;box-shadow:0 0 10px 1px var(--glow)}
.c-d2 .k-paused i{background:repeating-linear-gradient(90deg,var(--amber) 0 10px,transparent 10px 14px)}
.c-d2 .k-done i{background:var(--green)}
.c-d2 .k-stale i{background:repeating-linear-gradient(90deg,var(--grey) 0 5px,transparent 5px 9px)}
.c-d2 .d2-a{font:500 16px/21px var(--f);color:var(--fg);margin-top:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.c-d2 .d2-b{font:400 14px/19px var(--f);color:var(--fg2);margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* camera */
.c-d2 .d2-cam{position:relative;display:block;width:100%;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:var(--win);box-shadow:0 0 0 1px var(--line)}
.c-d2 .d2-win{display:block;width:100%;height:100%}
.c-d2 .d2-cam.is-off{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:transparent;box-shadow:none;border:1.5px dashed var(--chipb);color:var(--fg2);font:500 12px/1 var(--f)}
.c-d2 .d2-cam.is-off .d2-ic{width:20px;height:20px}
.c-d2 .d2-age{display:flex;align-items:center;gap:6px;margin-top:6px;font:400 12px/16px var(--f);color:var(--fg2);white-space:nowrap}
.c-d2 .d2-age i{width:6px;height:6px;border-radius:50%;background:var(--fg2);flex:none}
.c-d2 .d2-age.is-live i{background:var(--green)}
.c-d2 .d2-age.is-stale{color:var(--amber)}
.c-d2 .d2-age.is-stale i{background:transparent;box-shadow:inset 0 0 0 1.5px var(--amber)}
/* actions */
.c-d2 .d2-stop{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;min-width:max(96px,var(--camw));padding:0 14px;border-radius:12px;background:var(--btn);color:var(--btnfg);font:600 16px/1 var(--f);white-space:nowrap;flex:none}
.c-d2 .d2-stop .d2-ic{width:14px;height:14px}
/* 1. Stop (and Turn off) is red in every look: white on #c62828 is 5.6:1 */
.c-d2 .d2-stop{background:#c62828;color:#fff}
.c-d2 .d2-deg{font-size:.5em;vertical-align:top;line-height:1;margin-left:.03em;position:relative;top:.12em}
.c-d2 .d2-chips{display:flex;align-items:center;gap:6px;flex:none}
.c-d2 .d2-chip{position:relative;height:36px;min-width:56px;padding:0 12px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--chipb);font:500 16px/1 var(--f);color:var(--fg);font-variant-numeric:tabular-nums}
.c-d2 .d2-chip::before{content:"";position:absolute;inset:-6px 0}
.c-d2 .d2-min{display:none;margin-left:2px;font:400 13px/1 var(--f);color:var(--fg2)}
@container (min-width:420px){.c-d2 .d2-min{display:inline}}
@container (max-width:340px){.c-d2 .d2-foot{gap:8px}.c-d2 .d2-chips{gap:4px}}
.c-d2 .d2-ghost{display:inline-flex;align-items:center;justify-content:center;height:48px;padding:0 16px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--chipb);font:500 15px/1 var(--f);color:var(--fg);white-space:nowrap;flex:none}
/* wall layer: sparkline */
.c-d2 .d2-spark{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;max-height:84px;margin-top:16px;text-align:left;width:100%}
.c-d2 .d2-spark svg{flex:1 1 auto;min-height:18px;width:100%;overflow:visible}
.c-d2 .d2-spark polyline{fill:none;stroke:var(--ember);stroke-width:2.5;stroke-linejoin:round;filter:drop-shadow(0 0 3px var(--glow))}
.c-d2 .d2-sp-door{fill:var(--amber);opacity:.28}
.c-d2 .d2-sp-cap{display:flex;gap:14px;margin-top:6px;font:400 15px/18px var(--f);color:var(--fg2);white-space:nowrap}
.c-d2 .d2-sp-key{display:inline-flex;align-items:center;gap:6px}
.c-d2 .d2-sp-key i{width:12px;height:12px;border-radius:2px;background:var(--amber);opacity:.5}
/* wall scale-up (same elements, larger) */
.c-d2.d2-wall .d2-name{font-size:22px;line-height:28px}
.c-d2.d2-wall .d2-st{font-size:19px;line-height:26px;gap:9px}
.c-d2.d2-wall .d2-sti{width:22px;height:22px}
.c-d2.d2-wall .d2-qual{font-size:20px;line-height:26px;margin-top:6px}
.c-d2.d2-wall .d2-bar{height:10px;border-radius:5px;margin-top:0}
.c-d2.d2-wall .d2-a{font-size:26px;line-height:32px;margin-top:18px}
.c-d2.d2-wall .d2-b{font-size:20px;line-height:26px;margin-top:4px}
.c-d2.d2-wall .d2-cam{border-radius:16px}
.c-d2.d2-wall .d2-age{font-size:17px;line-height:22px;margin-top:10px}
.c-d2.d2-wall .d2-age i{width:9px;height:9px}
.c-d2.d2-wall .d2-stop{height:64px;border-radius:16px;font-size:22px;gap:12px}
.c-d2.d2-wall .d2-stop .d2-ic{width:20px;height:20px}
.c-d2.d2-wall .d2-chips{gap:10px}
.c-d2.d2-wall .d2-chip{height:44px;min-width:84px;border-radius:12px;font-size:22px}
.c-d2.d2-wall .d2-chip::before{inset:-8px 0}
.c-d2.d2-wall .d2-low .d2-spark{margin-top:10px;height:60px;min-height:0;flex:none}
.c-d2.d2-wall .d2-sp-cap{margin-top:4px}
.c-d2.d2-wall .d2-min{font-size:18px;margin-left:4px}
.c-d2.d2-wall .d2-cam.is-off{font-size:16px;gap:8px}
.c-d2.d2-wall .d2-cam.is-off .d2-ic{width:30px;height:30px}
/* ---- Idle home: clock, tiles in pages, dots ---- */
.c-d2 .d2-idle{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:var(--py) var(--px) 0}
.c-d2 .d2-top{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:start;column-gap:12px}
.c-d2 .d2-clock{text-align:center}
.c-d2 .d2-time{font-family:var(--fn);font-weight:300;font-size:var(--clock);line-height:.9;font-variant-numeric:tabular-nums;color:var(--fg)}
.c-d2 .d2-date{font:400 13px/18px var(--f);color:var(--fg2);margin-top:4px;white-space:nowrap}
.c-d2 .d2-camslot{justify-self:end;width:var(--camoff)}
.c-d2 .d2-pager{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:auto;scrollbar-width:none;overscroll-behavior-x:contain;min-height:0;container-type:size}
.c-d2 .d2-pager::-webkit-scrollbar{display:none}
/* Tiles fit the page both ways: --cols across, --rows down, each row a square plus its label */
.c-d2 .d2-page{--lab:23px;--rgap:10px;--tile:min(calc((100cqw - (var(--cols) - 1) * var(--tgap)) / var(--cols)),calc((100cqh - var(--rows) * var(--lab) - (var(--rows) - 1) * var(--rgap)) / var(--rows)),var(--tmax));flex:0 0 100%;min-width:0;scroll-snap-align:start;display:grid;grid-template-columns:repeat(var(--cols),var(--tile));justify-content:center;column-gap:var(--tgap);row-gap:var(--rgap);align-content:center}
.c-d2.d2-wall .d2-page{--lab:34px;--rgap:16px}
.c-d2 .d2-idle.no-dots{padding-bottom:var(--py)}
/* Centre the tile rows between the date and the visible dots: the dots' 48 px tap row puts the dot
   20 px down, so the tiles get the same space above them (the card's padding when there are no dots). */
.c-d2 .d2-idle{--dotpad:20px}
.c-d2.d2-wall .d2-idle{--dotpad:22px}
.c-d2 .d2-idle.no-dots{--dotpad:var(--py)}
.c-d2 .d2-pager{padding-top:var(--dotpad)}
.c-d2 .d2-tile{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0}
.c-d2 .d2-face{position:relative;display:block;width:var(--tile);aspect-ratio:1;border-radius:22%;overflow:hidden;
  background:radial-gradient(120% 75% at 50% 100%,var(--tGlow),transparent 62%),linear-gradient(180deg,var(--tA),var(--tB));box-shadow:inset 0 0 0 1px var(--tRim),inset 0 1px 0 var(--tSheen)}
.c-d2 .d2-face::after{content:"";position:absolute;inset:0;background:linear-gradient(118deg,transparent 0 56%,var(--tSheen) 56.5%,transparent 78%);opacity:.7;pointer-events:none}
.c-d2 .d2-glyph{position:absolute;left:16%;top:16%;width:68%;height:68%;fill:none;stroke:var(--glyph);stroke-width:4;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 2px var(--gglow)) drop-shadow(0 0 7px var(--gglow))}
.c-d2 .d2-glyph .fill{fill:var(--glyph);stroke:none}
.c-d2 .d2-glyph .thin{stroke-width:3}
.c-d2 .d2-tile.is-util .d2-face{background:linear-gradient(180deg,var(--uA),var(--uB));box-shadow:inset 0 0 0 1px var(--uRim),inset 0 1px 0 var(--tSheen)}
.c-d2 .d2-tile.is-util .d2-glyph{stroke:var(--uGlyph);filter:none}
.c-d2 .d2-lab{font:500 13px/16px var(--f);color:var(--fg);white-space:nowrap}
@container (max-width:400px){.c-d2 .d2-lab{font-size:12px}}
.c-d2 .d2-dots{display:flex;justify-content:center;height:48px}
.c-d2 .d2-dot{width:48px;height:48px;display:flex;align-items:center;justify-content:center}
.c-d2 .d2-dot i{width:8px;height:8px;border-radius:50%;background:var(--fg);opacity:.28}
.c-d2 .d2-dot[aria-current] i{opacity:1}
/* at rest: calm, dimmed glow (wall panels dim most) */
.c-d2.is-rest .d2-glyph{filter:drop-shadow(0 0 2px var(--gglow))}
.c-d2.d2-wall.is-rest .d2-time{color:var(--fg2)}
.c-d2.d2-wall.is-rest .d2-glyph{opacity:.8;filter:none}
.c-d2 .d2-tile:hover .d2-glyph,.c-d2 .d2-tile:focus-visible .d2-glyph{opacity:1;filter:drop-shadow(0 0 2px var(--gglow)) drop-shadow(0 0 7px var(--gglow))}
.c-d2.d2-wall .d2-name{font-size:22px}
.c-d2.d2-wall .d2-date{font-size:20px;line-height:26px;margin-top:6px}
.c-d2.d2-wall .d2-lab{font-size:19px;line-height:24px}
.c-d2.d2-wall .d2-tile{gap:10px}
.c-d2.d2-wall .d2-dots{height:56px}
.c-d2.d2-wall .d2-dot{width:56px;height:56px}
.c-d2.d2-wall .d2-dot i{width:11px;height:11px}
/* ---- Compact (12 x 1) ---- */
.c-d2 .d2-crow{height:100%;display:flex;align-items:center;gap:10px;padding:0 4px}
.c-d2 .d2-ccam{flex:none;width:64px;height:48px}
.c-d2 .d2-ccam .d2-cam{height:48px;border-radius:8px}
.c-d2 .d2-ccam .d2-cam.is-off{border-radius:8px}
.c-d2 .d2-pill{position:absolute;left:3px;bottom:3px;padding:2px 4px;border-radius:4px;background:rgba(0,0,0,.66);color:#fff;font:700 9px/1 var(--f);letter-spacing:.06em;white-space:nowrap}
.c-d2 .d2-pill.is-old{color:#fbbf24}
.c-d2 .d2-run .d2-pill{left:6px;bottom:6px;padding:3px 6px;border-radius:5px;font-size:11px}
.c-d2.d2-wall .d2-run .d2-pill{left:10px;bottom:10px;padding:5px 9px;border-radius:7px;font-size:15px}
.c-d2 .d2-chero{flex:none;font-family:var(--fn);font-weight:400;font-size:31px;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--fg)}
.c-d2 .d2-chero.is-text{font-size:20px;font-weight:500}
.c-d2 .d2-meta{flex:1 1 auto;min-width:0}
.c-d2 .d2-m1,.c-d2 .d2-m2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d2 .d2-m1 .d2-st{font-size:12px;line-height:18px}
.c-d2 .d2-m1 .d2-sti{width:14px;height:14px}
.c-d2 .d2-m2{font:400 13px/18px var(--f);color:var(--fg2)}
.c-d2 .d2-cname{font:600 15px/20px var(--f);color:var(--fg)}
.c-d2 .d2-crow .d2-stop{min-width:0;padding:0 14px;font-size:15px}
.c-d2 .d2-crow .d2-ghost{padding:0 14px}
@container (max-width:340px){.c-d2 .d2-crow{gap:8px}.c-d2 .d2-chero{font-size:27px}.c-d2 .d2-chero.is-text{font-size:16px}.c-d2 .d2-crow .d2-stop,.c-d2 .d2-crow .d2-ghost{padding:0 10px}}
/* ---- Several ovens ---- */
.c-d2.d2-multi{display:flex;flex-direction:column;container-type:inline-size}
.c-d2 .d2-two{display:flex;flex-direction:column;align-items:flex-start;line-height:1.05}
.c-d2 .d2-two small{font:500 12px/1.2 var(--f);opacity:.75}
.c-d2.d2-multi>.d2-pane{flex:1 1 auto;min-height:0;height:auto}
.c-d2 .d2-other{flex:none;height:64px;border-top:1px solid var(--line);display:flex;align-items:center}
.c-d2 .d2-other .d2-crow{width:100%;height:56px;padding:0 16px;gap:10px}
/* Other ovens' rows use the main pane's columns, so their Stop sits centred under the camera window
   (same column, its own width, never stretched) */
.c-d2 .d2-other .d2-crow{display:grid;grid-template-columns:auto auto minmax(0,1fr) var(--camw);align-items:center;column-gap:10px}
.c-d2 .d2-other .d2-crow>.d2-stop{grid-column:4;justify-self:stretch;width:100%}
.c-d2 .d2-other .d2-chero,.c-d2 .d2-other .d2-cname,.c-d2 .d2-other .d2-st b{color:var(--fg2)}
@container (max-width:400px){.c-d2 .d2-other .d2-ccam{display:none}}
.c-d2 .d2-other.is-quiet{padding:0 16px;gap:8px;overflow-x:auto;scrollbar-width:none}
.c-d2 .d2-other.is-quiet .d2-quiet{flex:none}
.c-d2 .d2-quiet{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 18px 0 14px;border-radius:24px;box-shadow:inset 0 0 0 1px var(--line);color:var(--fg2);font:500 15px/1 var(--f)}
.c-d2 .d2-quiet .d2-sti{width:14px;height:14px;color:var(--grey)}
.c-d2 .d2-qn{color:var(--fg)}
/* ---- Detail view ---- */
.c-d2.d2-detail{height:auto;overflow:visible;border-radius:24px;padding:6px 16px 18px;background:var(--dlg);box-shadow:inset 0 0 0 1px var(--rim),0 8px 30px rgba(0,0,0,.25)}
.c-d2 .d2-dhead{display:flex;align-items:center;gap:8px;height:64px}
.c-d2 .d2-dtitle{flex:1;min-width:0}
.c-d2 .d2-icbtn{width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:50%;flex:none}
.c-d2 .d2-icbtn .d2-ic{width:22px;height:22px}
.c-d2 .d2-tabs{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--track);margin-bottom:14px}
.c-d2 .d2-tab{flex:1;height:44px;border-radius:10px;font:500 14px/1 var(--f);color:var(--fg2)}
.c-d2 .d2-tab[aria-selected="true"]{background:var(--bg);color:var(--fg);box-shadow:0 1px 2px rgba(0,0,0,.18)}
.c-d2 .d2-dcam{width:100%;aspect-ratio:4/3;border-radius:14px;overflow:hidden;background:var(--win)}
.c-d2 .d2-dcam.is-off{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:transparent;border:1.5px dashed var(--chipb);color:var(--fg2)}
.c-d2 .d2-dcam.is-off>.d2-ic{width:32px;height:32px}
.c-d2 .d2-dcamrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 14px}
.c-d2 .d2-dcamrow .d2-age{margin:0;font-size:13px}
.c-d2 .d2-dcamrow .d2-ghost{height:48px;font-size:14px}
.c-d2 .d2-dhero{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.c-d2 .d2-dhero .d2-hero{font-size:64px}
.c-d2 .d2-dhero .d2-hero.is-text{font-size:36px}
.c-d2 .d2-dproj{text-align:right;padding-bottom:6px}
.c-d2 .d2-dproj .d2-a{margin:0}
.c-d2 .d2-rows{margin-top:10px}
.c-d2 .d2-row{display:flex;align-items:center;gap:12px;min-height:64px;padding:6px 0;border-bottom:1px solid var(--line)}
.c-d2 .d2-row:last-child{border-bottom:0}
.c-d2 .d2-rt{flex:1;min-width:0;display:flex;flex-direction:column}
.c-d2 .d2-rl{font:500 12px/16px var(--f);letter-spacing:.06em;text-transform:uppercase;color:var(--fg2)}
.c-d2 .d2-rv{font:500 16px/22px var(--f);color:var(--fg)}
.c-d2 .d2-rs{font:400 13px/18px var(--f);color:var(--fg2)}
.c-d2 .d2-rc{display:flex;gap:6px;flex:none}
.c-d2 .d2-round{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px var(--chipb)}
.c-d2 .d2-round .d2-ic{width:20px;height:20px}
.c-d2 .d2-ack{display:flex;align-items:center;gap:8px;margin:6px 0 14px;font:400 13px/18px var(--f);color:var(--fg2)}
.c-d2 .d2-ack .d2-ic{width:16px;height:16px;color:var(--green)}
.c-d2 .d2-wide{width:100%;min-width:0}
.c-d2 .d2-gtitle{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font:500 15px/20px var(--f);margin:2px 0 8px;flex-wrap:wrap}
.c-d2 .d2-gleg{display:flex;align-items:center;gap:6px;font:400 13px/18px var(--f);color:var(--fg2)}
.c-d2 .d2-gleg i{width:14px;height:3px;border-radius:2px;margin-left:6px}
.c-d2 .d2-gleg i.o{background:var(--ember)}.c-d2 .d2-gleg i.f{background:var(--food)}.c-d2 .d2-gleg i.d{height:12px;width:10px;background:var(--amber);opacity:.4}
.c-d2 .d2-graph{width:100%;height:auto;overflow:visible}
.c-d2 .d2-gl{stroke:var(--line);stroke-width:1}
.c-d2 .d2-gt{fill:var(--fg2);font:400 11px var(--f)}
.c-d2 .d2-gend{fill:var(--fg);font:600 12px var(--f)}
.c-d2 .d2-gdoor{fill:var(--amber);opacity:.22}
.c-d2 .d2-gdl{fill:var(--fg);font:600 11px var(--f)}
.c-d2 .d2-gline{fill:none;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.c-d2 .d2-gline.o{stroke:var(--ember)}.c-d2 .d2-gline.f{stroke:var(--food)}
.c-d2 .d2-gtgt{stroke-width:1.2;stroke-dasharray:4 4;opacity:.7}
.c-d2 .d2-gtgt.o{stroke:var(--ember)}.c-d2 .d2-gtgt.f{stroke:var(--food)}
.c-d2 .d2-gsum,.c-d2 .d2-note{font:400 14px/20px var(--f);color:var(--fg2);margin:10px 0 0}
.c-d2 .d2-list{display:flex;flex-direction:column}
.c-d2 .d2-hrow{display:flex;align-items:center;gap:12px;min-height:72px;padding:8px 0;border-bottom:1px solid var(--line);text-align:left}
.c-d2 .d2-hthumb{flex:none;width:64px;height:48px;border-radius:8px;overflow:hidden;background:var(--win)}
.c-d2 .d2-hrow>.d2-ic{width:20px;height:20px;color:var(--fg2);flex:none}
.c-d2 .d2-group{margin-bottom:14px}
.c-d2 .d2-gh{font:600 12px/16px var(--f);letter-spacing:.07em;text-transform:uppercase;color:var(--fg2);margin:6px 0 2px}
.c-d2 .d2-switch{flex:none;position:relative;width:52px;height:32px;border-radius:16px;background:var(--track);box-shadow:inset 0 0 0 1px var(--chipb)}
.c-d2 .d2-switch i{position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;background:var(--fg2)}
.c-d2 .d2-switch.on{background:var(--fg);box-shadow:none}
.c-d2 .d2-switch.on i{left:24px;background:var(--bg)}
.c-d2 .d2-review{display:flex;gap:16px;align-items:flex-start;padding:10px 0 18px}
.c-d2 .d2-rface{--tile:84px;flex:none}
.c-d2 .d2-dl{margin:0;flex:1;display:flex;flex-direction:column;gap:8px}
.c-d2 .d2-dl dt{font:500 12px/16px var(--f);letter-spacing:.06em;text-transform:uppercase;color:var(--fg2)}
.c-d2 .d2-dl dd{margin:0;font:500 16px/22px var(--f)}
.c-d2 .d2-go{width:100%;height:56px;border-radius:14px;background:linear-gradient(90deg,#f6a53a,#ea5a17);color:#1a0a02;font:600 18px/1 var(--f);margin-bottom:8px}
@media (prefers-reduced-motion:reduce){.c-d2 *{transition:none!important;animation:none!important}}
@media (forced-colors:active){.c-d2 .d2-bar i{background:CanvasText}.c-d2 .d2-stop{border:2px solid ButtonText}}
`;

  window.CONCEPTS[ID] = {
    name: "d2 · Still Glass (budget first)",
    css,
    sizes: { standard: [12, 6], wall: [24, 9, 2], compact: [12, 1] },
    render,
    multi,
    detailPages: ["now", "graph", "start", "history", "settings"],
    detail,
    wire
  };
})();
