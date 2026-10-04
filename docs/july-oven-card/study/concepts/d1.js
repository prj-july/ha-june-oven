/* d1 — "Second Screen": the June oven's own glass touchscreen, translated into a Home Assistant card.
 * One huge thin numeral inside the oven's two rings (thermal-gradient preheat ring, draining ember
 * cooking ring), small centred lines under it, the camera as the oven's "window" beside the screen,
 * one outcome-labelled button in a fixed place. Idle = the oven's home screen of glowing element tiles.
 * All rules scoped under .c-d1. Sizes are computed from the card box with container queries.
 */
(function () {
  "use strict";
  const HX = window.HX;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------------------------------------------------------------- status glyphs (shape half of word+shape+colour)
  const ICON = {
    off: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    preheat: '<path d="M8 13.5V3.2M3.8 7.2 8 3l4.2 4.2" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
    ready: '<path d="M2.8 8.6l3.4 3.3L13.4 4.4" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
    cooking: '<path d="M8.3 1.2c.4 2.6 4.4 4.2 4.4 8.4A4.7 4.7 0 0 1 3.3 9.8c0-2.1 1-3.4 2.1-4.3.1 1.6.9 2.5 1.7 2.7-.5-2.2-.1-4.6 1.2-7z" fill="currentColor"/>',
    door: '<path d="M8 1.8 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 6.4v3.4M8 11.9v.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    done: '<circle cx="8" cy="8" r="7.2" fill="currentColor"/><path d="M4.5 8.3l2.4 2.3 4.6-4.7" fill="none" stroke="var(--bg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    offline: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-dasharray="2.6 2.1"/><path d="M3.2 12.8l9.6-9.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  const ico = (k, cls = "ic") => `<svg class="${cls}" viewBox="0 0 16 16" aria-hidden="true">${ICON[k]}</svg>`;
  const CAM_OFF = '<svg class="camoff" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h3l1.6-2.2h5.8l1.6 2.2h3a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 2 17.5V9a1.5 1.5 0 0 1 1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 3.5l18 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const STOP_SQ = '<svg class="sq" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor"/></svg>';

  // ---------------------------------------------------------------- cook-mode glyphs: the glyph IS the heating element (June)
  const bar = (y) => `<rect x="16" y="${y}" width="68" height="7" rx="3.5"/>`;
  const GLYPH = {
    bake: [bar(66), 82], broil: [bar(13), 18], roast: [bar(13) + bar(66), 50], toast: [bar(13) + bar(66), 50],
    reheat: ['<g fill="none" stroke-width="6.5" stroke-linecap="round">' + [34, 50, 66].map((x) => `<path d="M${x} 20c-7 8 7 15 0 23s7 15 0 23"/>`).join("") + "</g>", 50],
    airfry: ['<g transform="translate(50 43)">' + [20, 110, 200, 290].map((a) => `<path transform="rotate(${a})" d="M0-3C-9-8-9-24 2-25 12-25 12-11 3-3z"/>`).join("") + '<circle r="4"/></g>', 50],
    grill: ['<g stroke-width="6.5" stroke-linecap="round">' + [[24, 50, 46, 28], [30, 66, 70, 26], [52, 64, 76, 40]].map(([a, b, c, d]) => `<path d="M${a} ${b}L${c} ${d}"/>`).join("") + "</g>", 50],
    proof: ['<ellipse cx="50" cy="45" rx="21" ry="17"/>', 50],
    pizza: ['<path d="M33 16h34a4 4 0 0 1 4 4v22c0 7-6 12-14 13v17a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V55c-8-1-14-6-14-13V20a4 4 0 0 1 4-4z"/>', 45],
    dehydrate: ['<circle cx="50" cy="43" r="13"/><g stroke-width="5.5" stroke-linecap="round">' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a} 50 43)" d="M50 16v7"/>`).join("") + "</g>", 50],
    slowcook: ['<path d="M25 38h50v18c0 8-6 13-14 13H39c-8 0-14-5-14-13z"/><path d="M29 33c3-9 39-9 42 0z"/><rect x="45" y="20" width="10" height="7" rx="3"/><rect x="17" y="42" width="9" height="6" rx="3"/><rect x="74" y="42" width="9" height="6" rx="3"/>', 55],
    warm: ['<circle cx="32" cy="43" r="6"/><circle cx="50" cy="43" r="6"/><circle cx="68" cy="43" r="6"/>', 50]
  };
  const GEAR = '<circle cx="50" cy="43" r="27" class="disc"/><g class="gear"><circle cx="50" cy="43" r="16" fill="none" stroke-width="6" stroke-dasharray="6.2 6.4"/><circle cx="50" cy="43" r="12.5" fill="none" stroke-width="4"/><path d="M50 43V31M50 43 39.6 49M50 43l10.4 6" stroke-width="4" stroke-linecap="round"/></g>';
  const REMOTE_OK = ["bake", "roast"]; // remote start proven for Bake/Roast first (brief F)

  function tile(key, label) {
    if (key === "settings") return `<button class="tile set" aria-label="Settings"><span class="tb"><svg viewBox="0 0 100 86" aria-hidden="true">${GEAR}</svg></span><span class="tl">Settings</span></button>`;
    const [g, gy] = GLYPH[key];
    const how = REMOTE_OK.includes(key) ? "choose temperature and time, then review" : "start on the oven";
    return `<button class="tile" style="--gy:${gy}%" aria-label="${esc(label)}: ${how}"><span class="tb"><svg viewBox="0 0 100 86" aria-hidden="true"><g class="gl">${g}</g></svg></span><span class="tl">${esc(label)}</span></button>`;
  }

  // ---------------------------------------------------------------- the two rings
  const RAMP = [[0, [79, 182, 216]], [0.3, [98, 199, 176]], [0.55, [233, 210, 74]], [0.78, [242, 138, 46]], [1, [224, 69, 42]]];
  function ramp(t) {
    for (let i = 1; i < RAMP.length; i++) if (t <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], k = (t - a) / (b - a);
      return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",")})`;
    }
    return "rgb(224,69,42)";
  }
  function ring(kind, f) {
    const W = 11, r = 50 - W / 2, C = 2 * Math.PI * r;
    let arc = "";
    if (kind === "grad") { // thermal gradient: blue (cold) → red (at temperature), filling clockwise from 12 o'clock
      const N = 96, n = Math.round(f * N), pt = (a) => [50 + r * Math.sin(a), 50 - r * Math.cos(a)];
      for (let i = 0; i < n; i++) {
        const a0 = (i / N) * 2 * Math.PI, a1 = ((i + 1.35) / N) * 2 * Math.PI, [x0, y0] = pt(a0), [x1, y1] = pt(Math.min(a1, f * 2 * Math.PI));
        arc += `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" stroke="${ramp(i / N)}"/>`;
      }
      arc = `<g fill="none" stroke-width="${W}">${arc}</g>`;
    } else if (kind === "ember" || kind === "paused") { // ember ring drains with time left
      arc = `<circle class="arc ${kind}" cx="50" cy="50" r="${r}" fill="none" stroke-width="${W}" stroke-linecap="round" stroke-dasharray="${(C * f).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 50 50)"/>`;
    } else if (kind === "done") {
      arc = `<circle class="arc done" cx="50" cy="50" r="${r}" fill="none" stroke-width="${W}"/>`;
    }
    const track = kind === "stale"
      ? `<circle class="trk stale" cx="50" cy="50" r="${r}" fill="none" stroke-width="${W * 0.32}" stroke-dasharray="5 4"/>`
      : `<circle class="trk" cx="50" cy="50" r="${r}" fill="none" stroke-width="${W}"/>`;
    return `<svg class="rsvg" viewBox="0 0 100 100" aria-hidden="true">${track}${arc}</svg>`;
  }

  // ---------------------------------------------------------------- per-state budget (the one place the card's content is decided)
  // tone: colour token for the status line · icon: status shape · lines: [long, short] pairs, bold flag
  function info(s) {
    const base = (s.modeLabel || "").replace(/^Convection /i, "");
    const B = base.charAt(0).toUpperCase() + base.slice(1);
    const eta = String(s.eta || "").replace(/^about /, "");
    switch (s.key) {
      case "preheat": return { hero: `${s.cav}<i>°</i>`, q: `to ${s.tgt}°`, ring: ["grad", s.pct], tone: "ember", icon: "preheat", word: "Preheating",
        lines: [[`${s.modeLabel} · ${s.tgt}°`, `${B} · ${s.tgt}°`], [`Ready in about ${eta}`, `Ready in ~${eta}`]], act: "stop", chips: false, cam: "Live", say: `${s.cav} degrees, preheating to ${s.tgt}, ready in about ${eta}` };
      case "ready": return { hero: `${s.cav}<i>°</i>`, q: "preheated", ring: ["grad", 1], tone: "green", icon: "ready", word: "Ready",
        lines: [["Put food in", "Put food in", true], ["25 min timer starts with food", "Timer starts with food"]], act: "stop", chips: false, cam: "Live", say: `ready at ${s.cav} degrees, put food in` };
      case "cooking": return { hero: esc(s.left), q: "left", ring: ["ember", 1 - s.timerPct], tone: "ember", icon: "cooking", word: "Cooking",
        lines: [[`${s.modeLabel} ${s.tgt}° · food ${s.probe}°`, `${B} ${s.tgt}° · food ${s.probe}°`], [`Done at ${s.doneAt}`, `Done at ${s.doneAt}`]], act: "stop", chips: true, cam: "Live", say: `${s.leftMin | 0} minutes left, done at ${s.doneAt}` };
      case "cookingProbe": {
        const m = (String(s.eta).match(/\d+/) || ["?"])[0];
        return { hero: `${m}<u>min</u>`, q: "or more", ring: ["ember", (s.probeTgt - s.probe) / (s.probeTgt - 45)], tone: "ember", icon: "cooking", word: "Cooking",
          lines: [[`${s.modeLabel} ${s.tgt}° · done about ${s.doneAt}`, `${B} ${s.tgt}° · done ~${s.doneAt.replace(" PM", "")}`], [`Food ${s.probe}° of ${s.probeTgt}°`, `Food ${s.probe}° of ${s.probeTgt}°`, true]], act: "stop", chips: false, cam: "Live", say: `about ${m} minutes or more, food ${s.probe} of ${s.probeTgt} degrees` };
      }
      case "doorOpen": return { hero: esc(s.left), q: "paused", ring: ["paused", 1 - s.timerPct], tone: "amber", icon: "door", word: "Door open",
        lines: [["Heating paused", "Heating paused", true], [`Oven ${s.cav}° · set to ${s.tgt}°`, `Oven ${s.cav}° of ${s.tgt}°`]], act: "stop", chips: true, cam: "Live", say: `door open, heating paused, ${s.left} left on the timer` };
      case "done": return { hero: "Done", q: esc(s.doneAgo), ring: ["done", 1], tone: "green", icon: "done", word: "Take food out",
        lines: [[`Food ${s.probe}° · target ${s.probeTgt}°`, `Food ${s.probe}° of ${s.probeTgt}°`, true], [`${s.modeLabel} finished`, `${B} finished`]], act: "finish", chips: true, cam: s.frameAge, say: `done ${s.doneAgo}, take food out` };
      case "offline": return { hero: esc(s.left), q: "last known", ring: ["stale", 0], tone: "mut", icon: "offline", word: "Not responding",
        lines: [[`Last update ${s.lastUpdate}`, `Last update ${s.lastUpdate}`], [`Was cooking · ${base} ${s.tgt}°`, `Was ${base} ${s.tgt}°`]], act: "stop", chips: false, cam: s.frameAge, say: `not responding, last update ${s.lastUpdate}` };
      default: return { hero: "Off", q: "", ring: ["none", 0], tone: "mut", icon: "off", word: "Off", lines: [], act: "start", chips: false, cam: "Camera off", say: "off" };
    }
  }
  const span2 = ([lg, sm]) => lg === sm ? esc(lg) : `<span class="lg">${esc(lg)}</span><span class="sm">${esc(sm)}</span>`;
  const verb = (s) => ({ bake: "baking", roast: "roasting" }[s.mode] || "cooking");

  // ---------------------------------------------------------------- shared pieces
  function camPane(s, cls = "") {
    if (s.camera === "off") return `<button class="pane off ${cls}" aria-label="${esc(s.oven)} camera is off. Turn on for 5 minutes">${CAM_OFF}<span class="co1">Camera off</span><span class="co2">Turn on</span></button>`;
    return `<button class="pane ${cls}" aria-label="${esc(s.oven)} camera, ${esc(s.frameAge)}. Open larger view">${HX.cameraStill(s)}</button>`;
  }
  function actionBtn(s, I, name) {
    const who = name ? `<small> ${esc(s.oven)}</small>` : "";
    if (I.act === "finish") return `<button class="stop fin" aria-label="Finish and turn off ${esc(s.oven)} oven">${STOP_SQ}<span>Finish${who}</span></button>`;
    if (I.act === "stop") return `<button class="stop" aria-label="Stop ${esc(s.oven)} oven now">${STOP_SQ}<span>Stop${who}</span></button>`;
    return `<button class="startq" aria-label="Choose a cook mode for ${esc(s.oven)} (nothing heats yet)">Start…</button>`;
  }
  function chips(s, I) {
    if (!I.chips) return "";
    const lbl = s.key === "done" ? `Keep ${verb(s)}` : "Add";
    return `<div class="chips" role="group" aria-label="${lbl} time, ${esc(s.oven)}">${[1, 5, 10].map((m) => `<button class="chip" aria-label="${lbl} ${m} minute${m > 1 ? "s" : ""}">+${m}</button>`).join("")}</div>`;
  }
  const rootCls = (s, opts, extra) => `c-d1 t-${opts.theme || "auto"} sz-${opts.size || "standard"} st-${s.key}${s.stale ? " stale" : ""} ${extra}`;

  // ---------------------------------------------------------------- running states (standard + wall)
  function run(s, opts, named) {
    const I = info(s);
    const lines = I.lines.map((l, i) => `<div class="ln${l[2] ? " b" : ""}">${span2(l)}</div>`).join("");
    return `<div class="${rootCls(s, opts, "")}" role="group" aria-label="${esc(s.oven)} oven: ${esc(I.word)}, ${esc(I.say)}"><div class="run">
  <div class="scr"><button class="screen" aria-label="${esc(s.oven)} oven details: adjust, graph, history">
    <span class="ring">${ring(I.ring[0], I.ring[1])}<span class="num"><span class="hv">${I.hero}</span><span class="q">${I.q}</span></span></span>
    <span class="lines"><span class="ln l1 k-${I.tone}">${ico(I.icon)}<span>${esc(I.word)}</span></span>${lines}</span>
  </button></div>
  <div class="win">${camPane(s)}<div class="cap">${esc(s.oven)} · ${esc(I.cam)}</div></div>
  <div class="acts">${chips(s, I)}${actionBtn(s, I, named)}</div>
</div></div>`;
  }

  // ---------------------------------------------------------------- idle home (the oven's home screen)
  const TIME = "6:18", DATE = "Sunday, September 27";
  function home(s, opts) {
    const items = HX.MODES.map(([k, l]) => tile(k, l)).concat(tile("settings"));
    const wall = opts.size === "wall";
    const grid = wall
      ? `<div class="tiles all"><div class="page"><div class="grid g7">${items.join("")}</div></div></div>`
      : `<div class="tiles pager" data-hx-scroll>${[items.slice(0, 8), items.slice(8)].map((p, i) => `<div class="page" role="group" aria-label="Cook modes, page ${i + 1} of 2"><div class="grid">${p.join("")}</div></div>`).join("")}</div>
  <div class="dots" role="group" aria-label="Pages">${[0, 1].map((i) => `<button class="dot${i ? "" : " on"}" data-p="${i}" aria-label="Show page ${i + 1} of 2"${i ? "" : ' aria-current="true"'}></button>`).join("")}</div>`;
    return `<div class="${rootCls(s, opts, "home")}" role="group" aria-label="${esc(s.oven)} oven: off">
  <div class="hd">
    <div class="who"><span class="nm">${esc(s.oven)}</span><span class="stw k-mut">${ico("off")}Off</span></div>
    <div class="clk" aria-label="${TIME}, ${DATE}"><div class="time">${TIME}</div><div class="date">${DATE}</div></div>
    <div class="cw">${camPane(s)}</div>
  </div>
  ${grid}
</div>`;
  }

  // ---------------------------------------------------------------- compact 12×1 (also the strip for other ovens in multi)
  function compact(s, opts, named) {
    const I = info(s);
    const hero = s.key === "off" ? `${ico("off", "ic offr")}Off` : I.hero;
    const second = s.key === "off" ? "Camera off" : ({ preheat: `to ${s.tgt}° · ~${String(s.eta).replace(/^about /, "")}`, ready: "Put food in", cooking: `Done ${s.doneAt}`, cookingProbe: `Food ${s.probe}° of ${s.probeTgt}°`, doorOpen: "Heating paused", done: s.doneAgo, offline: s.lastUpdate }[s.key]);
    const top = named ? `<span class="nm">${esc(s.oven)}</span>` : "";
    return `<div class="${rootCls(s, { ...opts, size: "compact" }, "cmp")}" role="group" aria-label="${esc(s.oven)} oven: ${esc(I.word)}, ${esc(I.say)}">
  ${camPane(s, "sm")}
  <div class="chv">${hero}</div>
  <div class="cst">${top}${s.key === "off" && !named ? `<span class="nm">${esc(s.oven)}</span>` : `<span class="ln l1 k-${I.tone}">${ico(I.icon)}<span>${esc({ done: "Done", offline: "Offline" }[s.key] || I.word)}</span></span>`}${named ? "" : `<span class="ln">${esc(second)}</span>`}</div>
  ${actionBtn(s, I, named)}
</div>`;
  }

  // ---------------------------------------------------------------- CSS
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400&family=Barlow+Semi+Condensed:wght@400;500;600&display=swap');
.c-d1{--bg:#fff;box-sizing:border-box;width:100%;height:100%;position:relative;overflow:hidden;container:d1/size;
  font-family:'Barlow Semi Condensed','Roboto Condensed','Arial Narrow',system-ui,sans-serif;color:var(--fg);background:var(--bg);
  border-radius:var(--ha-card-border-radius,12px);border:1px solid var(--edge);-webkit-font-smoothing:antialiased}
.c-d1 *,.c-d1 *::before,.c-d1 *::after{box-sizing:border-box}
.c-d1 button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.c-d1 button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}

/* ---- looks: Match HA (default) · Light · Dark (the oven's glass) ---- */
.c-d1.t-dark{--bg:#0A0A0B;--fg:#F3F3F3;--mut:#A7A7A7;--edge:rgba(255,255,255,.07);--track:#2B2420;--line:rgba(255,255,255,.1);
  --ember:#FF8A3D;--emberT:#FFA066;--green:#45C46A;--greenT:#5DD27E;--amber:#F2C14B;--amberT:#F2C14B;--stop:#C8302C;--chipB:#6E6E6E;--focus:#FFD27A;
  --food:#5FC6D6;--tileTop:#171010;--tileBot:#461711;--tileRim:#6A2E26;--glyph:#FFD447;--glyphEdge:#E2641C;--bloom:rgba(226,100,28,.42);--sheen:rgba(255,255,255,.07);
  --setTop:#232323;--setBot:#161616;--setRim:#3a3a3a;--disc:#E4E4E4;--gear:#5E6567;--pane:#000;--lbl:#DFDFDF;
  background:linear-gradient(162deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,0) 34%),var(--bg)}
.c-d1.t-light{--bg:#FFFFFF;--fg:#1B1B1B;--mut:#5C5C5C;--edge:#E4E0DC;--track:#EFE8E2;--line:rgba(0,0,0,.1);
  --ember:#E0661A;--emberT:#B0490F;--green:#2E9E4A;--greenT:#1F7A33;--amber:#C9920A;--amberT:#8A6100;--stop:#C8302C;--chipB:#8A8A8A;--focus:#0B6BCB;
  --food:#137C8C;--tileTop:#FFF7F0;--tileBot:#FFD6B8;--tileRim:#EDB38C;--glyph:#EE6F16;--glyphEdge:#C2410C;--bloom:rgba(240,122,30,.28);--sheen:rgba(255,255,255,.45);--glow:drop-shadow(0 0 .8px #C2410C);
  --setTop:#F3F3F3;--setBot:#E2E2E2;--setRim:#CFCFCF;--disc:#FFFFFF;--gear:#5E6567;--pane:#1a1a1a;--lbl:#2A2A2A}
.c-d1.t-auto{--bg:var(--ha-card-background,var(--card-background-color,#fff));--fg:var(--primary-text-color,#212121);--mut:var(--secondary-text-color,#727272);
  --edge:var(--ha-card-border-color,var(--divider-color,#e0e0e0));--line:var(--divider-color,rgba(0,0,0,.12));--track:color-mix(in srgb,var(--fg) 11%,var(--bg));
  --ember:#E8732A;--emberT:color-mix(in srgb,#E0661A 70%,var(--fg));--green:#3DAA55;--greenT:color-mix(in srgb,#2E9E4A 65%,var(--fg));
  --amber:#E0A516;--amberT:color-mix(in srgb,#C9920A 65%,var(--fg));--stop:color-mix(in srgb,var(--error-color,#db4437) 82%,#000);
  --chipB:color-mix(in srgb,var(--fg) 48%,var(--bg));--focus:var(--primary-color,#03a9f4);--food:color-mix(in srgb,#2BA3B5 72%,var(--fg));
  --tileTop:color-mix(in srgb,#E0661A 5%,var(--bg));--tileBot:color-mix(in srgb,#E0661A 30%,var(--bg));--tileRim:color-mix(in srgb,#E0661A 42%,var(--bg));
  --glyph:#F0842A;--glyphEdge:#E2641C;--glow:drop-shadow(0 0 1.6px #E2641C);--bloom:rgba(226,100,28,.4);--sheen:color-mix(in srgb,var(--fg) 7%,transparent);
  --setTop:color-mix(in srgb,var(--fg) 7%,var(--bg));--setBot:color-mix(in srgb,var(--fg) 13%,var(--bg));--setRim:color-mix(in srgb,var(--fg) 20%,var(--bg));
  --disc:color-mix(in srgb,var(--fg) 8%,#ECECEC);--gear:#5E6567;--pane:#000;--lbl:var(--fg)}
.c-d1 .k-ember{color:var(--emberT)} .c-d1 .k-green{color:var(--greenT)} .c-d1 .k-amber{color:var(--amberT)} .c-d1 .k-mut{color:var(--mut)}
.c-d1 .ic{width:1em;height:1em;flex:none}

/* ---- running states: [screen | window] over [quiet group ··· Stop] ---- */
.c-d1 .run{height:100%;display:grid;grid-template-columns:minmax(0,1fr) var(--wc);grid-template-rows:minmax(0,1fr) 48px;
  grid-template-areas:"scr win" "acts acts";column-gap:16px;row-gap:12px;padding:14px 16px;--wc:46%;--linesH:66px}
.c-d1 .scr{grid-area:scr;container-type:size;min-width:0;min-height:0}
.c-d1 .screen{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border-radius:14px}
.c-d1 .ring{position:relative;display:block;flex:none;width:min(100cqw,calc(100cqh - var(--linesH)));aspect-ratio:1;container-type:inline-size}
.c-d1 .rsvg{position:absolute;inset:0;width:100%;height:100%;display:block}
.c-d1 .trk{stroke:var(--track)} .c-d1 .trk.stale{stroke:var(--mut);opacity:.7}
.c-d1 .arc.ember{stroke:var(--ember)} .c-d1 .arc.paused{stroke:var(--ember);opacity:.38} .c-d1 .arc.done{stroke:var(--green)}
.c-d1 .num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.c-d1 .hv{font-family:'Barlow Condensed','Roboto Condensed','Arial Narrow',sans-serif;font-weight:300;font-size:31cqw;letter-spacing:-.01em;font-variant-numeric:tabular-nums;margin-top:6cqw}
.c-d1 .hv i{font-style:normal;font-size:.62em;vertical-align:.52em;margin-left:.02em}
.c-d1 .hv u{text-decoration:none;font-size:.3em;margin-left:.12em;font-weight:400}
.c-d1.st-done .hv{font-size:24cqw}
.c-d1 .q{font-size:max(11px,6.6cqw);color:var(--mut);margin-top:2.5cqw;font-weight:500;white-space:nowrap}
.c-d1 .lines{display:flex;flex-direction:column;align-items:center;width:100%;min-width:0}
.c-d1 .ln{display:block;max-width:100%;font-size:14px;line-height:19px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d1 .ln.b{color:var(--fg);font-weight:600}
.c-d1 .ln.l1{display:flex;align-items:center;gap:5px;font-size:15px;font-weight:600;line-height:20px}
.c-d1 .ln .sm{display:none}
.c-d1 .win{grid-area:win;container-type:size;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.c-d1 .pane{display:block;flex:none;aspect-ratio:4/3;width:min(100cqw,calc((100cqh - 26px) * 4 / 3),var(--camMax,999px));background:var(--pane);border-radius:10px;overflow:hidden;
  box-shadow:0 0 0 1px var(--line)}
.c-d1 .pane .hx-still{width:100%;height:100%}
.c-d1 .pane.off{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:var(--setBot);color:var(--mut);font-size:12px;line-height:14px}
.c-d1 .pane.off .camoff{width:20px;height:20px;margin-bottom:2px}
.c-d1 .pane.off .co2{color:var(--fg);font-weight:600;text-decoration:underline;text-underline-offset:2px}
.c-d1 .cap{font-size:13px;line-height:20px;color:var(--mut);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.c-d1 .acts{grid-area:acts;display:flex;align-items:center;min-width:0}
.c-d1 .chips{display:flex;gap:6px}
.c-d1 .chip{min-width:52px;height:48px;padding:0 10px;border-radius:24px;border:1.5px solid var(--chipB);font-weight:500;font-size:16px;font-variant-numeric:tabular-nums}
.c-d1 .chip:hover{background:color-mix(in srgb,var(--fg) 7%,transparent)}
.c-d1 .stop{margin-left:auto;height:48px;width:calc((100cqw - 32px) * .46);display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 12px;
  border-radius:12px;background:var(--stop);color:#fff;font-weight:600;font-size:17px;white-space:nowrap;box-shadow:0 1px 0 rgba(255,255,255,.14) inset}
.c-d1 .stop .sq{width:12px;height:12px;flex:none}
.c-d1 .stop small{font:inherit}
.c-d1 .startq{margin-left:auto;height:48px;padding:0 18px;border-radius:12px;border:1.5px solid var(--chipB);font-weight:600;font-size:16px}
.c-d1.stale .hv,.c-d1.stale .q{opacity:.5}
.c-d1.stale .hv{text-decoration:line-through 1px;text-decoration-color:color-mix(in srgb,var(--fg) 40%,transparent)}
@container d1 (max-width:420px){
  .c-d1 .ln .lg{display:none} .c-d1 .ln .sm{display:inline}
  .c-d1 .chips{gap:4px} .c-d1 .chip{min-width:48px;padding:0 8px}
  .c-d1 .stop{width:122px;font-size:16px;gap:6px;padding:0 8px}
}
@container d1 (max-width:340px){
  .c-d1 .stop{width:84px;padding:0 6px} .c-d1 .stop .sq{display:none}
  .c-d1 .stop span{display:flex;flex-direction:column;align-items:center;line-height:18px}
  .c-d1 .stop small{display:block;font-size:12px;line-height:14px;font-weight:500}
}

/* ---- wall (24 × 9, spans two section columns): same elements, larger; actions move under the window ---- */
.c-d1.sz-wall .run{grid-template-areas:"scr win" "scr acts";grid-template-rows:minmax(0,1fr) 60px;--wc:clamp(330px,42%,440px);--camMax:400px;column-gap:40px;row-gap:18px;padding:24px 32px;--linesH:112px}
.c-d1.sz-wall .screen{gap:12px}
.c-d1.sz-wall .ln{font-size:22px;line-height:28px}
.c-d1.sz-wall .ln.l1{font-size:28px;line-height:34px;gap:9px}
.c-d1.sz-wall .q{font-size:max(15px,5.4cqw)}
.c-d1.sz-wall .win{justify-content:flex-end;gap:10px}
.c-d1.sz-wall .pane{width:min(100cqw,calc((100cqh - 38px) * 4 / 3),var(--camMax));border-radius:14px}
.c-d1.sz-wall .cap{font-size:18px;line-height:28px}
.c-d1.sz-wall .acts{width:min(100%,var(--camMax));justify-self:center;align-self:start}
.c-d1.sz-wall .chip{min-width:56px;height:56px;border-radius:28px;font-size:19px;padding:0 8px}
.c-d1.sz-wall .chips{gap:8px}
.c-d1.sz-wall .stop{height:56px;width:148px;font-size:21px;border-radius:14px}
.c-d1.sz-wall .stop .sq{width:14px;height:14px}
@container d1 (max-width:900px){
  .c-d1.sz-wall .run{--wc:300px;--camMax:300px;column-gap:32px}
  .c-d1.sz-wall .ln .lg{display:none} .c-d1.sz-wall .ln .sm{display:inline}
  .c-d1.sz-wall .chip{min-width:48px;padding:0 6px;font-size:18px} .c-d1.sz-wall .chips{gap:4px} .c-d1.sz-wall .stop{width:100px;font-size:18px;gap:6px}
}

/* ---- idle home: centred clock + date, glowing element tiles in pages with tappable dots ---- */
.c-d1.home{display:flex;flex-direction:column;padding:14px 16px 6px}
.c-d1 .hd{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;flex:none;height:62px}
.c-d1 .who{display:flex;flex-direction:column;gap:2px;min-width:0}
.c-d1 .nm{font-size:13px;line-height:16px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d1 .stw{display:flex;align-items:center;gap:5px;font-size:15px;font-weight:600;line-height:18px}
.c-d1 .clk{text-align:center;padding:0 8px}
.c-d1 .time{font-family:'Barlow Condensed','Roboto Condensed',sans-serif;font-weight:300;font-size:46px;line-height:44px;font-variant-numeric:tabular-nums}
.c-d1 .date{font-size:13px;line-height:17px;color:var(--mut);white-space:nowrap}
.c-d1 .cw{justify-self:end}
.c-d1 .cw .pane{width:76px}
.c-d1 .tiles{flex:1;min-height:0;margin-top:8px;display:flex}
.c-d1 .pager{overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}
.c-d1 .pager::-webkit-scrollbar{display:none}
.c-d1 .page{flex:0 0 100%;height:100%;scroll-snap-align:start;container-type:size}
.c-d1 .grid{--g:14px;--lab:22px;--tw:min(calc((100cqw - 3 * var(--g)) / 4),calc(((100cqh - var(--g)) / 2 - var(--lab)) * 1.16));
  height:100%;display:grid;grid-template-columns:repeat(4,var(--tw));justify-content:center;align-content:center;gap:var(--g)}
.c-d1 .grid.g7{--g:20px;--lab:30px;--tw:min(calc((100cqw - 6 * var(--g)) / 7),calc(((100cqh - var(--g)) / 2 - var(--lab)) * 1.16));grid-template-columns:repeat(7,var(--tw))}
.c-d1 .tile{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}
.c-d1 .tb{position:relative;display:block;width:100%;aspect-ratio:1.16;border-radius:16%/18.5%;overflow:hidden;
  background:radial-gradient(70% 55% at 50% var(--gy),var(--bloom),transparent 72%),linear-gradient(180deg,var(--tileTop),var(--tileBot));
  box-shadow:inset 0 0 0 1px var(--tileRim),0 0 0 .5px color-mix(in srgb,var(--glyphEdge) 40%,transparent)}
.c-d1 .tb::before{content:"";position:absolute;inset:0;background:linear-gradient(112deg,transparent 58%,var(--sheen) 59%,transparent 82%);pointer-events:none}
.c-d1 .tb::after{content:"";position:absolute;inset:0;background:radial-gradient(60% 45% at 50% var(--gy),var(--bloom),transparent 70%);opacity:0;transition:opacity .25s;pointer-events:none}
.c-d1 .tile:hover .tb::after,.c-d1 .tile:focus-visible .tb::after,.c-d1 .tile:active .tb::after{opacity:1}
.c-d1 .tb svg{position:absolute;inset:0;width:100%;height:100%;z-index:1}
.c-d1 .gl{fill:var(--glyph);stroke:var(--glyph);filter:var(--glow,drop-shadow(0 0 2.2px var(--glyphEdge)) drop-shadow(0 0 5px color-mix(in srgb,var(--glyphEdge) 60%,transparent)))}
.c-d1 .gl rect,.c-d1 .gl circle,.c-d1 .gl ellipse,.c-d1 .gl>path{stroke:none}
.c-d1 .tile.set .tb{background:linear-gradient(180deg,var(--setTop),var(--setBot));box-shadow:inset 0 0 0 1px var(--setRim)}
.c-d1 .tile.set .disc{fill:var(--disc)} .c-d1 .tile.set .gear{stroke:var(--gear)}
.c-d1 .tl{font-size:13px;line-height:17px;color:var(--lbl);font-weight:500;white-space:nowrap;max-width:calc(100% + var(--g));overflow:hidden;text-overflow:ellipsis}
.c-d1 .dots{flex:none;height:48px;display:flex;justify-content:center;align-items:center}
.c-d1 .dot{width:48px;height:48px;display:grid;place-items:center}
.c-d1 .dot::before{content:"";width:8px;height:8px;border-radius:4px;background:color-mix(in srgb,var(--fg) 30%,transparent);transition:width .2s}
.c-d1 .dot.on::before{width:20px;background:var(--fg)}
.c-d1.sz-wall.home{padding:22px 32px 20px}
.c-d1.sz-wall .hd{height:132px}
.c-d1.sz-wall .time{font-size:104px;line-height:100px}
.c-d1.sz-wall .date{font-size:20px;line-height:28px}
.c-d1.sz-wall .nm{font-size:18px;line-height:24px} .c-d1.sz-wall .stw{font-size:24px;line-height:30px;gap:8px}
.c-d1.sz-wall .cw .pane{width:152px;font-size:16px;line-height:20px} .c-d1.sz-wall .pane.off .camoff{width:30px;height:30px}
.c-d1.sz-wall .tiles{margin-top:14px}
.c-d1.sz-wall .tl{font-size:18px;line-height:24px}
.c-d1.sz-wall .tile{gap:6px}

/* ---- compact 12 × 1 ---- */
.c-d1.cmp{display:flex;align-items:center;gap:10px;padding:3px 4px 3px 4px}
.c-d1 .pane.sm{width:64px;border-radius:8px}
.c-d1 .pane.sm.off .co1,.c-d1 .pane.sm.off .co2{display:none}
.c-d1 .chv{font-family:'Barlow Condensed','Roboto Condensed',sans-serif;font-weight:400;font-size:32px;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;flex:none}
.c-d1 .chv i{font-style:normal;font-size:.62em;vertical-align:.5em} .c-d1 .chv u{text-decoration:none;font-size:.45em;margin-left:.1em}
.c-d1 .cst{flex:1;min-width:0;display:flex;flex-direction:column}
.c-d1.cmp .ln{font-size:13px;line-height:17px}
.c-d1.cmp .ln.l1{font-size:14px;line-height:19px}
.c-d1.cmp .nm{font-size:14px;line-height:18px;color:var(--fg);font-weight:600}
.c-d1.cmp .stop{width:auto;padding:0 14px;font-size:16px}
.c-d1.cmp .startq{padding:0 14px}
.c-d1.cmp.st-off .chv{color:var(--mut);display:flex;align-items:center;gap:6px} .c-d1 .offr{width:.55em;height:.55em}
.c-d1.cmp.stale .chv{opacity:.5;text-decoration:line-through 1px}

/* ---- several ovens: other ovens as strips on top; the selected oven below ---- */
.c-d1.multi{display:flex;flex-direction:column;container-type:normal}
.c-d1.multi>.strip{flex:none;height:56px;border-bottom:1px solid var(--line)}
.c-d1.multi>.strip>.c-d1{border:0;border-radius:0;background:transparent}
.c-d1.multi>.quiet{flex:none;height:48px;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid var(--line);color:var(--mut);font-size:14px;text-align:left;width:100%}
.c-d1.multi>.quiet .go{margin-left:auto;font-size:13px}
.c-d1.multi>.main{flex:1;min-height:0}
.c-d1.multi>.main>.c-d1{border:0;border-radius:0;background:transparent}

/* ---- detail view (more-info dialog, 420 wide) ---- */
.c-d1.dl{height:auto;container:none;container-type:inline-size;padding:0 0 18px;border-radius:var(--ha-card-border-radius,12px)}
.c-d1.dl .dh{display:flex;align-items:center;gap:10px;padding:14px 16px 6px}
.c-d1.dl .dh .t{font-size:20px;font-weight:600;line-height:26px}
.c-d1.dl .dh .x{margin-left:auto;width:48px;height:48px;display:grid;place-items:center;font-size:22px;color:var(--mut)}
.c-d1.dl .tabs{display:flex;margin:4px 16px 12px;border-bottom:1px solid var(--line)}
.c-d1.dl .tab{flex:1;height:48px;font-size:15px;font-weight:500;color:var(--mut);border-bottom:2px solid transparent;margin-bottom:-1px}
.c-d1.dl .tab[aria-selected=true]{color:var(--fg);border-bottom-color:var(--fg);font-weight:600}
.c-d1.dl .sec{padding:0 16px}
.c-d1.dl .h{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--mut);font-weight:600;margin:18px 16px 6px}
.c-d1.dl .top{display:flex;align-items:center;gap:16px;padding:0 16px}
.c-d1.dl .top .ring{width:132px}
.c-d1.dl .top .lines{align-items:flex-start}
.c-d1.dl .top .ln.l1{justify-content:flex-start}
.c-d1.dl .bigcam{margin:14px 16px 0}
.c-d1.dl .bigcam .pane{width:100%;border-radius:12px}
.c-d1.dl .camrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px}
.c-d1.dl .camrow .cap{font-size:13px}
.c-d1.dl .btn2{height:48px;padding:0 16px;border-radius:12px;border:1.5px solid var(--chipB);font-weight:600;font-size:15px;white-space:nowrap}
.c-d1.dl .drow{display:flex;align-items:center;gap:10px;min-height:60px;padding:6px 16px;border-top:1px solid var(--line)}
.c-d1.dl .drow:last-child{border-bottom:1px solid var(--line)}
.c-d1.dl .rl{flex:1;min-width:0;display:flex;flex-direction:column}
.c-d1.dl .rl b{font-size:15px;font-weight:600;line-height:20px} .c-d1.dl .rl span{font-size:13px;color:var(--mut);line-height:18px}
.c-d1.dl .step{display:flex;align-items:center;gap:4px}
.c-d1.dl .step button{width:48px;height:48px;border-radius:24px;border:1.5px solid var(--chipB);font-size:22px;line-height:1}
.c-d1.dl .step output{min-width:64px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:26px;font-variant-numeric:tabular-nums}
.c-d1.dl .full{display:flex;width:calc(100% - 32px);margin:16px 16px 0;height:52px;align-items:center;justify-content:center;gap:8px;border-radius:12px;font-weight:600;font-size:17px}
.c-d1.dl .stop.full{width:calc(100% - 32px);background:var(--stop);color:#fff}
.c-d1.dl .go{background:linear-gradient(180deg,#F9B24A,#EA6A1F);color:#1a0d05}
.c-d1.dl .sec2{border:1.5px solid var(--chipB)}
.c-d1.dl .xrow{border:0;color:var(--mut);font-size:22px;height:48px;margin-top:6px}
.c-d1.dl .chips{gap:6px}
.c-d1.dl svg.gr{display:block;width:100%;height:auto}
.c-d1.dl .gr .ax{stroke:var(--line)} .c-d1.dl .gr text{fill:var(--mut);font-size:11px;font-family:'Barlow Semi Condensed',sans-serif}
.c-d1.dl .gr .ov{stroke:var(--ember);fill:none;stroke-width:2.5;stroke-linejoin:round}
.c-d1.dl .gr .fd{stroke:var(--food);fill:none;stroke-width:2.5;stroke-dasharray:6 3.5;stroke-linejoin:round}
.c-d1.dl .gr .tg{stroke-width:1.2;stroke-dasharray:2 3}
.c-d1.dl .gr .door{fill:var(--amber);opacity:.22} .c-d1.dl .gr .doorl{stroke:var(--amberT);stroke-width:1.5}
.c-d1.dl .legend{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px 0}
.c-d1.dl .lgd{display:inline-flex;align-items:center;gap:7px;height:44px;min-height:48px;padding:0 12px;border-radius:24px;border:1.5px solid var(--chipB);font-size:14px;font-weight:500}
.c-d1.dl .lgd svg{width:22px;height:10px}
.c-d1.dl .note{font-size:14px;line-height:20px;color:var(--mut);padding:10px 16px 0}
.c-d1.dl .note b{color:var(--fg);font-weight:600}
.c-d1.dl .thumb{width:64px;flex:none}
.c-d1.dl .thumb .pane{width:64px;border-radius:8px}
.c-d1.dl .chev{color:var(--mut);font-size:22px;width:24px;text-align:center}
.c-d1.dl .sw{width:52px;height:32px;border-radius:16px;background:color-mix(in srgb,var(--fg) 22%,transparent);position:relative;flex:none;margin:8px 0}
.c-d1.dl .sw::after{content:"";position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:12px;background:var(--bg)}
.c-d1.dl .sw[aria-checked=true]{background:var(--greenT)} .c-d1.dl .sw[aria-checked=true]::after{left:24px}
.c-d1.dl .swb{display:flex;align-items:center;min-height:48px;padding:0 4px}
.c-d1.dl .modehd{display:flex;align-items:center;gap:14px;padding:4px 16px 12px}
.c-d1.dl .modehd .tb{width:72px;flex:none}
.c-d1.dl .rev{text-align:center;padding:6px 16px 0}
.c-d1.dl .rev .big{font-family:'Barlow Condensed',sans-serif;font-weight:300;font-size:56px;line-height:60px}
.c-d1.dl .rev .sub{font-size:15px;color:var(--mut);line-height:21px}
.c-d1.dl .exp{display:flex;align-items:center;gap:10px;padding:14px 16px 0;font-size:14px;color:var(--mut)}
.c-d1.dl .exp .bar{flex:1;height:4px;border-radius:2px;background:var(--track);overflow:hidden}
.c-d1.dl .exp .bar i{display:block;height:100%;width:97%;background:var(--mut)}
@media (prefers-reduced-motion:reduce){.c-d1 *{transition:none!important}}
`;

  // ---------------------------------------------------------------- detail view
  const TABS = [["now", "Now"], ["graph", "Graph"], ["history", "History"], ["settings", "Settings"]];
  function dHead(s, title, page) {
    const tabs = TABS.some(([k]) => k === page) ? `<div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${k === page}">${l}</button>`).join("")}</div>` : "";
    return `<div class="dh"><span class="t">${esc(title)}</span><button class="x" aria-label="Close">×</button></div>${tabs}`;
  }
  function graph(H) {
    const X0 = 38, X1 = 380, Y0 = 196, Y1 = 14, T0 = 50, T1 = 450;
    const x = (m) => X0 + (m / H.end) * (X1 - X0), y = (t) => Y0 - ((t - T0) / (T1 - T0)) * (Y0 - Y1);
    const path = (pts) => pts.map(([m, t], i) => `${i ? "L" : "M"}${x(m).toFixed(1)} ${y(t).toFixed(1)}`).join("");
    let g = "";
    for (const t of [100, 200, 300, 400]) g += `<path class="ax" d="M${X0} ${y(t)}H${X1}"/><text x="${X0 - 6}" y="${y(t) + 4}" text-anchor="end">${t}°</text>`;
    for (const m of [0, 10, 20, 30]) g += `<text x="${x(m)}" y="${Y0 + 17}" text-anchor="middle">${m} min</text>`;
    for (const [a, b] of H.doors) g += `<rect class="door" x="${x(a)}" y="${Y1}" width="${x(b) - x(a)}" height="${Y0 - Y1}"/><path class="doorl" d="M${x(a)} ${Y1}V${Y0}"/><text x="${x(a) + 4}" y="${Y1 + 11}" style="fill:var(--amberT);font-weight:600">Door</text>`;
    g += `<path class="tg" style="stroke:var(--ember)" d="M${X0} ${y(H.cavTgt)}H${X1}"/><path class="tg" style="stroke:var(--food)" d="M${X0} ${y(H.probeTgt)}H${X1}"/>`;
    g += `<text x="${X1}" y="${y(H.probeTgt) - 5}" text-anchor="end" style="fill:var(--food)">food target ${H.probeTgt}°</text>`;
    g += `<path class="ov" d="${path(H.cav)}"/><path class="fd" d="${path(H.probe)}"/>`;
    return `<svg class="gr" viewBox="0 0 388 222" role="img" aria-label="Temperature graph: oven reached 400 degrees at 11 minutes, dipped to 352 when the door was open from 13.4 to 14.8 minutes, recovered by 16 minutes. Food at 128 of 145 degrees.">${g}</svg>`;
  }
  function detail(s, { page, theme }) {
    const I = info(s), root = `c-d1 t-${theme || "auto"} dl st-${s.key}`;
    const ringBlock = `<div class="top"><span class="ring">${ring(I.ring[0], I.ring[1])}<span class="num"><span class="hv">${I.hero}</span><span class="q">${I.q}</span></span></span><span class="lines"><span class="ln l1 k-${I.tone}">${ico(I.icon)}<span>${esc(I.word)}</span></span>${I.lines.map((l) => `<span class="ln${l[2] ? " b" : ""}">${esc(l[0])}</span>`).join("")}</span></div>`;
    const stepper = (label, sub, val) => `<div class="drow"><div class="rl"><b>${label}</b><span>${sub}</span></div><div class="step"><button aria-label="Lower ${label}">−</button><output>${val}</output><button aria-label="Raise ${label}">+</button></div></div>`;
    if (page === "now") return `<div class="${root}">${dHead(s, s.oven, page)}${ringBlock}
  <div class="bigcam">${camPane(s)}<div class="camrow"><span class="cap">Still · refreshes every 2 s · ${esc(s.frameAge)}</span><button class="btn2" aria-label="Watch live video for 5 minutes">Watch live · 5 min</button></div></div>
  <div class="h">Adjust</div>
  ${stepper("Oven temperature", `Now ${s.cav}° · ${esc(s.modeLabel)}`, `${s.tgt}°`)}
  <div class="drow"><div class="rl"><b>Timer</b><span>${esc(s.left)} left · done at ${esc(s.doneAt)}</span></div><div class="chips">${[1, 5, 10].map((m) => `<button class="chip" aria-label="Add ${m} minutes">+${m}</button>`).join("")}</div></div>
  ${stepper("Food target", `Food now ${s.probe}°`, `${s.probeTgt}°`)}
  <button class="stop full" aria-label="Stop ${esc(s.oven)} oven now">${STOP_SQ}<span>Stop ${verb(s)}</span></button></div>`;
    if (page === "graph") {
      const H = HX.HISTORY;
      return `<div class="${root}">${dHead(s, s.oven, page)}<div class="sec">${graph(H)}</div>
  <div class="legend" role="group" aria-label="Show or hide lines">
    <button class="lgd" aria-pressed="true"><svg viewBox="0 0 22 10"><path d="M1 5h20" stroke="var(--ember)" stroke-width="3"/></svg>Oven ${s.cav}°</button>
    <button class="lgd" aria-pressed="true"><svg viewBox="0 0 22 10"><path d="M1 5h20" stroke="var(--food)" stroke-width="3" stroke-dasharray="6 3"/></svg>Food ${s.probe}°</button>
    <button class="lgd" aria-pressed="true"><svg viewBox="0 0 22 10"><rect x="4" y="0" width="14" height="10" fill="var(--amber)" opacity=".35"/><path d="M4 0v10" stroke="var(--amberT)" stroke-width="1.5"/></svg>Door open · 1</button>
  </div>
  <p class="note"><b>Door opened once</b> at 13 min for 1 min 24 s. Heating paused; the oven fell to 352° and was back at 400° by 16 min.</p></div>`;
    }
    if (page === "history") {
      const rows = [
        [{ ...s, key: "done", camera: "stopped" }, "Convection bake · 400°", "Today 6:12 PM · 30 min · door opened once"],
        [{ ...s, key: "done", camera: "stopped" }, "Roast · food 145°", "Yesterday 5:40 PM · 52 min"],
        [{ ...s, key: "done", camera: "stopped" }, "Toast · 3 slices", "Fri 7:55 AM · 4 min"]
      ];
      return `<div class="${root}">${dHead(s, s.oven, page)}${rows.map(([st, a, b]) => `<button class="drow" style="width:100%;text-align:left" aria-label="${a}, ${b}. Open graph and time-lapse"><span class="thumb"><span class="pane" style="display:block">${HX.cameraStill(st)}</span></span><span class="rl"><b>${a}</b><span>${b}</span></span><span class="chev" aria-hidden="true">›</span></button>`).join("")}
  <p class="note">Each cook keeps its temperature graph, door marks and a camera time-lapse.</p></div>`;
    }
    if (page === "settings") {
      const sw = (label, sub, on) => `<div class="drow"><div class="rl"><b>${label}</b><span>${sub}</span></div><button class="swb" role="switch" aria-checked="${on}" aria-label="${label}"><span class="sw" aria-checked="${on}"></span></button></div>`;
      return `<div class="${root}">${dHead(s, s.oven, page)}
  <div class="h">Alerts</div>${sw("Ready and done", "One alert each, with +5 min and camera", true)}${sw("Food reached target", "Probe cooks", true)}${sw("Door left open while heating", "After 1 minute", true)}
  <div class="h">Camera</div>${sw("Camera on while cooking", "Stills refresh every 2 s", true)}<div class="drow"><div class="rl"><b>After a cook</b><span>Keep the camera on for 5 min, then off</span></div><span class="chev">›</span></div>
  <div class="h">Remote start</div><div class="drow"><div class="rl"><b>Allowed for Bake and Roast</b><span>Change this on the oven: Settings › App Permissions</span></div></div>
  <div class="h">Oven</div><div class="drow"><div class="rl"><b>June Oven, 3rd gen · june-local 0.9</b><span>Connected · updated ${esc(s.lastUpdate)}</span></div><span class="chev">›</span></div></div>`;
    }
    if (page === "start") return `<div class="${root}">${dHead(s, "Bake · " + s.oven, page)}
  <div class="modehd">${tile("bake", "Bake").replace('<span class="tl">Bake</span>', "")}<div class="rl"><b style="font-size:17px">Step 1 of 2 · choose</b><span>Nothing heats until you review and start.</span></div></div>
  ${stepper("Temperature", "Bottom element · fan on", "400°")}${stepper("Timer", "Starts when food goes in", "25 min")}
  <div class="drow"><div class="rl"><b>Food probe</b><span>Not plugged in</span></div><span class="chev">›</span></div>
  <button class="full sec2">Review</button><button class="full xrow" aria-label="Cancel">×</button></div>`;
    if (page === "review") return `<div class="${root}">${dHead(s, "Bake · " + s.oven, page)}
  <div class="rev"><div class="sub" style="font-weight:600;color:var(--fg)">Step 2 of 2 · review</div><div class="big">400°</div><div class="sub">Convection bake in <b style="color:var(--fg)">${esc(s.oven)}</b><br>25 min timer, starts when food goes in</div></div>
  <div class="exp"><span>Review expires in 4:52</span><span class="bar"><i></i></span></div>
  <button class="full go" aria-label="Start baking at 400 degrees in ${esc(s.oven)}">Start Baking</button>
  <button class="full sec2">Change</button><button class="full xrow" aria-label="Cancel, nothing heats">×</button></div>`;
    return "";
  }

  // ---------------------------------------------------------------- several ovens
  const heating = (o) => !["off", "done"].includes(o.key);
  function multi(ovens, opts) {
    const theme = opts.theme || "auto";
    const main = ovens.find(heating) || ovens[0];
    const rest = ovens.filter((o) => o !== main);
    const top = rest.map((o) => heating(o)
      ? `<div class="strip" role="button" tabindex="0" aria-label="Show ${esc(o.oven)} oven">${compact(o, { theme }, true)}</div>`
      : `<button class="quiet" aria-label="Show ${esc(o.oven)} oven, off">${ico("off")}<span>${esc(o.oven)} · Off</span><span class="go">Show ›</span></button>`).join("");
    const body = main.key === "off" ? home(main, { theme, size: "standard" }) : run(main, { theme, size: "standard" }, true);
    const html = `<div class="c-d1 t-${theme} multi">${top}<div class="main">${body}</div></div>`;
    const cap = ovens.map((o) => `${o.oven} ${o.word.toLowerCase()}`).join(" + ");
    return HX.frame(html, 12, 7, opts.width, 1, cap);
  }

  // ---------------------------------------------------------------- wiring: tappable page dots (tap alternative to swipe)
  function wire(root) {
    root.querySelectorAll(".c-d1.home").forEach((card) => {
      const pager = card.querySelector(".pager"), dots = [...card.querySelectorAll(".dot")];
      if (!pager) return;
      const mark = (i) => dots.forEach((d, j) => { d.classList.toggle("on", i === j); if (i === j) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      dots.forEach((d, i) => d.addEventListener("click", () => { pager.scrollLeft = i * pager.clientWidth; mark(i); }));
      pager.addEventListener("scroll", () => mark(Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth))), { passive: true });
    });
  }

  window.CONCEPTS.d1 = {
    name: "d1 · Second Screen",
    css,
    sizes: { standard: [12, 6], wall: [24, 9, 2], compact: [12, 1] },
    render(s, opts) {
      if (opts.size === "compact") return compact(s, opts, false);
      if (s.key === "off") return home(s, opts);
      return run(s, opts, false);
    },
    multi,
    detailPages: ["now", "graph", "history", "settings", "start", "review"],
    detail,
    wire
  };
})();
