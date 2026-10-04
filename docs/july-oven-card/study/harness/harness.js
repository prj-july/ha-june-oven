/* July Oven card — shared mockup harness for the fresh Glass study.
 * Neutral tooling only: HA grid boxes, sample oven data, a camera still, a fit checker.
 * Design concepts register themselves in window.CONCEPTS (see README.md next to this file).
 */
(function () {
  "use strict";
  // ---- Home Assistant Sections grid ------------------------------------------------------------
  // Section column 320–500 px wide, 12 columns, 8 px gaps, 56 px rows. A card's height is fixed by
  // its rows: rows × 56 + (rows − 1) × 8. Content must fit that box; it never grows the card.
  const ROW = 56, GAP = 8, SECTION_GAP = 32;
  const colW = (secW, cc) => (secW - (cc - 1) * GAP) / cc;
  const cardW = (cols, secW, cc) => cols * colW(secW, cc) + (cols - 1) * GAP;
  const cardH = (rows) => rows * ROW + (rows - 1) * GAP;
  /** Draw a card inside a real HA section grid. span = section columns the section spans (1 or 2). */
  function frame(inner, cols, rows, secBase = 500, span = 1, caption = "") {
    const secW = span * secBase + (span - 1) * SECTION_GAP, cc = 12 * span;
    const w = cardW(cols, secW, cc), h = cardH(rows), cw = colW(secW, cc);
    const bg = `repeating-linear-gradient(90deg,var(--gridc) 0 ${cw}px,transparent ${cw}px ${cw + GAP}px),repeating-linear-gradient(180deg,var(--gridc) 0 ${ROW}px,transparent ${ROW}px ${ROW + GAP}px)`;
    return `<figure class="hx-fig"><div class="hx-scaler" data-w="${secW}" data-h="${h}"><div class="hx-sec" style="width:${secW}px;height:${h}px;background:${bg}"><div class="hx-card" style="width:${w}px;height:${h}px">${inner}</div></div></div><figcaption>${caption ? caption + " · " : ""}${cols} × ${rows} cells, ${secW} px section · card ${Math.round(w)} × ${h} px</figcaption></figure>`;
  }
  function fitScalers(root = document) {
    root.querySelectorAll(".hx-scaler").forEach((el) => {
      const inner = el.firstElementChild, natural = +el.dataset.w, h = +el.dataset.h;
      const avail = el.parentElement.clientWidth || natural;
      const s = Math.min(1, avail / natural);
      inner.style.transform = s < 1 ? `scale(${s})` : "";
      el.style.width = `${natural * s}px`;
      el.style.height = `${h * s}px`;
    });
  }
  /** Returns a list of overflow problems for every .hx-card under root. */
  function checkFit(root = document) {
    const bad = [];
    root.querySelectorAll(".hx-card").forEach((card, i) => {
      const box = card.getBoundingClientRect();
      if (card.scrollWidth > card.clientWidth + 1 || card.scrollHeight > card.clientHeight + 1) bad.push(`card ${i}: content larger than the card`);
      card.querySelectorAll("*").forEach((e) => {
        if (e.closest("[data-hx-scroll]") && !e.matches("[data-hx-scroll]")) return; // inside an intentional scroller/pager
        const r = e.getBoundingClientRect();
        if (!r.width && !r.height) return;
        if (r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.top < box.top - 1) bad.push(`card ${i}: <${e.tagName.toLowerCase()} class="${e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className}"> spills out`);
      });
    });
    return bad;
  }

  // ---- Sample data (from a real 22 Sept 2026 bake capture, °F) -----------------------------------
  // Every state has the same fields; null means "not reported in this state".
  const base = { oven: "Kitchen", cav: null, tgt: null, mode: null, modeLabel: null, eta: null, left: null, timer: null, doneAt: null, probe: null, probeTgt: null, estimating: false, stale: false, lastUpdate: "now", door: "closed", camera: "live", frameAge: "Live", step: null, program: null };
  const S = {
    off: { ...base, key: "off", word: "Off", cav: 74, camera: "off", frameAge: null, sentence: "Oven is off" },
    preheat: { ...base, key: "preheat", word: "Preheating", cav: 312, tgt: 400, mode: "bake", modeLabel: "Convection bake", eta: "about 4 min", pct: 0.73, timer: "25 min (starts when food goes in)", sentence: "Preheating to 400 °F" },
    ready: { ...base, key: "ready", word: "Ready", cav: 400, tgt: 400, mode: "bake", modeLabel: "Convection bake", timer: "25 min (starts when food goes in)", sentence: "Ready — put food in" },
    cooking: { ...base, key: "cooking", word: "Cooking", cav: 401, tgt: 400, mode: "bake", modeLabel: "Convection bake", left: "12:30", leftMin: 12.5, timer: "25 min", timerPct: 0.5, doneAt: "6:42 PM", probe: 128, probeTgt: 145, sentence: "Cooking — 12 min left" },
    cookingProbe: { ...base, key: "cookingProbe", word: "Cooking", cav: 351, tgt: 350, mode: "roast", modeLabel: "Roast", probe: 131, probeTgt: 145, eta: "about 9 min or more", estimating: false, doneAt: "6:51 PM", sentence: "Roasting — food 131 °F of 145 °F" },
    doorOpen: { ...base, key: "doorOpen", word: "Door open", cav: 352, tgt: 400, mode: "bake", modeLabel: "Convection bake", left: "12:30", leftMin: 12.5, timer: "25 min (paused)", timerPct: 0.5, probe: 128, probeTgt: 145, door: "open", sentence: "Door open — heating paused" },
    done: { ...base, key: "done", word: "Done", cav: 371, tgt: null, mode: "bake", modeLabel: "Convection bake", probe: 146, probeTgt: 145, camera: "stopped", frameAge: "2 min ago", doneAgo: "2 min ago", sentence: "Done — take food out" },
    offline: { ...base, key: "offline", word: "Offline", cav: 401, tgt: 400, mode: "bake", modeLabel: "Convection bake", left: "12:30", stale: true, lastUpdate: "3 min ago", camera: "stale", frameAge: "3 min ago", sentence: "Oven not responding" }
  };
  const STATE_ORDER = ["off", "preheat", "ready", "cooking", "cookingProbe", "doorOpen", "done", "offline"];
  // A second oven for multi-oven views: preheating in the garage.
  const GARAGE = { ...S.preheat, oven: "Garage", cav: 280, tgt: 350, pct: 0.6, sentence: "Preheating to 350 °F" };
  // Temperature history for graphs (minutes since start, °F). Door opened 13.4–14.8 min.
  const HISTORY = {
    cav: [[0, 74], [2, 170], [4, 250], [6, 312], [8, 365], [10, 392], [11, 400], [13, 400], [13.6, 352], [14.6, 380], [16, 399], [20, 401], [24, 400], [28, 401], [30, 401]],
    probe: [[12, 45], [15, 62], [18, 84], [21, 101], [24, 113], [27, 122], [30, 128]],
    doors: [[13.4, 14.8]], probeTgt: 145, cavTgt: 400, end: 30
  };
  // The oven's cook modes, in the oven's own order. Glyph = which elements are on (the oven's tile icons).
  const MODES = [
    ["bake", "Bake"], ["roast", "Roast"], ["reheat", "Reheat"], ["broil", "Broil"], ["toast", "Toast"], ["airfry", "Air fry"],
    ["grill", "Grill"], ["proof", "Proof"], ["pizza", "Pizza"], ["dehydrate", "Dehydrate"], ["slowcook", "Slow cook"], ["warm", "Keep warm"]
  ];

  // ---- Camera still (stands in for the oven's camera JPEG, 4:3) ---------------------------------
  let uid = 0;
  function cameraStill(s) {
    const heat = ["preheat", "ready", "cooking", "cookingProbe"].includes(s.key), id = "hxg" + ++uid;
    const food = ["cooking", "cookingProbe", "done", "offline", "doorOpen"].includes(s.key);
    const brown = s.key === "done" ? ["#8a4a1c", "#6d3714"] : ["#c98a4c", "#a86a33"];
    return `<svg class="hx-still" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block;width:100%;height:100%;${s.stale ? "opacity:.45;filter:grayscale(.6)" : ""}"><defs><radialGradient id="${id}" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="${heat ? "#8a3a14" : "#3a2c22"}"/><stop offset=".6" stop-color="#241710"/><stop offset="1" stop-color="#120c09"/></radialGradient></defs><rect width="400" height="300" fill="url(#${id})"/>${[60, 140, 220, 300].map((x) => `<rect x="${x}" y="18" width="60" height="7" rx="3.5" fill="${heat ? "#ffae63" : "#4a3a30"}"/>`).join("")}<path d="M30 214h340" stroke="#5a4a40" stroke-width="3"/><rect x="85" y="186" width="230" height="22" rx="6" fill="#6a5a50"/>${food ? `<ellipse cx="150" cy="182" rx="42" ry="16" fill="${brown[0]}"/><ellipse cx="248" cy="182" rx="46" ry="17" fill="${brown[1]}"/>` : ""}${s.key === "doorOpen" ? '<rect x="0" y="0" width="400" height="300" fill="#fff" opacity=".18"/>' : ""}</svg>`;
  }

  window.HX = { ROW, GAP, cardH, cardW, colW, frame, fitScalers, checkFit, S, STATE_ORDER, GARAGE, HISTORY, MODES, cameraStill };
  window.CONCEPTS = window.CONCEPTS || {};
})();
