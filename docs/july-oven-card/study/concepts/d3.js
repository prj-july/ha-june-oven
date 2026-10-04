/* D3 — "Door": the card is the oven's front. One pane of dark glass with two openings:
 * the window (camera, 4:3, top-left) and the screen (status, one thin numeral, Stop).
 * When the oven is off the window shrinks to a small dark pane and the glass shows the home.
 */
(function () {
  "use strict";
  const HX = window.HX;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---- Status: word + shape + colour ------------------------------------------------------------
  const MARK = {
    off: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="2"/>',
    up: '<path d="M8 1.8l5.6 6H10v6.4H6V7.8H2.4z" fill="currentColor"/>',
    target: '<circle cx="8" cy="8" r="6.1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="8" r="2.7" fill="currentColor"/>',
    dot: '<circle cx="8" cy="8" r="6" fill="currentColor"/>',
    warn: '<path d="M8 1.5l7.2 12.7H.8z" fill="currentColor"/><rect x="7.1" y="5.6" width="1.8" height="4.6" style="fill:var(--pane)"/><rect x="7.1" y="11.2" width="1.8" height="1.8" style="fill:var(--pane)"/>',
    check: '<circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.5 8.3l2.4 2.4 4.7-5" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--pane)"/>',
    offline: '<circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.6 2.1"/><path d="M2.6 13.4L13.4 2.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
  };
  const ST = {
    off: { word: "Off", mark: "off", c: "off" },
    preheat: { word: "Preheating", mark: "up", c: "heat" },
    ready: { word: "Ready", mark: "target", c: "ready" },
    cooking: { word: "Cooking", mark: "dot", c: "heat" },
    cookingProbe: { word: "Cooking", mark: "dot", c: "heat" },
    doorOpen: { word: "Door open", mark: "warn", c: "warn" },
    done: { word: "Done", mark: "check", c: "ready" },
    offline: { word: "Offline", mark: "offline", c: "stale" }
  };
  const mark = (k) => `<svg viewBox="0 0 16 16" aria-hidden="true">${MARK[k]}</svg>`;
  const status = (s) => { const t = ST[s.key]; return `<span class="d3-st d3-c-${t.c}">${mark(t.mark)}<span>${t.word}</span></span>`; };
  const heats = (s) => s.key !== "off";
  const verb = { bake: "baking", roast: "roasting", broil: "broiling", airfry: "air frying", toast: "toasting", reheat: "reheating" };

  // ---- What the screen says, per state (the budget table in d3.md) ------------------------------
  function model(s) {
    const probeStart = HX.HISTORY.probe[0][1];
    const pct = (v) => Math.max(0, Math.min(100, Math.round(v * 100)));
    switch (s.key) {
      case "preheat": return { hero: `${s.cav}°`, heroSR: `${s.cav} degrees`, q: `to ${s.tgt}°`, bar: { p: pct(s.pct), k: "thermal", sr: `${pct(s.pct)} percent of the way to ${s.tgt} degrees` }, f1: s.modeLabel, f2: `Ready in ${s.eta}`, chips: null };
      case "ready": return { hero: `${s.cav}°`, heroSR: `${s.cav} degrees`, q: "preheated", bar: { p: 100, k: "ready", sr: "At temperature" }, f1: s.modeLabel, f2: "Put food in", chips: null };
      case "cooking": return { hero: s.left, heroSR: `${s.left} left`, q: `left · done ${s.doneAt}`, bar: { p: pct(s.timerPct), k: "heat", sr: "Half of the 25 minute timer remains" }, f1: `${s.modeLabel} ${s.tgt}°`, f2: `Food ${s.probe}° of ${s.probeTgt}°`, chips: "timer" };
      case "cookingProbe": return { hero: `${s.probe}°`, heroSR: `Food ${s.probe} degrees`, q: `food · target ${s.probeTgt}°`, bar: { p: pct((s.probe - probeStart) / (s.probeTgt - probeStart)), k: "probe", sr: `Food is ${s.probe} of ${s.probeTgt} degrees` }, f1: `${s.modeLabel} ${s.tgt}°`, f2: s.eta.replace(/^about/, "About"), chips: null };
      case "doorOpen": return { hero: s.left, heroSR: `${s.left} left, paused`, q: "timer paused", bar: { p: pct(s.timerPct), k: "warn", sr: "Timer paused at half" }, f1: `Oven ${s.cav}° · set ${s.tgt}°`, f2: "Close door to resume", chips: "timer" };
      case "done": return { hero: `${s.probe}°`, heroSR: `Food ${s.probe} degrees`, q: `food · target ${s.probeTgt}°`, bar: { p: 100, k: "ready", sr: "Food reached target" }, f1: `Done ${s.doneAgo}`, f2: "Take food out", chips: "keep" };
      case "offline": return { hero: s.left, heroSR: `${s.left} left, as of ${s.lastUpdate}`, q: `as of ${s.lastUpdate}`, bar: { p: 50, k: "stale", sr: `Last known progress, ${s.lastUpdate}` }, f1: `${s.modeLabel} ${s.tgt}°`, f2: "Oven not responding", chips: "timer-off" };
    }
    return {};
  }
  // Short second line for one-row faces
  function short(s) {
    const f = { off: () => `${s.cav}°`, preheat: () => `ready ${String(s.eta || "").replace("about ", "~")}`, ready: () => "put food in", cooking: () => `done ${s.doneAt}`, cookingProbe: () => `of ${s.probeTgt}° · ${s.doneAt}`, doorOpen: () => "paused", done: () => "take food out", offline: () => `as of ${s.lastUpdate}` }[s.key];
    return f ? f() : "";
  }

  // ---- The window ------------------------------------------------------------------------------
  const CAMOFF = '<svg class="d3-camoff" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7h9.5a2 2 0 0 1 2 2v1.2L20 7.4v9.2l-5-2.8V15a2 2 0 0 1-2 2H3.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M2.5 3.5l18 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const age = (s) => s.camera === "off" ? "Camera off" : s.frameAge;
  const ageCls = (s) => s.camera === "live" ? "live" : s.stale ? "stale" : "old";
  const still = (s) => (s.camera === "off" ? `<span class="d3-offglass">${CAMOFF}</span>` : HX.cameraStill(s));

  // ---- Faces -----------------------------------------------------------------------------------
  function door(s, o) {
    const m = model(s), who = esc(s.oven), multi = !!o.multi;
    let chips = "";
    if (m.chips === "timer" || m.chips === "timer-off") {
      const dis = m.chips === "timer-off" ? " disabled" : "";
      chips = `<div class="d3-chips" role="group" aria-label="Add time to the ${who} timer">${[1, 5, 10].map((n) => `<button class="d3-chip" data-d3="chip" data-n="${n}"${dis} aria-label="Add ${n} minute${n > 1 ? "s" : ""} to ${who} timer"><b>+${n}</b><small>min</small><em>+${n} min</em></button>`).join("")}</div>`;
    } else if (m.chips === "keep") {
      chips = `<div class="d3-chips"><button class="d3-keep" data-d3="keep" aria-label="Keep ${verb[s.mode] || "cooking"} ${who}: opens a review before it heats again">Keep ${verb[s.mode] || "cooking"}…</button></div>`;
    }
    return `<div class="d3-door">
      <div class="d3-win">
        <button class="d3-ap" data-d3="camera" aria-label="${who} camera, ${esc(age(s))}. Open larger view">${still(s)}</button>
        <div class="d3-cap"><span class="d3-name">${who}</span><span class="d3-age d3-age-${ageCls(s)}"><i aria-hidden="true"></i>${esc(age(s))}</span></div>
        ${chips}
      </div>
      <div class="d3-scr">
        ${status(s)}
        <div class="d3-herobox"><button class="d3-hero" data-d3="graph" aria-label="${esc(m.heroSR)}. Open temperature graph">${esc(m.hero)}</button></div>
        <div class="d3-q">${esc(m.q)}</div>
        <div class="d3-bar d3-bar-${m.bar.k}" role="img" aria-label="${esc(m.bar.sr)}"><i style="width:${m.bar.p}%"></i></div>
        <div class="d3-f1">${esc(m.f1)}</div>
        <div class="d3-f2" aria-live="polite">${esc(m.f2)}</div>
        <button class="d3-stop" data-d3="stop" aria-label="Stop ${who} oven"><span class="d3-sq" aria-hidden="true"></span>${multi ? `Stop ${who}` : "Stop"}</button>
      </div>
    </div>`;
  }

  const GLYPH = {
    bake: '<rect x="9" y="30" width="30" height="4" rx="2"/>',
    broil: '<rect x="9" y="6" width="30" height="4" rx="2"/>',
    roast: '<rect x="9" y="6" width="30" height="4" rx="2"/><rect x="9" y="30" width="30" height="4" rx="2"/>',
    toast: '<rect x="9" y="6" width="8" height="4" rx="2"/><rect x="20" y="6" width="8" height="4" rx="2"/><rect x="31" y="6" width="8" height="4" rx="2"/><rect x="9" y="30" width="8" height="4" rx="2"/><rect x="20" y="30" width="8" height="4" rx="2"/><rect x="31" y="30" width="8" height="4" rx="2"/>',
    reheat: '<path d="M15 8c-4 4 4 8 0 12s4 8 0 12M24 8c-4 4 4 8 0 12s4 8 0 12M33 8c-4 4 4 8 0 12s4 8 0 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    airfry: '<circle cx="24" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="24" cy="20" r="2.6"/><path d="M24 17.5c-1-5 2-8.5 5.5-7.5M26.3 21.3c4.6 1.6 5.8 6 3.2 8.4M21.5 21.4c-3.7 3.2-8.2 2.3-9-1.1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    grill: '<path d="M11 32l9-24M21 32l9-24M31 32l9-24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>',
    proof: '<path d="M9 32c0-9 6.5-15 15-15s15 6 15 15z"/><circle cx="30" cy="14" r="3.2"/>',
    pizza: '<circle cx="20" cy="17" r="10"/><path d="M27 24l12 9" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    dehydrate: '<circle cx="24" cy="20" r="6.5"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="22.6" y="4" width="2.8" height="6" rx="1.4" transform="rotate(${a} 24 20)"/>`).join(""),
    slowcook: '<path d="M11 18h26v7a9 9 0 0 1-9 9h-8a9 9 0 0 1-9-9z"/><rect x="7" y="14" width="34" height="3" rx="1.5"/><rect x="20.5" y="9.5" width="7" height="3" rx="1.5"/>',
    warm: '<circle cx="14" cy="20" r="3.4"/><circle cx="24" cy="20" r="3.4"/><circle cx="34" cy="20" r="3.4"/>',
    settings: '<circle cx="24" cy="20" r="7" fill="none" stroke="currentColor" stroke-width="3.4"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="21.8" y="6.5" width="4.4" height="6" rx="1.2" transform="rotate(${a} 24 20)"/>`).join("")
  };
  const PER_PAGE = 5;
  function pages() {
    const items = HX.MODES.map(([k, l]) => ({ k, l })).concat([{ k: "settings", l: "Settings" }]);
    const out = [];
    for (let i = 0; i < items.length; i += PER_PAGE) out.push(items.slice(i, i + PER_PAGE));
    return out;
  }
  function home(s, o) {
    const who = esc(s.oven), P = pages();
    const tile = (t) => `<button class="d3-tile${t.k === "settings" ? " is-set" : ""}" data-d3="${t.k === "settings" ? "settings" : "tile"}" data-mode="${t.k}" aria-label="${t.k === "settings" ? `${who} oven settings` : `${esc(t.l)} on ${who}: set up, then review before it starts`}"><span class="d3-tb"><svg viewBox="0 0 48 40" fill="currentColor" aria-hidden="true">${GLYPH[t.k]}</svg></span><span class="d3-tl">${esc(t.l)}</span></button>`;
    return `<div class="d3-home">
      <div class="d3-hhead">
        <button class="d3-mini" data-d3="camon" aria-label="${who} camera is off. Turn it on for 5 minutes">${CAMOFF}<span>Turn on</span></button>
        <div class="d3-who"><b>${who}</b>${status(s)}</div>
      </div>
      <div class="d3-clockbox"><div class="d3-clock" aria-label="Time 4:07">4:07</div><div class="d3-date">Sunday, September 27</div></div>
      <div class="d3-tiles"><div class="d3-pager" data-hx-scroll role="group" aria-label="Cook modes, ${P.length} pages">${P.map((p, i) => `<div class="d3-page" aria-label="Page ${i + 1} of ${P.length}">${p.map(tile).join("")}</div>`).join("")}</div></div>
      <div class="d3-pgctl" role="group" aria-label="Pages">
        <button class="d3-pgb" data-d3="pg-prev" aria-label="Previous page of cook modes"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        ${P.map((_, i) => `<button class="d3-pgb d3-pgd" data-d3="pg-go" data-i="${i}" aria-label="Page ${i + 1} of ${P.length}"${i === 0 ? ' aria-current="true"' : ""}><i></i></button>`).join("")}
        <button class="d3-pgb" data-d3="pg-next" aria-label="Next page of cook modes"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>`;
  }

  function compact(s, o) {
    const m = model(s), who = esc(s.oven), off = s.key === "off";
    return `<div class="d3-cpt">
      <div class="d3-thumbcol"><button class="d3-thumb" data-d3="${off ? "camon" : "camera"}" aria-label="${who} camera, ${esc(age(s))}">${still(s)}</button><small class="d3-age-${ageCls(s)}">${esc(age(s))}</small></div>
      ${off ? "" : `<div class="d3-chero" aria-label="${esc(m.heroSR)}">${esc(m.hero)}</div>`}
      <div class="d3-ctext">${status(s)}<span class="d3-l2">${who} · ${esc(short(s))}</span></div>
      ${heats(s) ? `<button class="d3-stop" data-d3="stop" aria-label="Stop ${who} oven"><span class="d3-sq" aria-hidden="true"></span>${o.multi ? `<span class="d3-sl">Stop<small>${who}</small></span>` : "Stop"}</button>` : ""}
    </div>`;
  }

  function face(s, size, o) {
    const inner = size === "compact" ? compact(s, o) : s.key === "off" ? home(s, o) : door(s, o);
    return `<div class="d3-face sz-${size} st-${s.key}">${inner}</div>`;
  }

  // ---- CSS -------------------------------------------------------------------------------------
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@300;400&display=swap');
.c-d3{position:relative;width:100%;height:100%;box-sizing:border-box;overflow:hidden;border-radius:inherit;background:var(--pane);color:var(--ink);font-family:Barlow,system-ui,sans-serif;-webkit-font-smoothing:antialiased;box-shadow:inset 0 0 0 1px var(--edge);--stop:#C0301E;--thermal:linear-gradient(90deg,#5AA7E0,#E7C64A 55%,#FF7A3D)}
.c-d3 *,.c-d3 *::before,.c-d3 *::after{box-sizing:border-box}
.c-d3 button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:inherit;-webkit-tap-highlight-color:transparent}
.c-d3 button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.c-d3 svg{display:block}
.c-d3.t-dark{--pane:#08090B;--screen:#111318;--edge:rgba(255,255,255,.07);--rim:rgba(255,255,255,.07);--ink:#F3F0EA;--ink2:#ABA69F;--ink3:#8E8981;--ember:#FF9F57;--ready:#74D39A;--warn:#FFCB57;--probe:#FFD166;--stale:#9A958E;--track:rgba(255,255,255,.12);--line:rgba(255,255,255,.4);--tile:#14161B;--glyph:#B7876A;--focus:#8FC3FF;--hw:300;color-scheme:dark}
.c-d3.t-light{--pane:#FFFFFF;--screen:#F3F1ED;--edge:rgba(0,0,0,.10);--rim:rgba(0,0,0,.08);--ink:#1B1A17;--ink2:#57534D;--ink3:#6A665F;--ember:#A8460A;--ready:#23703A;--warn:#855600;--probe:#6E6A00;--stale:#6A665F;--track:rgba(0,0,0,.10);--line:rgba(0,0,0,.45);--tile:#F3F1ED;--glyph:#98653F;--focus:#1565C0;--hw:400;--thermal:linear-gradient(90deg,#2F7BC0,#B8900E 55%,#C4501A);color-scheme:light}
.c-d3.t-auto{--pane:var(--ha-card-background,var(--card-background-color,#1c1c1c));--ink:var(--primary-text-color,#e1e1e1);--ink2:var(--secondary-text-color,#9b9b9b);--ink3:var(--secondary-text-color,#9b9b9b);--screen:color-mix(in srgb,var(--ink) 5%,var(--pane));--edge:var(--ha-card-border-color,var(--divider-color,rgba(127,127,127,.2)));--rim:var(--divider-color,rgba(127,127,127,.18));--ember:color-mix(in srgb,#E0701E 60%,var(--ink));--ready:color-mix(in srgb,#35A55A 60%,var(--ink));--warn:color-mix(in srgb,#D9981A 60%,var(--ink));--probe:color-mix(in srgb,#E0B22A 55%,var(--ink));--stale:var(--secondary-text-color,#9b9b9b);--track:color-mix(in srgb,var(--ink) 13%,transparent);--line:color-mix(in srgb,var(--ink) 45%,transparent);--tile:var(--screen);--glyph:color-mix(in srgb,#B8784A 65%,var(--ink));--focus:var(--primary-color,#03a9f4);--hw:300}
.c-d3 .d3-c-off{color:var(--ink3)}.c-d3 .d3-c-heat{color:var(--ember)}.c-d3 .d3-c-ready{color:var(--ready)}.c-d3 .d3-c-warn{color:var(--warn)}.c-d3 .d3-c-stale{color:var(--stale)}

/* faces and their size tokens */
.c-d3 .d3-face{position:absolute;inset:0;container-type:size}
.c-d3 .sz-standard{--pad:12px;--gap:14px;--vg:8px;--cap:20px;--chip:48px;--spad:12px;--hmax:120px;--apr:12px;--mini:48px;--clk:44px;--tg:8px;--tl:16px;--tfs:12px;--tmax:108px;--pgh:48px}
.c-d3 .sz-wall{--pad:24px;--gap:24px;--vg:12px;--cap:30px;--chip:64px;--spad:20px;--hmax:150px;--apr:18px;--mini:80px;--clk:112px;--tg:24px;--tl:30px;--tfs:22px;--tmax:136px;--pgh:56px}

/* the status line */
.c-d3 .d3-st{display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:13px;line-height:16px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;max-width:100%;overflow:hidden}
.c-d3 .d3-st svg{width:14px;height:14px;flex:none}
.c-d3 .sz-wall .d3-st{font-size:22px;line-height:28px;gap:10px}.c-d3 .sz-wall .d3-st svg{width:22px;height:22px}

/* ===== the door (running states) ===== */
.c-d3 .d3-door{position:absolute;inset:0;padding:var(--pad);display:grid;grid-template-rows:minmax(0,1fr);grid-template-columns:max(152px,min(calc((100cqw - 2 * var(--pad) - var(--gap)) / 2),calc((100cqh - 2 * var(--pad) - var(--cap) - var(--chip) - 2 * var(--vg)) * 4 / 3))) minmax(0,1fr);column-gap:var(--gap)}
.c-d3 .d3-win{display:flex;flex-direction:column;gap:var(--vg);min-width:0;min-height:0}
.c-d3 .d3-ap{display:block;width:100%;aspect-ratio:4/3;flex:none;border-radius:var(--apr);overflow:hidden;background:#000;box-shadow:0 0 0 1px var(--rim)}
.c-d3 .d3-ap .hx-still,.c-d3 .d3-thumb .hx-still{width:100%;height:100%}
.c-d3 .d3-cap{height:var(--cap);flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13.5px;line-height:1;min-width:0;margin-top:-2px}
.c-d3 .d3-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.c-d3 .d3-age{display:inline-flex;align-items:center;gap:5px;color:var(--ink2);white-space:nowrap;flex:none}
.c-d3 .d3-age i{width:7px;height:7px;border-radius:50%;border:1.5px solid currentColor}
.c-d3 .d3-age-live i{background:currentColor}
.c-d3 .d3-age-stale{color:var(--stale)}.c-d3 .d3-age-stale i{border-style:dashed}
.c-d3 .d3-chips{display:flex;gap:6px;height:var(--chip);flex:none}
.c-d3 .d3-chip{flex:0 1 56px;min-width:48px;height:100%;border-radius:12px;box-shadow:inset 0 0 0 1.5px var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;text-align:center}
.c-d3 .d3-chip b{font-size:17px;font-weight:600}.c-d3 .d3-chip small{font-size:11px;color:var(--ink2);margin-top:3px}.c-d3 .d3-chip em{display:none}
.c-d3 .d3-chip:disabled{opacity:.38;cursor:default}
.c-d3 .d3-keep{height:100%;padding:0 18px;border-radius:12px;box-shadow:inset 0 0 0 1.5px var(--line);font-weight:600;font-size:15px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.c-d3 .d3-scr{min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding:var(--spad);border-radius:var(--apr);background:var(--screen);box-shadow:inset 0 0 0 1px var(--rim),inset 0 1px 0 var(--rim);container-type:size;overflow:hidden}
.c-d3 .d3-herobox{flex:1 1 0;min-height:0;width:100%;container-type:size;display:flex;align-items:center;justify-content:center}
.c-d3 .d3-hero{font-family:"Barlow Condensed",Barlow,sans-serif;font-weight:var(--hw);font-size:min(41cqw,100cqh,var(--hmax));line-height:1;letter-spacing:-.005em;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:center}
.c-d3 .d3-q,.c-d3 .d3-f1,.c-d3 .d3-f2{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none;font-size:clamp(12px,7.6cqw,15px);line-height:1.3}
.c-d3 .d3-q{color:var(--ink2)}
.c-d3 .d3-f1{color:var(--ink2)}
.c-d3 .d3-f2{color:var(--ink);font-weight:700}
.c-d3 .d3-bar{width:76%;height:4px;border-radius:2px;background:var(--track);margin:8px 0 9px;flex:none;overflow:hidden}
.c-d3 .d3-bar i{display:block;height:100%;border-radius:inherit}
.c-d3 .d3-bar-thermal i{background:var(--thermal)}.c-d3 .d3-bar-heat i{background:var(--ember)}.c-d3 .d3-bar-probe i{background:var(--probe)}.c-d3 .d3-bar-ready i{background:var(--ready)}.c-d3 .d3-bar-warn i{background:var(--warn)}.c-d3 .d3-bar-stale i{background:repeating-linear-gradient(90deg,var(--stale) 0 6px,transparent 6px 9px)}
.c-d3 .d3-stop{flex:none;margin-top:var(--vg);height:var(--chip);width:min(100%,160px);border-radius:12px;background:var(--stop);color:#fff;font-weight:700;font-size:16px;letter-spacing:.01em;display:inline-flex;align-items:center;justify-content:center;gap:9px;white-space:nowrap;overflow:hidden;padding:0 10px}
.c-d3 .d3-sq{width:11px;height:11px;border-radius:2px;background:currentColor;flex:none}
.c-d3 .st-offline .d3-hero{opacity:.45}.c-d3 .st-offline .d3-q{color:var(--stale)}
.c-d3 .d3-f2.is-ack{color:var(--ink2);font-weight:600}
/* wall scale */
.c-d3 .sz-wall .d3-cap{font-size:21px}.c-d3 .sz-wall .d3-age i{width:11px;height:11px;border-width:2px}
.c-d3 .sz-wall .d3-chips{gap:12px}.c-d3 .sz-wall .d3-chip{flex-basis:104px;border-radius:16px}.c-d3 .sz-wall .d3-chip b,.c-d3 .sz-wall .d3-chip small{display:none}.c-d3 .sz-wall .d3-chip em{display:block;font-style:normal;font-weight:600;font-size:22px}
.c-d3 .sz-wall .d3-keep{font-size:22px;border-radius:16px;padding:0 26px}
.c-d3 .sz-wall .d3-q,.c-d3 .sz-wall .d3-f1,.c-d3 .sz-wall .d3-f2{font-size:24px}
.c-d3 .sz-wall .d3-bar{height:6px;border-radius:3px;margin:14px 0 14px;width:70%}
.c-d3 .sz-wall .d3-stop{width:min(100%,260px);font-size:24px;border-radius:16px;gap:14px}.c-d3 .sz-wall .d3-sq{width:17px;height:17px;border-radius:3px}

/* ===== the home (off) ===== */
.c-d3 .d3-home{position:absolute;inset:0;padding:var(--pad);display:flex;flex-direction:column;gap:var(--vg);min-height:0}
.c-d3 .d3-hhead{display:flex;align-items:center;gap:12px;height:var(--mini);flex:none;min-width:0}
.c-d3 .d3-mini{height:100%;aspect-ratio:4/3;flex:none;border-radius:9px;background:#0A0A0B;box-shadow:0 0 0 1px var(--rim);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#BDB8B1;overflow:hidden;text-align:center}
.c-d3 .d3-mini .d3-camoff{width:18px;height:18px}.c-d3 .d3-mini span{font-size:11px;font-weight:600;line-height:13px}
.c-d3 .d3-mini .hx-still{width:100%;height:100%}
.c-d3 .d3-who{display:flex;flex-direction:column;gap:2px;min-width:0;line-height:1.2}
.c-d3 .d3-who b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d3 .d3-clockbox{flex:none;text-align:center;margin-top:calc(var(--vg) * -1)}
.c-d3 .d3-clock{font-family:"Barlow Condensed",Barlow,sans-serif;font-weight:var(--hw);font-size:var(--clk);line-height:1;font-variant-numeric:tabular-nums}
.c-d3 .d3-date{font-size:14px;line-height:18px;color:var(--ink2);margin-top:2px}
.c-d3 .d3-tiles{flex:1 1 0;min-height:0;position:relative;container-type:size}
.c-d3 .d3-pager{position:absolute;inset:0;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;scroll-behavior:auto}
.c-d3 .d3-pager::-webkit-scrollbar{display:none}
.c-d3 .d3-page{flex:0 0 100%;height:100%;scroll-snap-align:start;display:grid;grid-template-columns:repeat(${PER_PAGE},minmax(0,1fr));column-gap:var(--tg);align-items:center}
.c-d3 .d3-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:0;height:100%;text-align:center}
.c-d3 .d3-tb{width:min(100%,calc((100cqh - var(--tl) - 4px) * 1.16),var(--tmax));aspect-ratio:1.16;border-radius:22%/26%;background:var(--tile);box-shadow:inset 0 0 0 1px var(--rim);display:flex;align-items:center;justify-content:center;color:var(--glyph)}
.c-d3 .d3-tb svg{width:64%;height:auto}
.c-d3 .d3-tl{font-size:var(--tfs);line-height:var(--tl);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.c-d3 .d3-tile:not(.is-set):hover .d3-tb,.c-d3 .d3-tile:not(.is-set):focus-visible .d3-tb{color:#FFD23A;background:radial-gradient(120% 90% at 50% 100%,#6a1d10 0%,#2a1210 55%,#1a1112 100%);box-shadow:inset 0 0 0 1px #7a3a2a,inset 0 -8px 22px rgba(255,90,30,.35)}
.c-d3 .d3-tile:not(.is-set):hover .d3-tb svg,.c-d3 .d3-tile:not(.is-set):focus-visible .d3-tb svg{filter:drop-shadow(0 0 4px rgba(255,140,40,.8))}
.c-d3 .d3-tile.is-set .d3-tb{color:var(--ink2)}
.c-d3 .d3-tile.is-set:hover .d3-tb{box-shadow:inset 0 0 0 1px var(--line)}
.c-d3 .d3-pgctl{flex:none;height:var(--pgh);display:flex;justify-content:center;align-items:center}
.c-d3 .d3-pgb{width:var(--pgh);height:var(--pgh);display:flex;align-items:center;justify-content:center;color:var(--ink2);border-radius:50%}
.c-d3 .d3-pgb svg{width:16px;height:16px}
.c-d3 .d3-pgd i{width:8px;height:8px;border-radius:50%;background:var(--track);box-shadow:inset 0 0 0 1px var(--line)}
.c-d3 .d3-pgd[aria-current="true"] i{background:var(--ink);box-shadow:none}
.c-d3 .sz-wall .d3-mini{border-radius:14px}.c-d3 .sz-wall .d3-mini .d3-camoff{width:30px;height:30px}.c-d3 .sz-wall .d3-mini span{font-size:17px;line-height:20px}
.c-d3 .sz-wall .d3-who b{font-size:26px}.c-d3 .sz-wall .d3-date{font-size:24px;line-height:30px}
.c-d3 .sz-wall .d3-pgb svg{width:22px;height:22px}.c-d3 .sz-wall .d3-pgd i{width:11px;height:11px}
.c-d3 .sz-wall.st-off .d3-home{opacity:.82}

/* ===== compact (one row) ===== */
.c-d3 .d3-cpt{position:absolute;inset:0;display:flex;align-items:center;gap:9px;padding:4px 4px 4px 6px;min-width:0}
.c-d3 .d3-thumbcol{flex:none;width:52px;display:flex;flex-direction:column;align-items:center;gap:2px}
.c-d3 .d3-thumb{display:block;height:33px;aspect-ratio:4/3;border-radius:6px;overflow:hidden;background:#000;box-shadow:0 0 0 1px var(--rim)}
.c-d3 .d3-thumb .d3-offglass{display:flex;width:100%;height:100%;align-items:center;justify-content:center;color:#BDB8B1;background:#0A0A0B}
.c-d3 .d3-thumb .d3-camoff{width:17px;height:17px}
.c-d3 .d3-thumbcol small{font-size:10.5px;line-height:12px;color:var(--ink2);white-space:nowrap}
.c-d3 .d3-thumbcol small.d3-age-stale{color:var(--stale)}
.c-d3 .d3-chero{flex:none;font-family:"Barlow Condensed",Barlow,sans-serif;font-weight:var(--hw);font-size:32px;line-height:1;font-variant-numeric:tabular-nums}
.c-d3 .st-offline .d3-chero{opacity:.45}
.c-d3 .d3-ctext{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
.c-d3 .d3-ctext .d3-st{font-size:11px;line-height:14px;letter-spacing:.06em;gap:5px}.c-d3 .d3-ctext .d3-st svg{width:12px;height:12px}
.c-d3 .d3-l2{font-size:12.5px;line-height:15px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d3 .d3-cpt .d3-stop{margin:0;width:auto;height:48px;padding:0 14px;font-size:15px;gap:8px;flex:none;max-width:45%}
.c-d3 .d3-cpt .d3-sq{width:10px;height:10px}
.c-d3 .d3-sl{display:flex;flex-direction:column;align-items:flex-start;line-height:1.05}.c-d3 .d3-sl small{font-size:11px;font-weight:600;opacity:.9;max-width:72px;overflow:hidden;text-overflow:ellipsis}

/* ===== several ovens ===== */
.c-d3 .d3-mv{position:absolute;inset:0;display:flex;flex-direction:column}
.c-d3 .d3-mv[hidden]{display:none}
.c-d3 .d3-mrow{position:relative;flex:none;height:56px;border-bottom:1px solid var(--rim)}
.c-d3 .d3-mrow .d3-face{position:absolute;inset:0}
.c-d3 .d3-mrow .d3-mswitch{position:absolute;inset:0;z-index:0;border-radius:0}
.c-d3 .d3-mrow .d3-cpt{pointer-events:none;z-index:1}.c-d3 .d3-mrow .d3-cpt .d3-stop{pointer-events:auto}
.c-d3 .d3-mchip{flex:none;height:48px;margin:8px 12px 0;align-self:flex-start;display:inline-flex;align-items:center;gap:8px;padding:0 16px;border-radius:24px;box-shadow:inset 0 0 0 1px var(--rim);color:var(--ink2);font-size:14px}
.c-d3 .d3-mchip .d3-st{font-size:11px;letter-spacing:.06em;color:var(--ink3)}
.c-d3 .d3-mchip b{color:var(--ink);font-weight:600}
.c-d3 .d3-mdoor{position:relative;flex:1 1 0;min-height:0}

/* ===== detail view ===== */
.c-d3.d3-detail{--chip:48px;--vg:8px;height:auto;container-type:inline-size;border-radius:var(--ha-card-border-radius,12px);padding-bottom:18px}
.c-d3 .d3-dh{display:flex;align-items:center;gap:12px;padding:10px 8px 6px 16px}
.c-d3 .d3-dh h3{margin:0;font-size:20px;font-weight:600;flex:1;min-width:0}
.c-d3 .d3-dh h3 small{display:block;margin-top:2px}
.c-d3 .d3-x{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.c-d3 .d3-dh .d3-stop{margin:0;width:auto;padding:0 16px}
.c-d3 .d3-tabs{display:flex;padding:0 8px;box-shadow:inset 0 -1px 0 var(--rim)}
.c-d3 .d3-tab{flex:1;height:48px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:var(--ink2);text-align:center}
.c-d3 .d3-tab[aria-selected="true"]{color:var(--ink);box-shadow:inset 0 -2px 0 var(--ink)}
.c-d3 .d3-db{padding:16px 16px 0}
.c-d3 .d3-bigwin{border-radius:14px;overflow:hidden;background:#000;aspect-ratio:4/3;box-shadow:0 0 0 1px var(--rim)}
.c-d3 .d3-bigwin .hx-still{width:100%;height:100%}
.c-d3 .d3-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 0;box-shadow:inset 0 -1px 0 var(--rim)}
.c-d3 .d3-row:last-child{box-shadow:none}
.c-d3 .d3-row .d3-rl{flex:1;min-width:0;line-height:1.3}
.c-d3 .d3-row .d3-rl b{display:block;font-size:15px;font-weight:600}
.c-d3 .d3-row .d3-rl span{font-size:13.5px;color:var(--ink2)}
.c-d3 .d3-btn{height:48px;padding:0 16px;border-radius:12px;box-shadow:inset 0 0 0 1.5px var(--line);font-weight:600;font-size:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap}
.c-d3 .d3-btn.is-go{background:linear-gradient(90deg,#F7A53B,#EE5A24);color:#1a0d05;box-shadow:none}
.c-d3 .d3-btn.is-wide{width:100%}
.c-d3 .d3-step{display:flex;align-items:center;gap:6px}
.c-d3 .d3-step .d3-btn{width:48px;padding:0;font-size:22px;font-weight:500}
.c-d3 .d3-step output{min-width:72px;text-align:center;font-family:"Barlow Condensed",Barlow,sans-serif;font-size:26px;font-weight:400}
.c-d3 .d3-open{background:var(--screen);border-radius:12px;padding:10px 12px;margin:4px 0 8px;box-shadow:inset 0 0 0 1px var(--rim)}
.c-d3 .d3-sub{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2);font-weight:700;margin:18px 0 4px}
.c-d3 .d3-sw{width:52px;height:32px;border-radius:16px;background:var(--track);position:relative;flex:none;box-shadow:inset 0 0 0 1.5px var(--line)}
.c-d3 .d3-sw::after{content:"";position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;background:var(--ink2)}
.c-d3 .d3-sw[aria-checked="true"]{background:var(--ink);box-shadow:none}.c-d3 .d3-sw[aria-checked="true"]::after{left:24px;background:var(--pane)}
.c-d3 .d3-swrap{width:52px;height:48px;display:flex;align-items:center;flex:none}
.c-d3 .d3-legend{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 8px}
.c-d3 .d3-lg{height:48px;padding:0 14px;border-radius:24px;box-shadow:inset 0 0 0 1px var(--line);display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
.c-d3 .d3-lg[aria-pressed="false"]{opacity:.5}
.c-d3 .d3-lg i{width:14px;height:4px;border-radius:2px;display:block}
.c-d3 .d3-chart{width:100%;height:auto}
.c-d3 .d3-chart text{font-family:Barlow,system-ui,sans-serif;font-size:11px;fill:var(--ink2)}
.c-d3 .d3-note{font-size:14px;color:var(--ink2);line-height:1.45;margin:8px 0 0}
.c-d3 .d3-hthumb{width:64px;aspect-ratio:4/3;border-radius:8px;overflow:hidden;flex:none;background:#000}
.c-d3 .d3-hthumb .hx-still{width:100%;height:100%}
.c-d3 .d3-review{border-radius:14px;background:var(--screen);box-shadow:inset 0 0 0 1px var(--rim);padding:18px 16px;text-align:center}
.c-d3 .d3-review .d3-hero{font-size:72px;display:block;margin:4px 0 2px;cursor:default}
.c-d3 .d3-stack{display:flex;flex-direction:column;gap:10px;margin-top:16px}
`;

  // ---- Detail view -----------------------------------------------------------------------------
  function chart() {
    const H = HX.HISTORY, W = 388, Hh = 228, x0 = 34, x1 = W - 58, y0 = 26, y1 = Hh - 24;
    const X = (t) => x0 + (t / H.end) * (x1 - x0), Y = (v) => y1 - ((v - 50) / 400) * (y1 - y0);
    const path = (pts) => pts.map(([t, v], i) => `${i ? "L" : "M"}${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
    const grid = [100, 200, 300, 400].map((v) => `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--rim)"/><text x="${x0 - 6}" y="${Y(v) + 4}" text-anchor="end">${v}°</text>`).join("");
    const xt = [0, 10, 20, 30].map((t) => `<text x="${X(t)}" y="${Hh - 6}" text-anchor="middle">${t} min</text>`).join("");
    const doors = H.doors.map(([a, b]) => `<rect x="${X(a)}" y="${y0}" width="${Math.max(3, X(b) - X(a))}" height="${y1 - y0}" style="fill:var(--warn);opacity:.22"/><path d="M${X(a)} ${y0 - 2}h${X(b) - X(a)}" style="stroke:var(--warn)" stroke-width="3"/><text x="${(X(a) + X(b)) / 2}" y="${y0 - 8}" text-anchor="middle" style="fill:var(--ink);font-weight:600">Door open 1:24</text>`).join("");
    const lastC = H.cav[H.cav.length - 1], lastP = H.probe[H.probe.length - 1];
    return `<svg class="d3-chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Temperature over 30 minutes. Oven rose to 400 degrees by 11 minutes, dipped to 352 when the door opened at 13 minutes, and recovered by 16. Food rose from 45 to 128 degrees, target 145.">
      ${grid}${xt}${doors}
      <line x1="${x0}" x2="${x1}" y1="${Y(H.cavTgt)}" y2="${Y(H.cavTgt)}" stroke-dasharray="4 4" style="stroke:var(--ember);opacity:.6"/>
      <line x1="${x0}" x2="${x1}" y1="${Y(H.probeTgt)}" y2="${Y(H.probeTgt)}" stroke-dasharray="4 4" style="stroke:var(--probe);opacity:.7"/>
      <text x="${x0 + 4}" y="${Y(H.probeTgt) - 5}" style="fill:var(--probe)">food target ${H.probeTgt}°</text>
      <path d="${path(H.cav)}" fill="none" stroke-width="2.5" stroke-linejoin="round" style="stroke:var(--ember)"/>
      <path d="${path(H.probe)}" fill="none" stroke-width="2.5" stroke-linejoin="round" style="stroke:var(--probe)"/>
      <text x="${x1 + 4}" y="${Y(lastC[1]) + 4}" style="fill:var(--ember);font-weight:700">Oven ${lastC[1]}°</text>
      <text x="${x1 + 4}" y="${Y(lastP[1]) + 4}" style="fill:var(--probe);font-weight:700">Food ${lastP[1]}°</text>
    </svg>`;
  }
  const sw = (on, label) => `<span class="d3-swrap"><button class="d3-sw" role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button></span>`;
  function detail(s, { page, theme }) {
    const who = esc(s.oven), m = model(s), heating = heats(s);
    const tabs = ["now", "graph", "history", "settings"];
    const tabNames = { now: "Now", graph: "Graph", history: "History", settings: "Settings" };
    const flow = page === "start" || page === "review";
    const head = `<div class="d3-dh"><button class="d3-x" aria-label="Close"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      <h3>${flow ? `${who} · Bake` : who}<small>${flow ? `<span class="d3-st d3-c-off">${mark("off")}<span>Off</span></span>` : status(s)}</small></h3>
      ${heating && !flow ? `<button class="d3-stop" data-d3="stop" aria-label="Stop ${who} oven"><span class="d3-sq" aria-hidden="true"></span>Stop</button>` : ""}</div>`;
    const tabbar = flow ? "" : `<div class="d3-tabs" role="tablist">${tabs.map((t) => `<button class="d3-tab" role="tab" aria-selected="${t === page}">${tabNames[t]}</button>`).join("")}</div>`;
    let body = "";
    if (page === "now") {
      body = `<div class="d3-bigwin">${HX.cameraStill(s)}</div>
        <div class="d3-row"><div class="d3-rl"><span class="d3-age d3-age-live"><i aria-hidden="true"></i>Live · still updates every 2 s</span></div><button class="d3-btn">Watch live video · 5 min</button></div>
        <div class="d3-row"><div class="d3-rl"><b>Oven temperature</b><span>${s.cav}° now · set ${s.tgt}°F</span></div><button class="d3-btn">Change</button></div>
        <div class="d3-row" style="flex-wrap:wrap"><div class="d3-rl"><b>Timer</b><span>${s.left} left of 25 min · done ${s.doneAt}</span></div>
          <div class="d3-open" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px"><div class="d3-step"><button class="d3-btn" aria-label="Less time">−</button><output>25 min</output><button class="d3-btn" aria-label="More time">+</button></div><button class="d3-btn">Set timer</button></div></div>
        <div class="d3-row"><div class="d3-rl"><b>Food probe target</b><span>Food ${s.probe}° now · target ${s.probeTgt}°F</span></div><button class="d3-btn">Change</button></div>`;
    } else if (page === "graph") {
      body = `<div class="d3-legend"><button class="d3-lg" aria-pressed="true"><i style="background:var(--ember)"></i>Oven</button><button class="d3-lg" aria-pressed="true"><i style="background:var(--probe)"></i>Food</button><button class="d3-lg" aria-pressed="true"><i style="background:var(--warn);opacity:.6;height:10px;width:10px"></i>Door open</button></div>
        ${chart()}
        <p class="d3-note">The door was open once, for 1 min 24 s at 13 min. Heating paused while it was open: the oven fell to 352° and was back at 400° by 16 min.</p>`;
    } else if (page === "history") {
      const rows = [["Today 5:40 PM", "Convection bake 400°F", "30 min · door opened once", "cooking"], ["Yesterday 7:05 PM", "Roast 350°F", "52 min · food reached 145°", "done"], ["Thu 12:20 PM", "Air fry 400°F", "18 min", "done"], ["Tue 8:10 AM", "Toast", "4 min", "off"]];
      body = rows.map(([when, what, how, k]) => `<div class="d3-row"><span class="d3-hthumb">${HX.cameraStill({ key: k, stale: false })}</span><div class="d3-rl"><b>${what}</b><span>${when} · ${how}</span></div><button class="d3-btn" aria-label="Open graph for ${what}, ${when}">Graph</button></div>`).join("");
    } else if (page === "settings") {
      body = `<div class="d3-sub">Alerts</div>
        <div class="d3-row"><div class="d3-rl"><b>Ready</b><span>Preheat finished</span></div>${sw(true, "Ready alert")}</div>
        <div class="d3-row"><div class="d3-rl"><b>Done</b><span>Timer ended or food reached target</span></div>${sw(true, "Done alert")}</div>
        <div class="d3-row"><div class="d3-rl"><b>Door left open</b><span>While heating, after 1 min</span></div>${sw(true, "Door alert")}</div>
        <div class="d3-row"><div class="d3-rl"><b>Not responding</b><span>While heating</span></div>${sw(true, "Offline alert")}</div>
        <div class="d3-sub">Camera</div>
        <div class="d3-row"><div class="d3-rl"><b>On while cooking</b><span>Otherwise off; turns on for 5 min when asked</span></div>${sw(true, "Camera on while cooking")}</div>
        <div class="d3-sub">Remote start</div>
        <div class="d3-row"><div class="d3-rl"><b>Allowed by this oven</b><span>Change it on the oven: Settings › App permissions</span></div></div>
        <div class="d3-sub">Oven</div>
        <div class="d3-row"><div class="d3-rl"><b>June Oven, 3rd gen</b><span>june-local 1.4 · address and TLS in Home Assistant › Devices</span></div></div>`;
    } else if (page === "start") {
      body = `<div class="d3-sub" style="margin-top:0">Step 1 of 2</div>
        <div class="d3-row"><div class="d3-rl"><b>Temperature</b></div><div class="d3-step"><button class="d3-btn" aria-label="Lower">−</button><output>350°F</output><button class="d3-btn" aria-label="Higher">+</button></div></div>
        <div class="d3-row"><div class="d3-rl"><b>Timer</b><span>Starts when food goes in</span></div><div class="d3-step"><button class="d3-btn" aria-label="Less">−</button><output>25 min</output><button class="d3-btn" aria-label="More">+</button></div></div>
        <div class="d3-row"><div class="d3-rl"><b>Food probe</b><span>Optional</span></div><button class="d3-btn">Set target</button></div>
        <div class="d3-stack"><button class="d3-btn is-wide">Review bake</button><button class="d3-btn is-wide" style="box-shadow:none;color:var(--ink2)">Cancel</button></div>`;
    } else if (page === "review") {
      body = `<div class="d3-sub" style="margin-top:0">Step 2 of 2 · Review</div>
        <div class="d3-review"><span class="d3-st d3-c-off">${mark("off")}<span>${who} is off</span></span><span class="d3-hero">350°</span><div class="d3-f1" style="font-size:15px">Bake · 25 min timer, starts when food goes in</div></div>
        <p class="d3-note">This review expires at 6:35 PM (5 min). The oven heats only after you press Start.</p>
        <div class="d3-stack"><button class="d3-btn is-go is-wide">Start baking on ${who}</button><button class="d3-btn is-wide">Change</button><button class="d3-btn is-wide" style="box-shadow:none;color:var(--ink2)">Cancel</button></div>`;
    }
    return `<div class="c-d3 d3-detail t-${theme || "auto"}" role="dialog" aria-label="${who} oven">${head}${tabbar}<div class="d3-db">${body}</div></div>`;
  }

  // ---- Several ovens ---------------------------------------------------------------------------
  function multi(ovens, opts) {
    const theme = opts.theme || "auto", w = opts.width;
    const focus = Math.max(0, ovens.findIndex(heats));
    const variant = (f) => {
      const rows = ovens.map((o, i) => {
        if (i === f) return "";
        if (heats(o)) return `<div class="d3-mrow"><button class="d3-mswitch" data-d3="focus" data-to="${i}" aria-label="Show ${esc(o.oven)} oven"></button><div class="d3-face sz-compact st-${o.key}">${compact(o, { multi: true })}</div></div>`;
        return `<button class="d3-mchip" data-d3="focus" data-to="${i}" aria-label="${esc(o.oven)} oven is off. Show it"><b>${esc(o.oven)}</b>${status(o)}</button>`;
      }).join("");
      const f0 = ovens[f];
      return `${rows}<div class="d3-mdoor"><div class="d3-face sz-standard st-${f0.key}">${f0.key === "off" ? home(f0, {}) : door(f0, { multi: true })}</div></div>`;
    };
    const html = `<div class="c-d3 t-${theme} d3-multi" role="group" aria-label="${ovens.map((o) => `${esc(o.oven)}: ${esc(o.sentence)}`).join("; ")}">${ovens.map((_, f) => `<div class="d3-mv" data-mv="${f}"${f === focus ? "" : " hidden"}>${variant(f)}</div>`).join("")}</div>`;
    const cap = ovens.map((o) => `${o.oven} ${o.word.toLowerCase()}`).join(" + ");
    return HX.frame(html, 12, 6, w, 1, cap);
  }

  // ---- Interaction (mock) ----------------------------------------------------------------------
  function syncDots(sc) {
    const home = sc.closest(".d3-home"); if (!home) return;
    const i = Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth));
    home.querySelectorAll(".d3-pgd").forEach((d, k) => d.setAttribute("aria-current", k === i ? "true" : "false"));
  }
  function ack(face, sending, ok, refused) {
    const line = face && face.querySelector(".d3-f2, .d3-l2"); if (!line) return;
    if (line.dataset.orig == null) line.dataset.orig = line.innerHTML;
    const off = face.classList.contains("st-offline");
    clearTimeout(line._t1); clearTimeout(line._t2);
    line.textContent = sending; line.classList.add("is-ack");
    line._t1 = setTimeout(() => { line.textContent = off ? refused : ok; }, 700);
    line._t2 = setTimeout(() => { line.innerHTML = line.dataset.orig; line.classList.remove("is-ack"); delete line.dataset.orig; }, 3400);
  }
  function wire(root) {
    if (root.__d3wired) return; root.__d3wired = true;
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-d3]"); if (!b || !root.contains(b) || !b.closest(".c-d3")) return;
      const act = b.dataset.d3, face = b.closest(".d3-face");
      if (act === "pg-prev" || act === "pg-next" || act === "pg-go") {
        const home = b.closest(".d3-home"), sc = home.querySelector(".d3-pager"), n = home.querySelectorAll(".d3-page").length;
        const cur = Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth));
        const to = act === "pg-go" ? +b.dataset.i : Math.max(0, Math.min(n - 1, cur + (act === "pg-next" ? 1 : -1)));
        sc.scrollLeft = to * sc.clientWidth; syncDots(sc);
      } else if (act === "chip") {
        const n = b.dataset.n; ack(face, `Adding ${n} min…`, `Added ${n} min`, "Not sent — oven not responding");
      } else if (act === "stop") {
        ack(face, "Stopping…", "Stopped", "Not sent — oven not responding");
      } else if (act === "camon") {
        b.innerHTML = HX.cameraStill({ key: "off", stale: false });
        b.setAttribute("aria-label", "Camera on for 5 minutes, live. Open larger view"); b.dataset.d3 = "camera";
        const lab = b.parentElement.querySelector("small"); if (lab) { lab.textContent = "Live · 5 min"; lab.className = "d3-age-live"; }
      } else if (act === "focus") {
        const mc = b.closest(".d3-multi");
        mc.querySelectorAll(".d3-mv").forEach((v) => { v.hidden = v.dataset.mv !== b.dataset.to; });
      }
    });
    root.addEventListener("scroll", (e) => { const t = e.target; if (t && t.classList && t.classList.contains("d3-pager")) syncDots(t); }, true);
  }

  window.CONCEPTS = window.CONCEPTS || {};
  window.CONCEPTS.d3 = {
    name: "D3 · Door — the oven's front: window and screen in one pane",
    css,
    sizes: { standard: [12, 5], wall: [24, 8, 2], compact: [12, 1] },
    render(s, opts) {
      return `<div class="c-d3 t-${opts.theme || "auto"}" role="group" aria-label="${esc(s.oven)} oven: ${esc(s.sentence)}">${face(s, opts.size, {})}</div>`;
    },
    multi,
    detailPages: ["now", "graph", "history", "settings", "start", "review"],
    detail,
    wire
  };
})();
