/* July Oven card: the "Still Glass" design for the June oven, served by the june_oven integration.
 *
 * One job per oven state, fixed places, nothing that heats on one tap:
 *   top left the oven's name, top right one red Stop exactly as wide as the camera window;
 *   one large number with its status mark under it; the progress bar; two short lines;
 *   +1 / +5 / +10 min only while a timer runs.
 * Idle shows the oven's home screen: a clock and pages of mode tiles. A tile opens a review that
 * must be confirmed within 5 minutes (UL 1026). Settings is the last tile.
 *
 * Plain web component, no build step. Config:
 *   type: custom:july-oven-card
 *   entity: climate.kitchen_oven        # the oven (june_oven climate entity)
 *   icon: kitchen                       # optional: an icon from the set below, or any mdi: icon
 *   entities:                           # optional: several ovens in one card
 *     - climate.garage_oven
 *     - entity: climate.studio_oven
 *       icon: apartment
 *       name: Studio
 *   Icons: oven, kitchen, house, garage, basement, apartment, cabin, patio, office, camper, bread, star
 *   theme: auto | light | dark          # auto follows the Home Assistant theme
 *   display_mode: auto | standard | wall | compact
 *   name: Kitchen                       # optional; defaults to the device or area name
 *   load_fonts: true                    # Barlow fonts from Google Fonts (system fonts if off)
 */
(() => {
  "use strict";
  const VERSION = "0.3.1";
  const DOMAIN = "june_oven";
  const TAG = "july-oven-card";
  if (customElements.get(TAG)) return;

  // Cook primitives the integration can start (const.DEFAULT_MODES), in the oven's order.
  const STARTABLE = [["bake", "Bake"], ["roast", "Roast"], ["broil", "Broil"], ["airfry", "Air fry"], ["toast", "Toast"]];
  const TILES = [...STARTABLE, ["settings", "Settings"]];
  const MODE_LABEL = {
    bake: "Bake", roast: "Roast", broil: "Broil", airfry: "Air fry", toast: "Toast", reheat: "Reheat", warm: "Keep warm",
    slow_cook: "Slow cook", dehydrate: "Dehydrate", proof: "Proof", pizzaiolo: "Pizza", sous_vide: "Sous vide", grill: "Grill"
  };
  const DONE_WINDOW_MS = 30 * 60 * 1000;
  const REVIEW_MS = 5 * 60 * 1000;
  const CAMERA_REFRESH_MS = 2000;
  // Entities of one oven, matched on the device by translation key (entity id suffix as a fallback).
  const KEYS = {
    phase: ["sensor", "cook_phase"], progress: ["sensor", "progress"], remaining: ["sensor", "time_remaining"],
    elapsed: ["sensor", "cook_elapsed"], probe: ["sensor", "probe_temperature"], probeTarget: ["sensor", "probe_target"],
    completed: ["sensor", "last_cook_completed"], connected: ["binary_sensor", "connected"], camera: ["camera", "interior"]
  };
  // Plain words for the oven's refusals (10020 ack statuses carried in the service error).
  const REFUSALS = [
    ["session-start-disabled", "Remote start is off on this oven. Turn it on at the oven: Settings › App permissions."],
    ["door-open", "Close the oven door, then try again."],
    ["cleaning", "The oven is cleaning. Try again when it has finished."],
    ["not-ready", "The oven isn't ready yet. Try again in a moment."],
    ["preheat-warning", "There is food or a probe in the oven. Take it out before preheating."],
    ["No timer is running", "No timer is running on the oven."]
  ];

  // ---- icons (July line style) -----------------------------------------------------------------
  const svg = (vb, body, cls = "") => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
  const ST = {
    off: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/>',
    preheat: '<path d="M10 17V3.8M4.6 9.2 10 3.8l5.4 5.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    cooking: '<g transform="scale(1.25)"><path d="M8.3 1.2c.4 2.6 4.4 4.2 4.4 8.4A4.7 4.7 0 0 1 3.3 9.8c0-2.1 1-3.4 2.1-4.3.1 1.6.9 2.5 1.7 2.7-.5-2.2-.1-4.6 1.2-7z" fill="currentColor"/></g>',
    ready: '<circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.6 10.3l2.3 2.3 4.6-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    done: '<circle cx="10" cy="10" r="8.5" fill="currentColor"/><path d="M6.3 10.3l2.6 2.6 4.9-5.4" fill="none" stroke="var(--knock)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    offline: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3.2 2.4"/><path d="M4.2 15.8 15.8 4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  const I = {
    stop: svg("0 0 16 16", '<rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="currentColor"/>', "d2-ic"),
    check: svg("0 0 24 24", '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>', "d2-ic"),
    camOff: svg("0 0 24 24", '<path d="M3 7.5h3l1.6-2h6.8l1.6 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', "d2-ic"),
    close: svg("0 0 24 24", '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic"),
    minus: svg("0 0 24 24", '<path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic"),
    plus: svg("0 0 24 24", '<path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic")
  };
  // Mode glyphs: the heating elements each mode uses (the oven's own tile language).
  const g = (d) => `<path d="${d}"/>`;
  const GLYPH = {
    bake: g("M10 37h28"), broil: g("M10 11h28"), roast: g("M10 11h28M10 37h28"),
    toast: g("M10 11h7M20.5 11h7M31 11h7M10 37h7M20.5 37h7M31 37h7"),
    airfry: '<circle cx="24" cy="24" r="12.5" class="thin"/>' + [0, 120, 240].map((a) => `<path class="fill" transform="rotate(${a} 24 24)" d="M24 24c-1.5-5.5 1-9.5 5-9.2 2.6.3 2.8 4.4-5 9.2z"/>`).join(""),
    settings: '<circle cx="24" cy="24" r="9" class="thin"/><circle cx="24" cy="24" r="3.5" class="thin"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a} 24 24)" d="M24 11.5v3.5"/>`).join("")
  };
  const glyph = (k) => `<svg class="d2-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${GLYPH[k] || ""}</svg>`;

  // Oven icons: a generic set in the card's line style (24 px grid, 1.75 stroke). Any "mdi:" icon works too.
  const OVEN_ICONS = {
    oven: ["Oven", '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 8.5h17M7 6.3h1.5M11 6.3h1.5"/><rect x="7" y="11.5" width="10" height="5.5" rx="1.2"/>'],
    kitchen: ["Kitchen", '<path d="M5 10.5h14v5.5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M3.5 10.5h17M10 7.5h4M12 7.5V6"/>'],
    house: ["House", '<path d="M4 11.2 12 4.5l8 6.7"/><path d="M6 9.6v9.9h12V9.6"/><path d="M10 19.5v-5h4v5"/>'],
    garage: ["Garage", '<path d="M3.5 10 12 4.5l8.5 5.5v9.5h-17z"/><path d="M7 19.5v-7h10v7M7 15h10M7 17.3h10"/>'],
    basement: ["Basement", '<path d="M3.5 7h4v4h4v4h4v4h5"/><path d="M17 4.5v6M14.8 8.3 17 10.5l2.2-2.2"/>'],
    apartment: ["Apartment", '<rect x="6" y="3.5" width="12" height="17" rx="1.2"/><path d="M9 7h2M13 7h2M9 10.5h2M13 10.5h2M9 14h2M13 14h2M11 20.5v-3h2v3"/>'],
    cabin: ["Cabin", '<path d="M3.5 19.5 12 4l8.5 15.5z"/><path d="M8.2 13h7.6M10.5 19.5v-4h3v4"/>'],
    patio: ["Patio", '<path d="M4 10.5a8 8 0 0 1 16 0z"/><path d="M12 10.5v9.5M8.5 20h7"/>'],
    office: ["Office", '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17"/>'],
    camper: ["Camper", '<path d="M3.5 16.5v-8a2 2 0 0 1 2-2H15l5.5 5.5v4.5z"/><rect x="6.5" y="9" width="4.5" height="3.2" rx=".8"/><circle cx="7.8" cy="17.3" r="1.8"/><circle cx="16.3" cy="17.3" r="1.8"/>'],
    bread: ["Bread", '<path d="M5 11.2A3.8 3.8 0 0 1 7 4.5h10a3.8 3.8 0 0 1 2 6.7v7.3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M10 8.5l-1.5 2.2M14.5 8.5 13 10.7"/>'],
    star: ["Star", '<path d="M12 3.8l2.5 5.1 5.6.8-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z"/>']
  };
  const ICON_OPTIONS = [{ value: "", label: "No icon" }].concat(Object.entries(OVEN_ICONS).map(([value, [label]]) => ({ value, label })));
  function ovenIcon(icon) {
    if (!icon) return "";
    if (String(icon).startsWith("mdi:")) return `<ha-icon class="d2-oic" icon="${esc(icon)}"></ha-icon>`;
    const hit = OVEN_ICONS[icon];
    return hit ? `<svg class="d2-oic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${hit[1]}</svg>` : "";
  }

  // ---- helpers -----------------------------------------------------------------------------------
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (st) => { const v = st ? parseFloat(st.state) : NaN; return Number.isFinite(v) ? v : null; };
  const usable = (st) => st && !["unavailable", "unknown"].includes(st.state);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const deg = (h) => String(h).replace(/°/g, '<span class="d2-deg">°</span>');
  const titleCase = (s) => (s ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "");
  function duration(sec) {
    const s = Math.max(0, Math.round(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
  }
  function ago(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return `${h} h ago`;
  }
  function refusal(err) {
    const text = String((err && (err.message || err.error)) || err || "");
    const hit = REFUSALS.find(([k]) => text.includes(k));
    return hit ? hit[1] : text || "The oven did not accept that.";
  }

  let fontsLoaded = false;
  function loadFonts() {
    if (fontsLoaded || document.querySelector("link[data-july-oven-fonts]")) return;
    fontsLoaded = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.julyOvenFonts = "";
    link.href = "https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@400;500;600&family=Barlow+Condensed:wght@300;400;500&display=swap";
    document.head.appendChild(link);
  }

  // ---- entities and state ------------------------------------------------------------------------
  function ovenEntities(hass, climateId) {
    const out = { climate: climateId };
    const reg = hass.entities || {};
    const deviceId = reg[climateId] && reg[climateId].device_id;
    const siblings = deviceId ? Object.values(reg).filter((e) => e.device_id === deviceId) : [];
    const base = climateId.split(".")[1];
    for (const [key, [domain, tkey]] of Object.entries(KEYS)) {
      const hit = siblings.find((e) => e.entity_id.startsWith(domain + ".") && e.translation_key === tkey) ||
        siblings.find((e) => e.entity_id.startsWith(domain + ".") && e.entity_id.endsWith("_" + tkey)) ||
        (hass.states[`${domain}.${base}_${tkey}`] ? { entity_id: `${domain}.${base}_${tkey}` } : null);
      out[key] = hit ? hit.entity_id : null;
    }
    out.deviceId = deviceId || null;
    return out;
  }

  function ovenName(hass, ids, config) {
    if (config && config.name) return config.name;
    const dev = ids.deviceId && hass.devices && hass.devices[ids.deviceId];
    if (dev && dev.name_by_user) return dev.name_by_user;
    const area = dev && dev.area_id && hass.areas && hass.areas[dev.area_id];
    if (area) return area.name;
    if (dev && dev.name) return dev.name;
    const c = hass.states[ids.climate];
    return (c && c.attributes.friendly_name) || "Oven";
  }

  /** Everything the card shows for one oven, from Home Assistant state. */
  function ovenModel(hass, ids, name, now, dismissed, icon) {
    const st = (id) => (id ? hass.states[id] : undefined);
    const c = st(ids.climate);
    const unit = (hass.config && hass.config.unit_system && hass.config.unit_system.temperature) || "°F";
    const round = (v) => (Number.isFinite(+v) && v !== null ? Math.round(+v) : null);
    const cur = c ? round(c.attributes.current_temperature) : null;
    const tgt = c ? round(c.attributes.temperature) : null;
    const preset = c && c.attributes.preset_mode;
    const modeLabel = MODE_LABEL[preset] || titleCase(preset) || "Oven";
    const phaseSt = st(ids.phase);
    const phase = usable(phaseSt) ? phaseSt.state : c && c.attributes.hvac_action === "heating" ? "cooking" : "idle";
    const conn = st(ids.connected);
    const offline = !c || c.state === "unavailable" || (conn && conn.state === "off");
    const remaining = usable(st(ids.remaining)) ? num(st(ids.remaining)) : null;
    const elapsed = usable(st(ids.elapsed)) ? num(st(ids.elapsed)) : null;
    const progress = usable(st(ids.progress)) ? num(st(ids.progress)) : null;
    const probe = usable(st(ids.probe)) ? round(num(st(ids.probe))) : null;
    const probeTgt = usable(st(ids.probeTarget)) ? round(num(st(ids.probeTarget))) : null;
    const completedSt = st(ids.completed);
    const completed = usable(completedSt) ? Date.parse(completedSt.state) : NaN;
    const lang = (hass.locale && hass.locale.language) || hass.language || undefined;
    const clock = (t) => new Date(t).toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });

    const m = { name, oic: ovenIcon(icon), ids, unit, tgt, cur, modeLabel, chips: false, action: null, heroText: false, stale: false, qual: null, a: "", b: "", camera: "live", frameAge: "LIVE" };
    if (offline) {
      const seen = conn ? Date.parse(conn.last_changed) : c ? Date.parse(c.last_updated) : NaN;
      const since = Number.isFinite(seen) ? ago(now - seen) : "a while ago";
      Object.assign(m, {
        key: "offline", word: "Offline", tone: "stale", icon: "offline", stale: true,
        hero: cur !== null ? `${cur}°` : "—", qual: since, bar: [0.5, "stale"],
        a: "Oven not responding", b: phase !== "idle" ? `Last seen ${phase === "cooking" ? "cooking" : "heating"} · ${modeLabel}` : "Check that the oven is on and connected",
        action: phase !== "idle" ? "stop" : null, camera: "stale", frameAge: since, heating: phase !== "idle"
      });
      return m;
    }
    if (phase === "preheating") {
      const p = progress !== null ? progress / 100 : tgt && cur ? (cur - 75) / Math.max(1, tgt - 75) : 0;
      return Object.assign(m, {
        key: "preheat", word: "Preheating", tone: "heat", icon: "preheat", heating: true,
        hero: cur !== null ? `${cur}°` : "—", bar: [clamp01(p), "preheat"],
        a: tgt !== null ? `Heating to ${tgt} ${unit}` : "Heating", b: modeLabel, action: "stop"
      });
    }
    if (phase === "preheated") {
      return Object.assign(m, {
        key: "ready", word: "Ready", tone: "ok", icon: "ready", heating: true,
        hero: cur !== null ? `${cur}°` : "—", qual: "holding", bar: [1, "heat"],
        a: "Put food in", b: `${modeLabel}${tgt !== null ? ` · ${tgt} ${unit}` : ""}`, action: "stop"
      });
    }
    if (phase === "cooking") {
      Object.assign(m, { key: "cooking", word: "Cooking", tone: "heat", icon: "cooking", heating: true, action: "stop" });
      const facts = `${modeLabel}${tgt !== null ? ` ${tgt} ${unit}` : ""}${probe !== null ? ` · food ${probe}°` : ""}`;
      if (remaining !== null) {
        const total = remaining + (elapsed || 0);
        return Object.assign(m, {
          hero: duration(remaining), qual: "left", bar: [total > 0 ? clamp01((elapsed || 0) / total) : 0, "heat"],
          a: `Done at ${clock(now + remaining * 1000)}`, b: facts, chips: true
        });
      }
      if (probe !== null && probeTgt !== null) {
        return Object.assign(m, {
          hero: `${probe}°`, qual: `food · target ${probeTgt}°`,
          bar: [progress !== null ? progress / 100 : clamp01(probe / Math.max(1, probeTgt)), "heat"],
          a: `${modeLabel}${tgt !== null ? ` at ${tgt} ${unit}` : ""}`, b: elapsed !== null ? `Cooking for ${Math.round(elapsed / 60)} min` : ""
        });
      }
      return Object.assign(m, {
        hero: cur !== null ? `${cur}°` : "—", qual: "oven", bar: [progress !== null ? progress / 100 : 1, "heat"],
        a: facts, b: elapsed !== null ? `Cooking for ${Math.round(elapsed / 60)} min` : ""
      });
    }
    // Idle: done if the last cook finished recently and nobody dismissed it.
    if (Number.isFinite(completed) && now - completed < DONE_WINDOW_MS && dismissed !== completed) {
      const since = ago(now - completed);
      return Object.assign(m, {
        key: "done", word: "Done", tone: "ok", icon: "done", heroText: true, hero: "Take food out", bar: [1, "done"],
        a: `Done ${since}`, b: probe !== null ? `Food ${probe} ${unit} · ${modeLabel}` : modeLabel,
        action: "dismiss", camera: "still", frameAge: since, completed
      });
    }
    return Object.assign(m, { key: "off", word: "Off", tone: "rest", icon: "off", hero: null, camera: "off", frameAge: null, heating: false });
  }

  // ---- markup --------------------------------------------------------------------------------------
  const status = (m, cls = "") => `<span class="d2-st t-${m.tone} ${cls}">${svg("0 0 20 20", ST[m.icon], "d2-sti")}<b>${m.word}</b></span>`;
  const bar = (m) => `<div class="d2-bar k-${m.bar[1]}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(m.bar[0] * 100)}" style="--p:${Math.max(0.001, m.bar[0]).toFixed(3)}"><i></i></div>`;

  function cam(m, o = {}) {
    if (m.camera === "off") {
      return `<button class="d2-cam is-off" data-act="camera" data-oven="${esc(m.ids.climate)}" aria-label="Camera off. It runs while the oven cooks">${I.camOff}${o.compact ? "" : "<span>Camera off</span>"}</button>`;
    }
    const live = m.camera === "live";
    const label = live ? "LIVE" : o.compact ? String(m.frameAge).replace(/ ago$/, "") : m.frameAge;
    return `<button class="d2-cam${m.stale ? " is-stale" : ""}" data-act="camera" data-oven="${esc(m.ids.climate)}" aria-label="Oven camera, ${live ? "live" : "picture from " + esc(m.frameAge)}. Open larger view"><span class="d2-win" data-cam="${esc(m.ids.camera || "")}"></span><span class="d2-pill${live ? "" : " is-old"}">${esc(label)}</span></button>`;
  }
  const chips = (m) => `<div class="d2-chips" role="group" aria-label="Add time to the ${esc(m.name)} timer">${[1, 5, 10].map((n) => `<button class="d2-chip" data-act="add" data-min="${n}" data-oven="${esc(m.ids.climate)}" aria-label="Add ${n} minute${n > 1 ? "s" : ""} to ${esc(m.name)}">+${n}</button>`).join("")}<span class="d2-min" aria-hidden="true">min</span></div>`;

  function action(m, o = {}, busy) {
    if (!m.action) return "";
    if (m.action === "dismiss" && o.compact) {
      return `<button class="d2-ghost d2-dismiss is-icon" data-act="dismiss" data-oven="${esc(m.ids.climate)}" data-completed="${m.completed}" aria-label="Dismiss: food is out of the ${esc(m.name)} oven">${I.check}</button>`;
    }
    if (m.action === "dismiss") {
      return `<button class="d2-ghost d2-dismiss" data-act="dismiss" data-oven="${esc(m.ids.climate)}" data-completed="${m.completed}" aria-label="Dismiss: food is out of the ${esc(m.name)} oven">${I.check}<span>Food is out</span></button>`;
    }
    const word = busy ? "Stopping…" : "Stop";
    const label = o.multi ? `<span class="d2-two">${word}<small>${esc(m.name)}</small></span>` : `<span>${word}</span>`;
    return `<button class="d2-stop" data-act="stop" data-oven="${esc(m.ids.climate)}" aria-label="Stop the ${esc(m.name)} oven"${busy ? " disabled" : ""}>${I.stop}${label}</button>`;
  }

  // Two rows of tiles, as on the oven. Six tiles fit one page: 3 × 2 on a standard card, one row on a wall.
  function idle(m, clock, date, page, size) {
    const cols = size === "wall" ? Math.min(7, TILES.length) : TILES.length <= 6 ? 3 : 4;
    const rows = Math.min(2, Math.ceil(TILES.length / cols));
    const pages = [];
    for (let i = 0; i < TILES.length; i += cols * rows) pages.push(TILES.slice(i, i + cols * rows));
    const n = pages.length;
    const tile = ([k, label]) => {
      const util = k === "settings";
      return `<button class="d2-tile${util ? " is-util" : ""}" data-act="${util ? "settings" : "tile"}" data-mode="${k}" data-oven="${esc(m.ids.climate)}" aria-label="${util ? `Settings for ${esc(m.name)}` : `${label}: review and start`}"><span class="d2-face">${glyph(k)}</span><span class="d2-lab">${label}</span></button>`;
    };
    return `<div class="d2-idle${n > 1 ? "" : " no-dots"}">
      <div class="d2-top">
        <div class="d2-id"><div class="d2-name" data-act="more" data-oven="${esc(m.ids.climate)}">${m.oic}${esc(m.name)}</div>${status(m)}</div>
        <div class="d2-clock" role="timer" aria-label="Time ${clock}, ${date}"><div class="d2-time">${clock}</div><div class="d2-date">${date}</div></div>
        <div class="d2-camslot">${cam(m)}</div>
      </div>
      <div class="d2-pager" aria-label="Cook modes${n > 1 ? `, ${n} pages` : ""}">${pages.map((p, i) => `<div class="d2-page" style="--cols:${cols};--rows:${rows}" role="group" aria-label="Page ${i + 1} of ${n}">${p.map(tile).join("")}</div>`).join("")}</div>
      ${n > 1 ? `<div class="d2-dots">${pages.map((_, i) => `<button class="d2-dot" data-act="page" data-i="${i}" aria-label="Show page ${i + 1} of ${n}"${i === page ? ' aria-current="true"' : ""}><i></i></button>`).join("")}</div>` : ""}
    </div>`;
  }

  function run(m, o, busy) {
    const cls = m.heroText ? " is-texthero" : String(m.hero).includes("°") ? " has-deg" : "";
    return `<div class="d2-run${cls}">
      <div class="d2-name d2-title" data-act="more" data-oven="${esc(m.ids.climate)}">${m.oic}${esc(m.name)}</div>
      <div class="d2-foot">${action(m, o, busy)}</div>
      <div class="d2-up" data-act="more" data-oven="${esc(m.ids.climate)}">
        <div class="d2-hero${m.heroText ? " is-text" : ""}${m.stale ? " is-stale" : ""}">${deg(esc(m.hero))}</div>
        <div class="d2-sline">${status(m)}${m.qual ? `<span class="d2-q">· ${esc(m.qual)}</span>` : ""}</div>
      </div>
      <div class="d2-barrow">${bar(m)}</div>
      <div class="d2-low">
        <div class="d2-a">${esc(m.a)}</div>
        <div class="d2-b">${esc(m.b)}</div>
      </div>
      ${m.chips ? `<div class="d2-quick">${chips(m)}</div>` : ""}
      <div class="d2-camcol">${cam(m)}</div>
    </div>`;
  }

  function compact(m, o = {}, busy) {
    const hero = m.key === "off" ? (m.cur !== null ? `${m.cur}°` : "Off") : m.hero;
    const line1 = o.multi ? `<div class="d2-m1 d2-cname">${m.oic}${esc(m.name)}</div>` : `<div class="d2-m1">${status(m)}</div>`;
    const line2 = o.multi ? `<div class="d2-m2">${status(m, "is-small")}</div>` : `<div class="d2-m2">${esc(m.key === "off" ? m.name : m.a)}</div>`;
    let act = action(m, { ...o, compact: true }, busy);
    if (!act && m.key === "off") act = `<button class="d2-ghost" data-act="more" data-oven="${esc(m.ids.climate)}" aria-label="Choose a cook mode for ${esc(m.name)}">Start…</button>`;
    return `<div class="d2-crow">
      <div class="d2-ccam">${cam(m, { compact: true })}</div>
      <div class="d2-chero${m.heroText ? " is-text" : ""}${m.stale ? " is-stale" : ""}">${deg(esc(hero))}</div>
      <div class="d2-meta">${line1}${line2}</div>
      ${act}
    </div>`;
  }

  function review(r, name, unit, now, multi) {
    const left = Math.max(0, r.until - now);
    return `<div class="d2-sheet" role="dialog" aria-modal="true" aria-label="Review before starting">
      <div class="d2-sh-head"><div><div class="d2-sh-t">${esc(MODE_LABEL[r.mode])} · ${esc(name)}</div><div class="d2-sh-s">Step 2 of 2 · Review</div></div>
        <button class="d2-icbtn" data-act="rv-cancel" aria-label="Cancel">${I.close}</button></div>
      <div class="d2-sh-row"><span class="d2-face d2-sh-face">${glyph(r.mode)}</span>
        <div class="d2-sh-temp"><button class="d2-round" data-act="rv-dec" aria-label="Lower the temperature">${I.minus}</button>
          <div class="d2-sh-v"><b>${r.temp}</b> ${esc(unit)}</div>
          <button class="d2-round" data-act="rv-inc" aria-label="Raise the temperature">${I.plus}</button></div></div>
      <div class="d2-sh-note">Make sure the oven is empty and the door is closed. Nothing heats until you press Start. This closes in <b>${duration(left / 1000)}</b>.</div>
      <div class="d2-sh-acts"><button class="d2-ghost" data-act="rv-cancel">Not now</button>
        <button class="d2-go" data-act="rv-start"${r.busy ? " disabled" : ""}>${r.busy ? "Starting…" : multi ? `Start preheating ${esc(name)}` : "Start preheating"}</button></div>
    </div>`;
  }

  // ---- the card ------------------------------------------------------------------------------------
  class JulyOvenCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      // The stylesheet is attached once, so :host sizing applies before the first measurement.
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="jo-root"></div>`;
      this._root = this.shadowRoot.querySelector(".jo-root");
      this._busy = {};
      this._dismissed = {};
      this._page = 0;
      this._review = null;
      this._size = "standard";
      this._imgs = {};
      this._html = "";
    }

    static getStubConfig(hass) {
      const hit = Object.values((hass && hass.entities) || {}).find((e) => e.platform === DOMAIN && e.entity_id.startsWith("climate."));
      return { entity: hit ? hit.entity_id : "", theme: "auto" };
    }

    static getConfigForm() {
      const filter = { integration: DOMAIN, domain: "climate" };
      const icon = { select: { mode: "dropdown", custom_value: true, options: ICON_OPTIONS } };
      const labels = {
        entity: "Oven", icon: "Icon", name: "Name (optional)", theme: "Appearance", display_mode: "Size", load_fonts: "Load the Barlow fonts",
        entity_2: "Second oven", icon_2: "Second oven's icon", entity_3: "Third oven", icon_3: "Third oven's icon", entity_4: "Fourth oven", icon_4: "Fourth oven's icon"
      };
      const helpers = {
        icon: "Shown next to the oven's name. Pick one, or type any mdi: icon.",
        theme: "Match Home Assistant follows your theme. Dark is the oven's own glass.",
        display_mode: "Automatic picks the layout from the card's size on the dashboard.",
        load_fonts: "From Google Fonts. Turn off to use your system's fonts."
      };
      return {
        schema: [
          { name: "entity", required: true, selector: { entity: { filter } } },
          { type: "grid", name: "", schema: [{ name: "icon", selector: icon }, { name: "name", selector: { text: {} } }] },
          {
            type: "expandable", name: "", flatten: true, title: "More ovens", icon: "mdi:stove",
            schema: [2, 3, 4].map((n) => ({ type: "grid", name: "", schema: [{ name: `entity_${n}`, selector: { entity: { filter } } }, { name: `icon_${n}`, selector: icon }] }))
          },
          { name: "theme", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: "Match Home Assistant" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark (the oven's glass)" }] } } },
          { name: "display_mode", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: "Automatic" }, { value: "standard", label: "Standard" }, { value: "wall", label: "Wall tablet" }, { value: "compact", label: "Compact (one row)" }] } } },
          { name: "load_fonts", selector: { boolean: {} } }
        ],
        computeLabel: (s) => labels[s.name] || s.name,
        computeHelper: (s) => helpers[s.name]
      };
    }

    setConfig(config) {
      if (!config || (!config.entity && !(config.entities && config.entities.length))) throw new Error("Choose an oven (a june_oven climate entity).");
      // Ovens: `entity` (+ `icon`, `name`), then `entities` (ids or {entity, icon, name}), then the editor's entity_2..4.
      const ovens = [];
      const add = (o) => { if (o && o.entity && !ovens.some((x) => x.entity === o.entity)) ovens.push(o); };
      add({ entity: config.entity, icon: config.icon, name: config.name });
      for (const item of config.entities || []) add(typeof item === "string" ? { entity: item } : item);
      for (const n of [2, 3, 4]) add({ entity: config[`entity_${n}`], icon: config[`icon_${n}`], name: config[`name_${n}`] });
      for (const o of ovens) if (!String(o.entity).startsWith("climate.")) throw new Error(`${o.entity} is not a climate entity. Choose the oven itself.`);
      this._config = { theme: "auto", display_mode: "auto", load_fonts: true, ...config };
      this._ovenConf = ovens;
      this._ovens = ovens.map((o) => o.entity);
      // The oven last picked in this card is remembered in this browser.
      this._focusKey = `july-oven-card:focus:${this._ovens.join(",")}`;
      try { this._focus = localStorage.getItem(this._focusKey) || undefined; } catch (e) { this._focus = undefined; }
      if (this._config.load_fonts !== false) loadFonts();
      this._html = "";
      this._render();
    }

    getCardSize() {
      return this._config && this._config.display_mode === "compact" ? 1 : 6 + Math.max(0, (this._ovens || []).length - 1);
    }

    getGridOptions() {
      const mode = this._config && this._config.display_mode;
      if (mode === "compact") return { columns: 12, rows: 1, min_columns: 6, min_rows: 1, max_rows: 1 };
      const extra = Math.max(0, (this._ovens || []).length - 1);
      if (mode === "wall") return { columns: "full", rows: 8 + extra, min_columns: 12, min_rows: 6 };
      return { columns: 12, rows: 6 + extra, min_columns: 6, min_rows: 1 };
    }

    // Home Assistant sets layout = "grid" for cards in a sections view (their box is fixed).
    set layout(value) {
      this._layout = value;
      this._html = "";
      this._render();
    }

    get layout() {
      return this._layout;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._measured) this._measure();
      this._render();
    }

    connectedCallback() {
      this._ro = new ResizeObserver(() => this._measure());
      this._ro.observe(this);
      this._tick = setInterval(() => this._render(), 15000);
      this._camTimer = setInterval(() => this._refreshCameras(), CAMERA_REFRESH_MS);
      this.shadowRoot.addEventListener("click", this._onClick = (e) => this._handleClick(e));
      // Resize observers pause in background tabs; measure now as well.
      this._measure();
      setTimeout(() => this._measure(), 0);
      this._render();
    }

    disconnectedCallback() {
      if (this._ro) this._ro.disconnect();
      clearInterval(this._tick);
      clearInterval(this._camTimer);
      clearTimeout(this._reviewTimer);
      if (this._onClick) this.shadowRoot.removeEventListener("click", this._onClick);
    }

    _measure() {
      if (!this.isConnected) return;
      this._measured = true;
      const r = this.getBoundingClientRect();
      const mode = this._config && this._config.display_mode;
      let size = mode && mode !== "auto" ? mode : "standard";
      // No height from the parent (masonry view, editor preview): give the card its own, and keep it.
      if (this._layout !== "grid" && r.height < 24 && !this._autoHeight) this._autoHeight = true;
      this._collapsed = !!this._autoHeight && this._layout !== "grid";
      if (!mode || mode === "auto") {
        if (!this._collapsed && r.height < 120) size = "compact";
        else if (r.width >= 700 && (this._collapsed || r.height >= 440)) size = "wall";
      }
      if (size !== this._size || this._collapsedWas !== this._collapsed) {
        this._size = size;
        this._collapsedWas = this._collapsed;
        this._html = "";
        this._render();
      }
    }

    // Several ovens: the focused oven is the one the user picked, else the first that is heating.
    _focusIndex(models) {
      const picked = models.findIndex((m) => m.ids.climate === this._focus);
      if (picked >= 0) return picked;
      const heating = models.findIndex((m) => m.heating);
      return heating >= 0 ? heating : 0;
    }

    _render() {
      if (!this._config || !this._hass || !this.isConnected) return;
      const hass = this._hass, now = Date.now();
      const lang = (hass.locale && hass.locale.language) || hass.language || undefined;
      const models = this._ovenConf.map((o) => {
        const ids = ovenEntities(hass, o.entity);
        return ovenModel(hass, ids, ovenName(hass, ids, o), now, this._dismissed[o.entity], o.icon);
      });
      for (const m of models) if (this._busy[m.ids.climate] && !m.heating) delete this._busy[m.ids.climate];
      const f = this._focusIndex(models);
      const focus = models[f];
      const multi = models.length > 1;
      const theme = ["light", "dark"].includes(this._config.theme) ? this._config.theme : "auto";
      const size = this._size;
      // The oven's clock shows the time without AM/PM.
      const clock = new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit" }).formatToParts(new Date(now))
        .filter((part) => part.type !== "dayPeriod").map((part) => part.value).join("").trim();
      const date = new Date(now).toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" });

      let body;
      if (size === "compact") body = compact(focus, { multi: false }, this._busy[focus.ids.climate]);
      else body = focus.key === "off" ? idle(focus, clock, date, this._page, size) : run(focus, { size, multi }, this._busy[focus.ids.climate]);
      const sheet = this._review && this._review.oven === focus.ids.climate && size !== "compact" ? review(this._review, focus.name, focus.unit, now, multi) : "";

      let rows = "";
      if (multi && size !== "compact") {
        const others = models.filter((_, i) => i !== f);
        const loud = others.filter((m) => m.heating || m.key === "done");
        const quiet = others.filter((m) => !(m.heating || m.key === "done"));
        rows = loud.map((m) => `<div class="d2-other" data-act="focus" data-oven="${esc(m.ids.climate)}" role="button" tabindex="0" aria-label="Show ${esc(m.name)}">${compact(m, { multi: true }, this._busy[m.ids.climate])}</div>`).join("") +
          (quiet.length ? `<div class="d2-other is-quiet" role="group" aria-label="Ovens that are off">${quiet.map((m) => `<button class="d2-quiet" data-act="focus" data-oven="${esc(m.ids.climate)}" aria-label="Show ${esc(m.name)}, off">${m.oic || svg("0 0 20 20", ST.off, "d2-sti")}<span class="d2-qn">${esc(m.name)}</span><span class="d2-qs">Off</span></button>`).join("")}</div>` : "");
      }
      const autoH = this._collapsed ? ` style="height:${size === "compact" ? 56 : size === "wall" ? 504 : 376 + (multi ? 64 * (models.length - 1) : 0)}px"` : "";
      const html = `<ha-card${autoH}><div class="c-d2 d2-${theme} d2-${size}${focus.key === "off" ? " is-rest" : ""}${multi ? " d2-multi" : ""}"><div class="d2-pane">${body}${sheet}</div>${rows}</div></ha-card>`;
      if (html === this._html) return;
      const pager = this.shadowRoot.querySelector(".d2-pager");
      const scroll = pager ? pager.scrollLeft : 0;
      this._html = html;
      this._root.innerHTML = html;
      const newPager = this.shadowRoot.querySelector(".d2-pager");
      if (newPager) {
        newPager.scrollLeft = scroll || this._page * newPager.clientWidth;
        newPager.addEventListener("scroll", () => {
          const i = Math.round(newPager.scrollLeft / Math.max(1, newPager.clientWidth));
          if (i !== this._page) { this._page = i; this.shadowRoot.querySelectorAll(".d2-dot").forEach((d, j) => (j === i ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current"))); }
        }, { passive: true });
      }
      this._placeCameras(models);
    }

    // Camera stills: one <img> per camera, moved into place after each render so nothing flickers.
    _placeCameras(models) {
      for (const slot of this.shadowRoot.querySelectorAll(".d2-win[data-cam]")) {
        const id = slot.dataset.cam;
        if (!id) continue;
        let img = this._imgs[id];
        if (!img) {
          img = document.createElement("img");
          img.alt = "";
          img.decoding = "async";
          this._imgs[id] = img;
          this._loadStill(id, true);
        }
        slot.appendChild(img);
      }
      this._liveCams = new Set(models.filter((m) => m.camera === "live" && m.ids.camera).map((m) => m.ids.camera));
    }

    _loadStill(id, force) {
      const st = this._hass && this._hass.states[id];
      const img = this._imgs[id];
      if (!st || !img || !st.attributes.entity_picture) return;
      const base = st.attributes.entity_picture;
      if (!force && img.dataset.base === base && !(this._liveCams && this._liveCams.has(id))) return;
      const next = new Image();
      next.onload = () => { img.src = next.src; img.dataset.base = base; };
      next.src = `${base}${base.includes("?") ? "&" : "?"}_t=${Date.now()}`;
    }

    _refreshCameras() {
      if (document.hidden || !this._liveCams) return;
      for (const id of Object.keys(this._imgs)) this._loadStill(id, false);
    }

    _handleClick(e) {
      const el = e.target.closest("[data-act]");
      if (!el || el.disabled) return;
      const act = el.dataset.act, oven = el.dataset.oven;
      const hass = this._hass;
      if (act === "stop") return this._stop(oven);
      if (act === "add") return this._call("june_oven", "add_cook_time", { minutes: +el.dataset.min }, oven, `Added ${el.dataset.min} min`);
      if (act === "dismiss") { this._dismissed[oven] = +el.dataset.completed; this._html = ""; return this._render(); }
      if (act === "focus") {
        this._focus = oven;
        try { localStorage.setItem(this._focusKey, oven); } catch (e) { /* private window: not remembered */ }
        this._html = "";
        return this._render();
      }
      if (act === "more") return this._moreInfo(oven);
      if (act === "camera") { const ids = ovenEntities(hass, oven); return this._moreInfo(ids.camera || oven); }
      if (act === "page") {
        const pager = this.shadowRoot.querySelector(".d2-pager");
        this._page = +el.dataset.i;
        if (pager) pager.scrollLeft = this._page * pager.clientWidth;
        this.shadowRoot.querySelectorAll(".d2-dot").forEach((d, j) => (j === this._page ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
        return;
      }
      if (act === "settings") {
        const ids = ovenEntities(hass, oven);
        if (!ids.deviceId) return this._moreInfo(oven);
        history.pushState(null, "", `/config/devices/device/${ids.deviceId}`);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
        return;
      }
      if (act === "tile") return this._openReview(oven, el.dataset.mode);
      if (act === "rv-cancel") return this._closeReview();
      if (act === "rv-dec" || act === "rv-inc") return this._stepReview(act === "rv-inc" ? 1 : -1);
      if (act === "rv-start") return this._start();
    }

    _moreInfo(entityId) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
    }

    _toast(message) {
      this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true }));
    }

    async _call(domain, service, data, oven, done) {
      try {
        await this._hass.callService(domain, service, data, { entity_id: oven });
        if (done) this._toast(done);
        return true;
      } catch (err) {
        this._toast(refusal(err));
        return false;
      }
    }

    async _stop(oven) {
      this._busy[oven] = true;
      this._html = "";
      this._render();
      const ok = await this._call("climate", "turn_off", {}, oven);
      // Keep "Stopping…" until the oven reports it has stopped, at most 10 s.
      setTimeout(() => { delete this._busy[oven]; this._html = ""; this._render(); }, ok ? 10000 : 0);
    }

    _openReview(oven, mode) {
      const c = this._hass.states[oven];
      const step = (c && c.attributes.target_temp_step) || 5;
      const def = c && Number.isFinite(+c.attributes.temperature) ? Math.round(+c.attributes.temperature / step) * step : 350;
      this._review = { oven, mode, temp: def, step, min: (c && c.attributes.min_temp) || 100, max: (c && c.attributes.max_temp) || 500, until: Date.now() + REVIEW_MS };
      clearTimeout(this._reviewTimer);
      const tick = () => {
        if (!this._review) return;
        if (Date.now() >= this._review.until) return this._closeReview();
        this._html = "";
        this._render();
        this._reviewTimer = setTimeout(tick, 1000);
      };
      tick();
    }

    _stepReview(dir) {
      const r = this._review;
      if (!r) return;
      r.temp = Math.max(r.min, Math.min(r.max, r.temp + dir * r.step));
      this._html = "";
      this._render();
    }

    _closeReview() {
      this._review = null;
      clearTimeout(this._reviewTimer);
      this._html = "";
      this._render();
    }

    async _start() {
      const r = this._review;
      if (!r || r.busy) return;
      r.busy = true;
      this._html = "";
      this._render();
      const c = this._hass.states[r.oven];
      const steps = [];
      if (!c || c.attributes.preset_mode !== r.mode) steps.push(["set_preset_mode", { preset_mode: r.mode }]);
      steps.push(["set_temperature", { temperature: r.temp }], ["turn_on", {}]);
      for (const [service, data] of steps) {
        if (!(await this._call("climate", service, data, r.oven))) { r.busy = false; this._html = ""; this._render(); return; }
      }
      this._toast(`Preheating to ${r.temp}°`);
      this._closeReview();
    }
  }

  const CSS = `.c-d2{--f:'Barlow Semi Condensed','Barlow',system-ui,sans-serif;--fn:'Barlow Condensed','Barlow',system-ui,sans-serif;position:relative;width:100%;height:100%;box-sizing:border-box;overflow:hidden;font-family:var(--f);color:var(--fg);border-radius:var(--ha-card-border-radius,12px);
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
@media (prefers-reduced-motion:reduce){.c-d2 *{transition:none!important;animation:none!important}}
@media (forced-colors:active){.c-d2 .d2-bar i{background:CanvasText}.c-d2 .d2-stop{border:2px solid ButtonText}}

/* ---- In Home Assistant ---- */
:host{display:block;height:100%}
.jo-root{height:100%}
@container (max-width:340px){.c-d2.d2-standard .d2-idle .d2-name{font-size:18px;line-height:24px}}
ha-card{height:100%;overflow:hidden;background:none;border:none;box-shadow:none;border-radius:var(--ha-card-border-radius,12px);padding:0}
.c-d2 .d2-win img{display:block;width:100%;height:100%;object-fit:contain}
.c-d2 [data-act="more"]{cursor:pointer}
.c-d2 .d2-other[data-act]{cursor:pointer}
.c-d2 .d2-stop[disabled]{opacity:.75;cursor:progress}
.c-d2 .d2-dismiss{width:100%;min-width:0;gap:8px}
.c-d2 .d2-dismiss .d2-ic{width:18px;height:18px;color:var(--green)}
.c-d2 .d2-dismiss.is-icon{width:48px;padding:0}
/* Oven icons next to names */
.c-d2 .d2-oic{display:inline-block;width:1.05em;height:1.05em;margin-right:.35em;vertical-align:-.16em;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;color:var(--fg2);--mdc-icon-size:1.05em}
.c-d2 .d2-quiet .d2-oic{width:18px;height:18px;margin:0;vertical-align:0;flex:none;--mdc-icon-size:18px}
.c-d2.d2-wall .d2-dismiss{height:64px;border-radius:16px;font-size:22px}
.c-d2.d2-wall .d2-dismiss .d2-ic{width:24px;height:24px}
.c-d2 .d2-icbtn{width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:50%;flex:none}
.c-d2 .d2-icbtn .d2-ic{width:22px;height:22px}
.c-d2 .d2-round{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px var(--chipb);flex:none}
.c-d2 .d2-round .d2-ic{width:20px;height:20px}
/* ---- Review before starting (step 2 of 2) ---- */
.c-d2 .d2-sheet{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;gap:10px;padding:var(--py) var(--px);background:var(--dlg);border-radius:inherit}
.c-d2 .d2-sh-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.c-d2 .d2-sh-t{font:600 20px/26px var(--f);color:var(--fg)}
.c-d2 .d2-sh-s{font:500 12px/16px var(--f);letter-spacing:.06em;text-transform:uppercase;color:var(--fg2)}
.c-d2 .d2-sh-row{display:flex;align-items:center;gap:16px}
.c-d2 .d2-sh-face{--tile:64px;flex:none}
.c-d2 .d2-sh-temp{flex:1;display:flex;align-items:center;justify-content:center;gap:14px}
.c-d2 .d2-sh-v{font:400 16px/1 var(--f);color:var(--fg2);white-space:nowrap}
.c-d2 .d2-sh-v b{font-family:var(--fn);font-weight:300;font-size:46px;color:var(--fg);font-variant-numeric:tabular-nums}
.c-d2 .d2-sh-note{font:400 14px/19px var(--f);color:var(--fg2)}
.c-d2 .d2-sh-acts{display:flex;gap:10px;margin-top:auto}
.c-d2 .d2-go{flex:1;height:52px;border-radius:14px;background:linear-gradient(90deg,#f6a53a,#ea5a17);color:#1a0a02;font:600 17px/1 var(--f)}
.c-d2 .d2-go[disabled]{opacity:.7;cursor:progress}
.c-d2.d2-wall .d2-sh-t{font-size:28px;line-height:34px}
.c-d2.d2-wall .d2-sh-note{font-size:19px;line-height:26px}
.c-d2.d2-wall .d2-sh-v b{font-size:72px}
.c-d2.d2-wall .d2-go{height:64px;font-size:22px}
`;

  // Some dashboards load a scoped custom-element registry polyfill (in browsers without native support,
  // such as Firefox) that replaces window.customElements after this file has run. A definition made on the
  // old registry is then invisible to Home Assistant ("Custom element doesn't exist"). Keep checking, and
  // register again on whatever registry the page uses now. Each check is one Map lookup.
  function ensureDefined() {
    try {
      if (!customElements.get(TAG)) customElements.define(TAG, JulyOvenCard);
    } catch (err) {
      /* defined meanwhile */
    }
  }
  ensureDefined();
  setInterval(ensureDefined, 2000);
  window.addEventListener("location-changed", ensureDefined);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: TAG,
    name: "July Oven",
    description: "The June oven's glass screen for your dashboard: status, camera, Stop, and a reviewed start.",
    preview: false,
    documentationURL: "https://github.com/Terablo/ha-june-oven"
  });
  console.info(`%c JULY-OVEN-CARD %c ${VERSION} `, "color:#fff;background:#c62828;font-weight:700", "color:#c62828");
})();
