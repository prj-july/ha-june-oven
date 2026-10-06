/* July Oven card: the "Still Glass" design for the June oven, served by the june_oven integration.
 *
 * One job per oven state, fixed places, nothing that heats on one tap:
 *   top left the oven's icon and name, top right one red Stop exactly as wide as the camera window;
 *   one large number with its status mark under it; the progress bar; two short lines;
 *   +1 / +5 / +10 min only while a timer runs.
 * The oven's icon is its lamp: orange while it heats, white (the text colour) while it is off. The
 * name tucks into the icon 5 s after the home screen (the mode tiles) appears and comes back on
 * hover; during a cook it always shows. The icon opens a menu of every June oven in Home Assistant.
 * Idle shows the oven's home screen: a clock and pages of mode tiles. A tile opens a review that
 * must be confirmed within 5 minutes (UL 1026). Camera, History and Settings are the last tiles; all
 * open in the card: a floating camera window, the cook history the integration keeps, and settings
 * saved in this browser.
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
 *   theme: dark | light | auto          # dark (default) is the oven's glass; auto follows the Home Assistant theme
 *   display_mode: auto | standard | wall | compact
 *   name: Kitchen                       # optional; defaults to the device or area name
 *   load_fonts: true                    # Barlow fonts from Google Fonts (system fonts if off)
 *   camera_fps: 15                      # camera window pictures per second (1, 5, 10 or 15; 1 is the stock June app)
 *   hide_name: true                     # tuck the name into the icon after 5 s
 *   clock: auto | 12 | 24               # the idle clock
 *   mode_order: oven | used             # cook mode tiles in the oven's order, or most used first
 *   columns: auto                       # cook mode columns on the home screen (auto or 1-7)
 *   rows: auto                          # cook mode rows (auto or 1-3); the rest go on more pages
 *   scale: 100                          # card size in percent (80-150): text, buttons and spacing
 *   icon_size: large                    # cook mode tiles: small, medium, large or fill
 *   probe: sensor.probe_core_temperature  # optional: another thermometer's sensor for food temperature
 *                                       # (e.g. a Combustion probe's Core Temperature) instead of the June probe
 *                                       # (food_sensor: is the same, for every oven in the card)
 *   food_target: 145                    # optional: that thermometer's target, in the card's unit
 *   food_auto_stop: false               # turn the oven off when the food reaches food_target (card must be open)
 * theme, camera_fps, hide_name, clock, mode_order, food_target, food_auto_stop and each oven's icon and food probe can also be changed in the card's own
 * Settings; those choices are kept in this browser and the config above is the starting point.
 */
(() => {
  "use strict";
  const VERSION = "0.5.11";
  const DOMAIN = "june_oven";
  const TAG = "july-oven-card";
  if (customElements.get(TAG)) return;

  // Cook primitives the integration can start (const.DEFAULT_MODES), in the oven's order.
  const STARTABLE = [["bake", "Bake"], ["roast", "Roast"], ["broil", "Broil"], ["airfry", "Air fry"], ["toast", "Toast"], ["grill", "Grill"], ["pizzaiolo", "Pizza"], ["reheat", "Reheat"], ["proof", "Proof"], ["warm", "Keep warm"], ["dehydrate", "Dehydrate"]];
  const TILES = [...STARTABLE, ["camera", "Camera"], ["history", "History"], ["settings", "Settings"]];
  const UTIL = ["camera", "history", "settings"];
  const ORDERS = [["oven", "Oven's order"], ["used", "Most used first"]];
  const ICON_SIZES = [["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["fill", "Fill"]];
  const ICON_SCALE = { small: 0.7, medium: 0.85, large: 1, fill: 100 };
  const MAX_COLS = 7, MAX_ROWS = 3;

  // The cook mode grid: automatic (by layout and number of tiles) unless columns or rows are set.
  function gridFor(size, n, wantCols, wantRows) {
    const cols = wantCols || (size === "wall" ? Math.min(7, n) : n <= 6 ? 3 : 4);
    const rows = wantRows || Math.min(2, Math.ceil(n / cols));
    return { cols, rows };
  }
  const USES_KEY = "july-oven-card:uses";
  const MODE_LABEL = {
    bake: "Bake", roast: "Roast", broil: "Broil", airfry: "Air fry", toast: "Toast", reheat: "Reheat", warm: "Keep warm",
    slow_cook: "Slow cook", dehydrate: "Dehydrate", proof: "Proof", pizzaiolo: "Pizza", sous_vide: "Sous vide", grill: "Grill"
  };
  // Modes whose cavity temperature is fixed by the oven plan (const.py
  // FIXED_MODE_TEMPS_F); the review shows the value instead of a slider.
  const FIXED_TEMPS = { broil: 500, toast: 500, reheat: 350, warm: 170, pizzaiolo: 500 };
  const FIXED_LABEL = { reheat: "Timed" };
  const GRILL_TEMP = { 0: 450, 1: 400, 2: 275 };
  const GRILL_LABEL = { 0: "High", 1: "Medium", 2: "Low" };
  // Modes with a user temperature on a per-mode range (°F).
  const MODE_TEMP = { proof: { min: 80, max: 110, def: 85 }, dehydrate: { min: 100, max: 160, def: 135 } };
  const DONE_WINDOW_MS = 30 * 60 * 1000;
  const REVIEW_MS = 5 * 60 * 1000;
  const TUCK_MS = 5000;
  // Left alone this long on a later page of cook modes, the home screen glides back to the first page.
  const PAGE_HOME_MS = 45000;
  const PAGE_HOME_GLIDE_MS = 700;
  const FPS_OPTIONS = [1, 5, 10, 15];
  const THEMES = [["auto", "Match Home Assistant"], ["light", "Light"], ["dark", "Dark"]];
  const CLOCKS = [["auto", "Automatic"], ["12", "12-hour"], ["24", "24-hour"]];
  // Entities of one oven, matched on the device by translation key (entity id suffix as a fallback).
  const KEYS = {
    phase: ["sensor", "cook_phase"], progress: ["sensor", "progress"], remaining: ["sensor", "time_remaining"],
    elapsed: ["sensor", "cook_elapsed"], probe: ["sensor", "probe_temperature"], probeTarget: ["sensor", "probe_target"],
    completed: ["sensor", "last_cook_completed"], connected: ["binary_sensor", "connected"], camera: ["camera", "interior"], toastLevel: ["number", "toast_level"], grillHeat: ["number", "grill_heat"]
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
    back: svg("0 0 24 24", '<path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', "d2-ic"),
    close: svg("0 0 24 24", '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic"),
    minus: svg("0 0 24 24", '<path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic"),
    plus: svg("0 0 24 24", '<path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "d2-ic")
  };
  // Mode glyphs: the heating elements each mode uses (the oven's own tile language).
  const g = (d) => `<path d="${d}"/>`;
  const GLYPH = {
    bake: g("M10 37h28"), broil: g("M10 11h28"), roast: g("M10 11h28M10 37h28"),
    toast: g("M10 11h7M20.5 11h7M31 11h7M10 37h7M20.5 37h7M31 37h7"),
    airfry: '<circle cx="24" cy="24" r="12.5" class="thin"/><g class="d2-fan">' + [0, 120, 240].map((a) => `<path class="fill" transform="rotate(${a} 24 24)" d="M24 24c-1.5-5.5 1-9.5 5-9.2 2.6.3 2.8 4.4-5 9.2z"/>`).join("") + "</g>",
    // The oven's own Reheat, Keep warm and Dehydrate tiles; Proof is dough rising over the bottom element.
    reheat: g([14, 24, 34].map((x) => `M${x} 11.5c2.6 2.8 2.6 5.7 0 8.5s-2.6 5.7 0 8.5 2.6 5.7 0 8.5`).join("")),
    proof: '<path class="solid" d="M14 30v-2.5c0-5.8 4.5-10 10-10s10 4.2 10 10v2.5z"/>' + g("M10 37h28"),
    warm: [14, 24, 34].map((x) => `<circle class="fill" cx="${x}" cy="24" r="4"/>`).join(""),
    dehydrate: '<circle class="fill" cx="24" cy="24" r="7.5"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path class="thin" transform="rotate(${a} 24 24)" d="M24 8.5v3.5"/>`).join(""),
    // Grill: the oven's diagonal grill marks. Pizza: a slice (the lead preferred it to the oven's peel).
    grill: g("M11 19l8-8M11 29l18-18M11 38.5L38.5 11M20 38.5l18.5-18.5M30 38.5l8.5-8.5"),
    pizzaiolo: '<path class="thin" d="M10.5 15.5Q24 7 37.5 15.5L24 40Z"/><path class="thin" d="M13.5 20.5Q24 14 34.5 20.5"/><circle class="fill" cx="20.5" cy="25.5" r="2.4"/><circle class="fill" cx="27.5" cy="27" r="2.4"/><circle class="fill" cx="24" cy="33" r="2"/>',
    camera: '<path class="thin" d="M9 16.5h6.5l3-4h11l3 4H39a2.5 2.5 0 0 1 2.5 2.5v15a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 34V19A2.5 2.5 0 0 1 9 16.5z"/><circle class="thin" cx="24" cy="26.5" r="6.5"/>',
    history: '<path class="thin" d="M12.2 17.5A13 13 0 1 1 11 26"/><path class="thin" d="M11.5 11v6.8h6.8"/><path d="M24 17v7.5l5 3"/>',
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
  const ICON_OPTIONS = [{ value: "", label: "Oven (default)" }].concat(Object.entries(OVEN_ICONS).map(([value, [label]]) => ({ value, label })));
  // Every oven has an icon: it is the oven's lamp and opens the oven menu.
  function ovenIcon(icon) {
    if (!icon) icon = "oven";
    if (String(icon).startsWith("mdi:")) return `<ha-icon class="d2-oic" icon="${esc(icon)}"></ha-icon>`;
    const hit = OVEN_ICONS[icon] || OVEN_ICONS.oven;
    return `<svg class="d2-oic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${hit[1]}</svg>`;
  }

  // ---- helpers -----------------------------------------------------------------------------------
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (st) => { const v = st ? parseFloat(st.state) : NaN; return Number.isFinite(v) ? v : null; };
  const usable = (st) => st && !["unavailable", "unknown"].includes(st.state);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const deg = (h) => String(h).replace(/°/g, '<span class="d2-deg">°</span>');
  const titleCase = (s) => (s ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "");
  // The reheat timer reads as minutes up to an hour, then as hours and minutes ("1 hr 30 min").
  const timerParts = (t) => (t >= 60 ? [Math.floor(t / 60), t % 60] : [0, t]);
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
  function ovenModel(hass, ids, name, now, dismissed, icon, food) {
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
    // Food temperature: the June probe, or another thermometer chosen for this oven (such as a
    // Combustion probe), converted from the sensor's own unit. Another thermometer has no target of
    // its own; the card's food target stands in for it (see _foodAutoStop).
    const probeSt = st(ids.probe);
    let probe = null;
    if (usable(probeSt) && Number.isFinite(+probeSt.state)) {
      const pu = String((probeSt.attributes && probeSt.attributes.unit_of_measurement) || ""), wantsF = unit !== "°C";
      let v = +probeSt.state;
      if (/°?F\b/i.test(pu) && !wantsF) v = ((v - 32) * 5) / 9;
      else if (/°?C\b/i.test(pu) && wantsF) v = (v * 9) / 5 + 32;
      probe = round(v);
    }
    const probeTgt = food && food.target != null && Number.isFinite(+food.target) ? round(+food.target) : usable(st(ids.probeTarget)) ? round(num(st(ids.probeTarget))) : null;
    const foodT = probe, foodTgt = probeTgt;
    const completedSt = st(ids.completed);
    const completed = usable(completedSt) ? Date.parse(completedSt.state) : NaN;
    const lang = (hass.locale && hass.locale.language) || hass.language || undefined;
    const clock = (t) => new Date(t).toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });

    // When this cook began: from the elapsed sensor, else when the oven left "off".
    const since = elapsed !== null ? now - elapsed * 1000 : c && c.state !== "off" ? Date.parse(c.last_changed) : NaN;
    const m = { name, oic: ovenIcon(icon), ids, unit, tgt, cur, probe, since, modeLabel, chips: false, action: null, heroText: false, stale: false, qual: null, a: "", b: "", camera: "live", frameAge: "LIVE", food: { temp: foodT, target: foodTgt } };
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
      const facts = `${modeLabel}${tgt !== null ? ` ${tgt} ${unit}` : ""}${foodT !== null ? ` · food ${foodT}°` : ""}`;
      if (remaining !== null) {
        const total = remaining + (elapsed || 0);
        return Object.assign(m, {
          hero: duration(remaining), qual: "left", bar: [total > 0 ? clamp01((elapsed || 0) / total) : 0, "heat"],
          a: `Done at ${clock(now + remaining * 1000)}`, b: facts, chips: true
        });
      }
      if (foodT !== null && foodTgt !== null) {
        return Object.assign(m, {
          hero: `${foodT}°`, qual: `food · target ${foodTgt}°`,
          bar: [progress !== null ? progress / 100 : clamp01(foodT / Math.max(1, foodTgt)), "heat"],
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
        a: `Done ${since}`, b: foodT !== null ? `Food ${foodT} ${unit} · ${modeLabel}` : modeLabel,
        action: "dismiss", camera: "still", frameAge: since, completed
      });
    }
    return Object.assign(m, { key: "off", word: "Off", tone: "rest", icon: "off", hero: null, camera: "off", frameAge: null, heating: false });
  }

  // ---- markup --------------------------------------------------------------------------------------
  const status = (m, cls = "") => `<span class="d2-st t-${m.tone} ${cls}">${svg("0 0 20 20", ST[m.icon], "d2-sti")}<b>${m.word}</b></span>`;
  const bar = (m) => `<div class="d2-bar k-${m.bar[1]}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(m.bar[0] * 100)}" style="--p:${Math.max(0.001, m.bar[0]).toFixed(3)}"><i></i></div>`;

  // The oven's lamp: orange while it heats, the text colour (white on the glass) while it is off.
  const lamp = (m) => (m.key === "offline" ? "lost" : m.heating ? "on" : "off");
  const lampWord = (m) => (m.key === "offline" ? "offline" : m.heating ? m.word.toLowerCase() : "off");
  function ovenButton(m, o = {}) {
    return `<button class="d2-name d2-ovb l-${lamp(m)}${o.tucked ? " is-tucked" : ""}${o.open ? " is-open" : ""}${o.cls || ""}" data-act="menu" aria-haspopup="menu" aria-expanded="${o.open ? "true" : "false"}" aria-label="${esc(m.name)}, ${lampWord(m)}. Choose an oven"><span class="d2-lamp">${m.oic}</span><span class="d2-nm"><span class="d2-nmt">${esc(m.name)}</span></span></button>`;
  }

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
  function idle(m, clock, date, page, size, nb, tiles = TILES, grid = gridFor(size, tiles.length)) {
    const { cols, rows } = grid;
    const pages = [];
    for (let i = 0; i < tiles.length; i += cols * rows) pages.push(tiles.slice(i, i + cols * rows));
    const n = pages.length;
    const tile = ([k, label]) => {
      const util = UTIL.includes(k);
      return `<button class="d2-tile${util ? " is-util" : ""}" data-act="${util ? k : "tile"}" data-mode="${k}" data-oven="${esc(m.ids.climate)}" aria-label="${util ? `${label} for ${esc(m.name)}` : `${label}: review and start`}"><span class="d2-face">${glyph(k)}</span><span class="d2-lab">${label}</span></button>`;
    };
    return `<div class="d2-idle${n > 1 ? "" : " no-dots"}">
      <div class="d2-top">
        <div class="d2-id">${ovenButton(m, nb)}</div>
        <div class="d2-clock" role="timer" aria-label="Time ${clock}, ${date}"><div class="d2-time">${clock}</div><div class="d2-date">${date}</div></div>
        <div class="d2-topr" aria-hidden="true"></div>
      </div>
      <div class="d2-pager" aria-label="Cook modes${n > 1 ? `, ${n} pages` : ""}">${pages.map((p, i) => `<div class="d2-page" style="--cols:${cols};--rows:${rows}" role="group" aria-label="Page ${i + 1} of ${n}">${p.map(tile).join("")}</div>`).join("")}</div>
      ${n > 1 ? `<div class="d2-dots">${pages.map((_, i) => `<button class="d2-dot" data-act="page" data-i="${i}" aria-label="Show page ${i + 1} of ${n}"${i === page ? ' aria-current="true"' : ""}><i></i></button>`).join("")}</div>` : ""}
    </div>`;
  }

  function run(m, o, busy, nb) {
    const cls = m.heroText ? " is-texthero" : String(m.hero).includes("°") ? " has-deg" : "";
    return `<div class="d2-run${cls}">
      ${ovenButton(m, { ...nb, cls: " d2-title" })}
      <div class="d2-foot">${action(m, o, busy)}</div>
      <div class="d2-up" data-act="more" data-oven="${esc(m.ids.climate)}">
        <div class="d2-hero${m.heroText ? " is-text" : ""}${!m.heroText && String(m.hero).length > 5 ? " is-long" : ""}${m.stale ? " is-stale" : ""}">${deg(esc(m.hero))}</div>
        <div class="d2-sline">${status(m)}${m.qual ? `<span class="d2-q">· ${esc(m.qual)}</span>` : ""}</div>
      </div>
      <div class="d2-barrow">${bar(m)}</div>
      <div class="d2-low">
        <div class="d2-a">${esc(m.a)}</div>
        <div class="d2-b">${esc(m.b)}</div>
      </div>
      ${m.chips ? `<div class="d2-quick">${chips(m)}</div>` : ""}
      <div class="d2-camcol">${cam(m)}</div>
      ${o.spark ? `<div class="d2-spcol">${o.spark}</div>` : ""}
    </div>`;
  }

  // Graph axes. Temperatures run in round steps over a range widened to whole steps and never
  // narrower than 10 °F (6 °C), so a steady oven draws a steady line; time is minutes since the
  // cook began. The target is marked on the temperature axis.
  function tempAxis(vals, unit) {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const least = unit === "°C" ? 6 : 10;
    if (hi - lo < least) { const c = (hi + lo) / 2; lo = c - least / 2; hi = c + least / 2; }
    const pad = (hi - lo) * 0.06;
    lo -= pad; hi += pad;
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250].find((st) => (hi - lo) / st <= 5) || 500;
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + 1e-6; v += step) ticks.push(v);
    return { lo, hi, ticks };
  }
  function timeTicks(a, b) {
    const step = [1, 2, 5, 10, 15, 20, 30, 60, 120].find((st) => (b - a) / st <= 4) || 240;
    const out = [];
    for (let v = Math.ceil(a / step - 1e-6) * step; v <= b + 1e-6; v += step) out.push(v);
    return out;
  }
  const minLabel = (v, last) => (v >= 60 ? `${Math.floor(v / 60)} h${v % 60 ? ` ${v % 60}` : ""}` : `${v}${last ? " min" : ""}`);
  // vals: every temperature drawn; span: [minutes at the left edge, at the right edge]; draw(y, W, H)
  // returns the lines, with y() turning a temperature into the plot's height.
  function chart(vals, unit, tgt, span, draw) {
    const W = 300, H = 100, { lo, hi, ticks } = tempAxis(vals, unit);
    const y = (v) => (H - ((v - lo) / (hi - lo)) * H).toFixed(1);
    const top = (v) => ((hi - v) / (hi - lo)) * 100;
    const grid = ticks.map((v) => `<line class="sp-grid" x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" vector-effect="non-scaling-stroke"/>`).join("");
    // A tick the target label would cover gives way to it; a short graph labels every other tick.
    const near = (v) => tgt !== null && Math.abs(top(v) - top(tgt)) < 14;
    const ys = ticks.map((v, i) => [v, i]).filter(([v]) => !near(v)).map(([v, i]) => `<span class="${i % 2 ? "is-odd" : ""}${i && i < ticks.length - 1 ? " is-mid" : ""}" style="top:${top(v).toFixed(2)}%">${v}°</span>`).join("") +
      (tgt !== null ? `<span class="is-tgt" style="top:${top(tgt).toFixed(2)}%">${tgt}°</span>` : "");
    const widest = [...ticks, tgt].filter((v) => v !== null).reduce((a, v) => (String(v).length > String(a).length ? v : a), 0);
    const xt = timeTicks(span[0], span[1]);
    const xs = xt.map((v, i) => {
      const left = ((v - span[0]) / Math.max(1e-6, span[1] - span[0])) * 100;
      return `<span class="${left < 8 ? "is-start" : left > 92 ? "is-end" : ""}" style="left:${left.toFixed(2)}%">${minLabel(v, i === xt.length - 1)}</span>`;
    }).join("");
    return `<div class="d2-plot" aria-hidden="true"><div class="d2-py"><i>${widest}°</i>${ys}</div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" focusable="false">${grid}${draw(y, W, H)}</svg><div class="d2-px">${xs}</div></div>`;
  }
  const tgtKey = (tgt) => (tgt !== null ? `<span class="d2-sp-key k-tgt"><i></i>Target ${tgt}°</span>` : "");

  // Wall layout: oven (and food) temperature since the cook began, at most the last hour. Tapping it
  // opens Home Assistant's history for the oven.
  function spark(m, h, now) {
    const t0 = h.start, t1 = Math.max(now, t0 + 60000);
    const cut = (pts) => {
      const i = pts.findIndex(([t]) => t >= t0);
      if (i < 0) return pts.length ? [[t0, pts[pts.length - 1][1]]] : [];
      return i > 0 ? [[t0, pts[i - 1][1]], ...pts.slice(i)] : pts;
    };
    const upto = (pts) => pts.filter(([t]) => t <= t1);
    const cav = upto(cut(h.cav)), food = upto(cut(h.food));
    const mins = Math.max(1, Math.round((t1 - t0) / 60000));
    const label = `Oven${food.length ? " and food" : ""} temperature over the last ${mins} min. Open the history`;
    const vals = [...cav, ...food].map(([, v]) => v);
    if (m.tgt !== null) vals.push(m.tgt);
    const has = cav.length || food.length;
    // Minutes count from the start of the cook, when the card knows it.
    const origin = Number.isFinite(m.since) && m.since <= t0 ? m.since : t0;
    const plot = has ? chart(vals, m.unit, m.tgt, [(t0 - origin) / 60000, (t1 - origin) / 60000], (y, W) => {
      const x = (t) => (((t - t0) / (t1 - t0)) * W).toFixed(1);
      // Each line runs on to now at its last reading.
      const line = (pts, cls) => (pts.length ? `<polyline class="${cls}" points="${[...pts, [t1, pts[pts.length - 1][1]]].map(([t, v]) => `${x(t)},${y(v)}`).join(" ")}" vector-effect="non-scaling-stroke"/>` : "");
      const target = m.tgt !== null ? `<line class="sp-tgt" x1="0" x2="${W}" y1="${y(m.tgt)}" y2="${y(m.tgt)}" vector-effect="non-scaling-stroke"/>` : "";
      return `${target}${line(food, "sp-food")}${line(cav, "sp-oven")}`;
    }) : `<div class="d2-plot is-empty" aria-hidden="true"></div>`;
    const keys = `<span class="d2-sp-key k-oven"><i></i>Oven</span>${food.length ? `<span class="d2-sp-key k-food"><i></i>Food</span>` : ""}`;
    return `<button class="d2-spark" data-act="more" data-oven="${esc(m.ids.climate)}" aria-label="${label}">${plot}<span class="d2-sp-cap">${keys}<span class="d2-sp-span">${has ? tgtKey(m.tgt) : "Collecting…"}</span></span></button>`;
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

  const snap = (r, v) => Math.max(r.min, Math.min(r.max, Math.round(v / r.step) * r.step));
  const fill = (r) => ((r.temp - r.min) / Math.max(1, r.max - r.min)).toFixed(4);

  // Every review has the same shape: the mode's tile at the left with one large control (temperature,
  // toast level, timer, grill heat, or the temperature the oven sets) on the sheet's centre line, a
  // slider or a line under it on that same line, then the note and the buttons.
  function review(r, name, unit, now, multi) {
    const left = Math.max(0, r.until - now);
    const step = (act, what, dis, ic) => `<button class="d2-round" data-act="${act}" aria-label="${what}"${dis ? " disabled" : ""}>${ic}</button>`;
    const at = `${r.temp} ${unit}`;
    let ctl, under;
    if (r.mode === "toast") {
      ctl = `<div class="d2-sh-temp">${step("toast-dec", "Lower the toast level", r.level <= 1, I.minus)}
          <span class="d2-sh-v" aria-label="Toast level"><b class="d2-sh-big d2-sh-lv">${r.level}</b></span>
          ${step("toast-inc", "Raise the toast level", r.level >= 9, I.plus)}</div>`;
      under = `<div class="d2-sh-slide"><input class="d2-range d2-level-range" type="range" min="1" max="9" step="1" value="${r.level}" style="--p:${((r.level - 1) / 8).toFixed(4)}" aria-label="Toast level, 1 to 9">
        <div class="d2-sh-ends" aria-hidden="true"><span>1 · Light</span><span>9 · Dark</span></div></div>`;
    } else if (r.mode === "reheat") {
      const t = r.timer || 60;
      ctl = `<div class="d2-sh-temp">${step("tm-dec", "Shorten the timer", t <= 1, I.minus)}
          <div class="d2-sh-v d2-timer-v${t >= 60 ? " has-h" : ""}"><label class="d2-tm-h"><input class="d2-sh-in d2-timer-h${timerParts(t)[0] >= 10 ? " is-wide" : ""}" type="text" inputmode="numeric" maxlength="2" autocomplete="off" value="${timerParts(t)[0]}" aria-label="Timer hours"><span>hr</span></label>
            <label><input class="d2-sh-in d2-timer-in" type="text" inputmode="numeric" maxlength="3" autocomplete="off" value="${timerParts(t)[1]}" aria-label="Timer minutes"><span>min</span></label></div>
          ${step("tm-inc", "Lengthen the timer", t >= 600, I.plus)}</div>`;
      under = `<div class="d2-sh-slide"><input class="d2-range d2-timer-range" type="range" min="1" max="600" step="1" value="${t}" style="--p:${((t - 1) / 599).toFixed(4)}" aria-label="Timer in minutes">
        <div class="d2-sh-ends d2-sh-ends3" aria-hidden="true"><span>1 min</span><span>Reheats at ${at}</span><span>10 hr</span></div></div>`;
    } else if (r.mode === "grill") {
      ctl = `<div class="d2-sh-temp"><div class="d2-seg d2-sh-seg" role="radiogroup" aria-label="Grill heat">${[2, 1, 0].map((v) => `<button role="radio" aria-checked="${r.grill === v}" data-act="grill-heat" data-v="${v}">${GRILL_LABEL[v]}</button>`).join("")}</div></div>`;
      under = `<div class="d2-sh-slide d2-sh-line">Grills at ${at}</div>`;
    } else if (r.fixed) {
      ctl = `<div class="d2-sh-temp"><span class="d2-sh-v"><b class="d2-sh-big">${r.temp}</b><span>${esc(unit)}</span></span></div>`;
      under = `<div class="d2-sh-slide d2-sh-line">The oven sets this temperature</div>`;
    } else {
      ctl = `<div class="d2-sh-temp">${step("rv-dec", "Lower the temperature", r.temp <= r.min, I.minus)}
          <label class="d2-sh-v"><input class="d2-sh-in d2-temp-in" type="text" inputmode="numeric" maxlength="3" autocomplete="off" value="${r.temp}" aria-label="Temperature in ${esc(unit)}: type a number from ${r.min} to ${r.max}"><span>${esc(unit)}</span></label>
          ${step("rv-inc", "Raise the temperature", r.temp >= r.max, I.plus)}</div>`;
      under = `<div class="d2-sh-slide"><input class="d2-range d2-temp-range" type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${r.temp}" style="--p:${fill(r)}" aria-label="Temperature in ${esc(unit)}">
        <div class="d2-sh-ends" aria-hidden="true"><span>${r.min}°</span><span>${r.max}°</span></div></div>`;
    }
    return `<div class="d2-sheet" role="dialog" aria-modal="true" aria-label="Review before starting">
      <div class="d2-sh-head"><div><div class="d2-sh-t">${esc(MODE_LABEL[r.mode])} · ${esc(name)}</div><div class="d2-sh-s">Step 2 of 2 · Review</div></div>
        <button class="d2-icbtn" data-act="sheet-close" aria-label="Cancel">${I.close}</button></div>
      <div class="d2-sh-row"><span class="d2-face d2-sh-face">${glyph(r.mode)}</span>${ctl}</div>
      ${under}
      <div class="d2-sh-note d2-sh-mid">Make sure the oven is empty and the door is closed. Nothing heats until you press Start. This closes in <b class="d2-sh-left">${duration(left / 1000)}</b>.</div>
      <div class="d2-sh-acts"><button class="d2-ghost" data-act="sheet-close">Not now</button>
        <button class="d2-go" data-act="rv-start"${r.busy ? " disabled" : ""}>${r.busy ? "Starting…" : multi ? `Start preheating ${esc(name)}` : "Start preheating"}</button></div>
    </div>`;
  }

  const seg = (k, opts, cur, label) => `<div class="d2-seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, l]) => `<button role="radio" aria-checked="${String(v) === String(cur)}" data-act="set" data-k="${k}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>`;
  const setRow = (label, help, body) => `<div class="d2-set-row"><div class="d2-set-l">${esc(label)}</div>${body}${help ? `<div class="d2-set-h">${esc(help)}</div>` : ""}</div>`;

  // One row per oven (every June oven in Home Assistant); the open row shows the icon choices.
  // One row per oven (every June oven in Home Assistant): its icon, lit as on the card, its name and
  // state. The open row edits that oven only, and says so.
  function iconRows(ovens, open) {
    return ovens.map(({ m, icon }) => {
      const id = esc(m.ids.climate), isOpen = m.ids.climate === open, cur = icon || "oven", name = esc(m.name);
      const mdi = String(cur).startsWith("mdi:") ? cur : "";
      const state = m.key === "offline" ? "Offline" : m.heating ? m.word : "Off";
      const choices = isOpen ? `<div class="d2-ic-pick" id="d2-ic-${id.replace(/\W/g, "_")}">
        <div class="d2-ic-cap">Icon for <b>${name}</b></div>
        <div class="d2-icons" role="radiogroup" aria-label="Icon for ${name}">${Object.entries(OVEN_ICONS).map(([k, [label]]) => `<button class="d2-ici" role="radio" aria-checked="${k === cur}" data-act="set" data-k="icon" data-oven="${id}" data-v="${k}" aria-label="${label} for ${name}" title="${label}">${ovenIcon(k)}</button>`).join("")}</div>
        <label class="d2-ic-cap d2-mdi-l">Or any mdi: icon for <b>${name}</b><input class="d2-mdi" type="text" data-oven="${id}" value="${esc(mdi)}" placeholder="mdi:stove" autocomplete="off" spellcheck="false"></label></div>` : "";
      return `<div class="d2-ic-row l-${lamp(m)}${isOpen ? " is-open" : ""}"><button class="d2-ic-head" data-act="set-iconfor" data-oven="${id}" aria-expanded="${isOpen}" aria-label="${name}, ${state}: ${isOpen ? "close" : "change"} its icon"><span class="d2-lamp">${ovenIcon(cur)}</span><span class="d2-ic-n">${name}</span><span class="d2-ic-s">${esc(state)}</span><span class="d2-ic-go">${isOpen ? "Done" : "Change"}</span></button>${choices}</div>`;
    }).join("");
  }

  function settingsSheet(p, m, ovens, open, choices) {
    return `<div class="d2-sheet d2-set" role="dialog" aria-modal="true" aria-label="Card settings">
      <div class="d2-sh-head"><div><div class="d2-sh-t">Settings</div><div class="d2-sh-s">This card, in this browser</div></div>
        <button class="d2-icbtn" data-act="sheet-close" aria-label="Close settings">${I.close}</button></div>
      <div class="d2-set-list">
        ${setRow("Appearance", "", seg("theme", THEMES, p.theme, "Appearance"))}
        ${setRow("Camera frame rate", "Pictures per second in the camera window. 1 fps is the stock June app's rate. Higher rates load more pictures from Home Assistant.", seg("camera_fps", FPS_OPTIONS.map((v) => [v, `${v} fps`]), p.camera_fps, "Camera frame rate"))}
        ${setRow("Oven name", "", seg("hide_name", [["true", "Tuck into the icon"], ["false", "Always show"]], String(p.hide_name), "Oven name"))}
        ${setRow("Cook modes", "Most used first counts the cooks started from this card, per oven, in this browser.", seg("mode_order", ORDERS, p.mode_order, "Cook mode order"))}
        ${setRow("Clock", "", seg("clock", CLOCKS, p.clock, "Clock"))}
        ${setRow("Mode layout", p.layout.auto ? "Automatic until you change it. Modes that don't fit go on more pages." : "Modes that don't fit go on more pages.", layoutPicker(p.layout))}
        ${setRow("Card size", "Text, buttons and spacing. Larger reads better from across the room.", `<div class="d2-scale"><input class="d2-range d2-ui" type="range" min="80" max="150" step="5" value="${p.scale}" style="--p:${(p.scale - 80) / 70}" aria-label="Card size"><span class="d2-scale-v">${p.scale}%</span></div>`)}
        ${setRow("Mode icon size", "Only the cook mode tiles. Fill makes them as big as the layout allows.", seg("icon_size", ICON_SIZES, p.icon_size, "Mode icon size"))}
        ${setRow("Food probe", "Food temperature on the card and the wall graph. Pick another thermometer's sensor, such as a Combustion probe's Core Temperature, to use it instead of the June probe.", probeRows(ovens, choices))}
        ${ovens.some((o) => o.probe) ? setRow("Food target", `For the other thermometer, in ${m.unit}: the card shows the food against it, and Stop at target turns the oven off when the food reaches it. The oven can't read that thermometer, so this card must be open for the stop.`, `<div class="d2-food">
          <input class="d2-foodin" data-k="food_target" type="text" inputmode="numeric" maxlength="3" autocomplete="off" placeholder="No target" value="${esc(p.food.target)}" aria-label="Food target in ${esc(m.unit)}">
          ${seg("food_auto_stop", [["true", "Stop at target"], ["false", "Show only"]], p.food.stop, "When the food reaches its target")}
        </div>`) : ""}
        ${setRow("Oven icons", "Each oven's icon on the card. Tap an oven to change its icon.", `<div class="d2-ic-list">${iconRows(ovens, open)}</div>`)}
        <div class="d2-set-acts"><button class="d2-ghost" data-act="set-ha" data-oven="${esc(m.ids.climate)}">Oven in Home Assistant</button><button class="d2-ghost" data-act="set-reset">Reset</button></div>
        <div class="d2-set-ver">July Oven card ${VERSION}</div>
      </div>
    </div>`;
  }

  // Temperature sensors that could be a food probe, Combustion's Core Temperature first; not the ovens' own.
  function probeChoices(hass) {
    const reg = hass.entities || {};
    return Object.values(hass.states)
      .filter((s) => s.entity_id.startsWith("sensor.") && s.attributes.device_class === "temperature" && !(reg[s.entity_id] && reg[s.entity_id].platform === DOMAIN))
      .map((s) => ({ id: s.entity_id, name: s.attributes.friendly_name || s.entity_id, core: /core/i.test(`${s.entity_id} ${s.attributes.friendly_name || ""}`) }))
      .sort((a, b) => b.core - a.core || a.name.localeCompare(b.name));
  }

  // One food probe choice per oven (named when there are several).
  function probeRows(ovens, choices) {
    return `<div class="d2-pr-list">${ovens.map(({ m, probe }) => {
      const id = esc(m.ids.climate), name = esc(m.name);
      const list = probe && !choices.some((c) => c.id === probe) ? [{ id: probe, name: `${probe} (not found)` }, ...choices] : choices;
      const opts = [`<option value="">June probe (built in)</option>`, ...list.map((c) => `<option value="${esc(c.id)}"${c.id === probe ? " selected" : ""}>${esc(c.name)}</option>`)].join("");
      return `<label class="d2-pr">${ovens.length > 1 ? `<span class="d2-pr-n">${name}</span>` : ""}<select class="d2-sel d2-probe" data-oven="${id}" aria-label="Food probe for ${name}">${opts}</select></label>`;
    }).join("")}</div>`;
  }

  // Columns and rows, each with − and +, over a small picture of the home screen.
  function layoutPicker(l) {
    const step = (k, label, v, max) => `<div class="d2-lay-row"><span class="d2-lay-l">${label}</span><span class="d2-lay-ctl">
      <button class="d2-lay-b" data-act="lay" data-k="${k}" data-d="-1" aria-label="Fewer ${label.toLowerCase()}"${v <= 1 ? " disabled" : ""}>−</button>
      <span class="d2-lay-v" aria-live="polite">${v}${l[k + "Set"] ? "" : "<small>auto</small>"}</span>
      <button class="d2-lay-b" data-act="lay" data-k="${k}" data-d="1" aria-label="More ${label.toLowerCase()}"${v >= max ? " disabled" : ""}>+</button></span></div>`;
    const per = l.cols * l.rows, shown = l.tiles.slice(0, per), pages = Math.ceil(l.tiles.length / per);
    const cells = shown.map(([k]) => `<u class="${UTIL.includes(k) ? "is-util" : ""}"></u>`).join("");
    return `<div class="d2-lay">${step("cols", "Columns", l.cols, MAX_COLS)}${step("rows", "Rows", l.rows, MAX_ROWS)}
      <div class="d2-lay-prev" aria-hidden="true"><div class="d2-lay-clock">${esc(l.clock)}</div><div class="d2-lay-grid" style="--cols:${l.cols}">${cells}</div>${pages > 1 ? `<div class="d2-lay-pages">${Array.from({ length: pages }, (_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</div>` : ""}</div>
      ${pages > 1 ? `<div class="d2-lay-note">${l.tiles.length - per} more on ${pages > 2 ? "the next pages" : "page 2"}</div>` : ""}
      ${l.auto ? "" : `<button class="d2-link" data-act="lay-auto">Back to automatic</button>`}</div>`;
  }

  function cameraSheet(m) {
    return `<div class="d2-cv-back" data-act="sheet-close"></div>
      <div class="d2-cv" role="dialog" aria-modal="true" aria-label="${esc(m.name)} camera">
        <div class="d2-cv-win"><img class="d2-cv-img" alt="">
          <div class="d2-cv-msg" hidden>${I.camOff}<b></b><span></span></div></div>
        <div class="d2-cv-bar"><span class="d2-cv-t"><span class="d2-pill d2-cv-pill" hidden></span>${esc(m.name)}</span>
          <button class="d2-icbtn d2-cv-x" data-act="sheet-close" aria-label="Close the camera">${I.close}</button></div>
      </div>`;
  }


  // ---- cook history (kept by the integration; see history.py) ----
  const HIST_PAGE = 30;
  const toUnit = (c, unit) => (c === null || c === undefined || !Number.isFinite(+c) ? null : Math.round(unit === "°C" ? +c : (+c * 9) / 5 + 32));
  const cookName = (r) => MODE_LABEL[r.name] || titleCase(r.name) || "Cook";
  const cookMins = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`);
  function cookWhen(iso, lang, withTime = true) {
    const d = new Date(iso), today = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(today) - day(d)) / 86400000);
    const date = diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString(lang, diff < 7 ? { weekday: "long" } : { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
    return withTime ? `${date}, ${d.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" })}` : date;
  }

  // The whole cook: oven (and food) temperature from start to end, with the last target.
  function cookGraph(r, unit, ext) {
    const t1 = Math.max(60, r.duration_s || 0);
    const cav = [], food = [];
    for (const [t, c, f] of r.samples || []) {
      const a = toUnit(c, unit), b = toUnit(f, unit);
      if (a !== null) cav.push([t, a]);
      if (b !== null) food.push([t, b]);
    }
    if (!r.samples) return `<div class="d2-hd-graph is-loading" aria-hidden="true"></div>`;
    const foodPts = food.length ? food : (ext || []).filter(([t]) => t >= 0 && t <= t1);
    const tgt = toUnit(r.target_c, unit);
    const vals = [...cav, ...foodPts].map(([, v]) => v);
    if (!vals.length) return `<div class="d2-hd-nog">No temperature readings were saved for this cook.</div>`;
    if (tgt !== null) vals.push(tgt);
    const plot = chart(vals, unit, tgt, [0, t1 / 60], (y, W) => {
      const x = (t) => ((Math.min(t1, Math.max(0, t)) / t1) * W).toFixed(1);
      const line = (pts, cls) => (pts.length ? `<polyline class="${cls}" points="${pts.map(([t, v]) => `${x(t)},${y(v)}`).join(" ")}" vector-effect="non-scaling-stroke"/>` : "");
      const target = tgt !== null ? `<line class="sp-tgt" x1="0" x2="${W}" y1="${y(tgt)}" y2="${y(tgt)}" vector-effect="non-scaling-stroke"/>` : "";
      return `${target}${line(foodPts, "sp-food")}${line(cav, "sp-oven")}`;
    });
    const keys = `<span class="d2-sp-key k-oven"><i></i>Oven</span>${foodPts.length ? `<span class="d2-sp-key k-food"><i></i>Food</span>` : ""}${tgtKey(tgt)}`;
    return `<div class="d2-hd-graph" role="img" aria-label="Oven${foodPts.length ? " and food" : ""} temperature during the ${esc(cookMins(t1))} cook">${plot}<div class="d2-sp-cap">${keys}</div></div>`;
  }

  function cookRow(r, unit, lang, pic) {
    const tgt = toUnit(r.target_c, unit), done = r.outcome === "done";
    const face = pic ? `<img src="${esc(pic)}" alt="" loading="lazy">` : `<span class="d2-face">${glyph(GLYPH[r.name] ? r.name : "history")}</span>`;
    const probe = r.probe && r.probe.peak_c !== null ? ` · food ${toUnit(r.probe.peak_c, unit)}°` : "";
    return `<button class="d2-hr" data-act="hist-open" data-id="${esc(r.id)}" aria-label="${esc(cookName(r))}, ${esc(cookWhen(r.started, lang))}, ${done ? "finished" : "stopped"}. Show details">
      <span class="d2-hr-pic">${face}</span>
      <span class="d2-hr-m"><span class="d2-hr-t">${esc(cookName(r))}${tgt !== null ? ` · ${tgt}°` : ""}</span><span class="d2-hr-s">${esc(cookWhen(r.started, lang))} · ${esc(cookMins(r.duration_s || 0))}${esc(probe)}</span></span>
      <span class="d2-hr-o${done ? " is-done" : ""}">${done ? "Done" : "Stopped"}</span></button>`;
  }

  function cookDetail(r, s, unit, lang, pic, ext) {
    const u = (c) => { const v = toUnit(c, unit); return v === null ? null : `${v}°`; };
    const targets = (r.targets_c || []).map((c) => toUnit(c, unit)).filter((v) => v !== null);
    const stat = (k, v) => (v === null || v === undefined || v === "" ? "" : `<div class="d2-hd-st"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`);
    const clock = (iso) => new Date(iso).toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });
    const p = r.probe || {};
    const confirm = s.confirm === r.id;
    return `<div class="d2-hd${r.picture ? " has-pic" : ""}">
      ${r.picture ? `<div class="d2-hd-pic">${pic ? `<img src="${esc(pic)}" alt="The food when the cook ended">` : ""}</div>` : ""}
      ${cookGraph(r, unit, ext)}
      <dl class="d2-hd-stats">
        ${stat("Result", r.outcome === "done" ? "Finished" : "Stopped early")}
        ${stat("Time", `${clock(r.started)} – ${clock(r.ended)} · ${cookMins(r.duration_s || 0)}`)}
        ${stat("Target", targets.length ? targets.map((v) => `${v}°`).join(" → ") : null)}
        ${stat("Preheat", r.preheat_s !== null && r.preheat_s !== undefined ? cookMins(r.preheat_s) : null)}
        ${stat("Hottest", u(r.peak_c))}
        ${stat("Timer", r.timer_s ? cookMins(r.timer_s) : null)}
        ${stat("Food probe", p.peak_c !== null && p.peak_c !== undefined ? `${u(p.final_c ?? p.peak_c)} at the end${p.peak_c !== p.final_c ? `, ${u(p.peak_c)} highest` : ""}` : null)}
        ${stat("Probe target", u(p.target_c))}
        ${stat("Program", r.program ? `${cookName(r)} (June program ${r.plan_id ?? "?"})` : null)}
      </dl>
      ${r.joined ? `<div class="d2-sh-note">Home Assistant found this cook already running, so it starts when Home Assistant first saw it.</div>` : ""}
      <div class="d2-hd-acts">${confirm
        ? `<button class="d2-ghost" data-act="hist-cancel">Keep</button><button class="d2-ghost is-danger" data-act="hist-del" data-id="${esc(r.id)}">Delete this cook</button>`
        : `<button class="d2-ghost" data-act="hist-del" data-id="${esc(r.id)}">Delete…</button>`}</div>
    </div>`;
  }

  function historySheet(s, m, d, pics, exts, lang) {
    const open = d && d.records && s.open ? d.records.find((r) => r.id === s.open) : null;
    const head = open
      ? `<div class="d2-sh-head"><button class="d2-icbtn" data-act="hist-back" aria-label="Back to the history">${I.back}</button><div class="d2-hd-ht"><div class="d2-sh-t">${esc(cookName(open))}</div><div class="d2-sh-s">${esc(cookWhen(open.started, lang))}</div></div>
          <button class="d2-icbtn" data-act="sheet-close" aria-label="Close the history">${I.close}</button></div>`
      : `<div class="d2-sh-head"><div><div class="d2-sh-t">History</div><div class="d2-sh-s">${esc(m.name)}${d && d.records && d.records.length ? ` · ${d.records.length} cook${d.records.length > 1 ? "s" : ""}` : ""}</div></div>
          <button class="d2-icbtn" data-act="sheet-close" aria-label="Close the history">${I.close}</button></div>`;
    let body;
    if (!d || (d.loading && !d.records)) body = `<div class="d2-hist-msg">Loading…</div>`;
    else if (d.error) body = `<div class="d2-hist-msg"><b>History isn't available</b>${esc(d.error)}</div>`;
    else if (open) body = cookDetail(open, s, m.unit, lang, open.picture ? pics[open.id] : "", exts[open.id]);
    else if (!d.records.length) body = `<div class="d2-hist-msg"><b>${d.enabled ? "No cooks yet" : "History is off"}</b>${d.enabled ? `Each cook is saved here when it ends, with its temperatures${d.pictures ? " and a picture" : ""}.` : "Turn on Keep a cook history in this oven's options in Home Assistant."}</div>${d.enabled ? "" : `<div class="d2-set-acts"><button class="d2-ghost" data-act="set-ha" data-oven="${esc(m.ids.climate)}">Oven in Home Assistant</button></div>`}`;
    else {
      const shown = d.records.slice(0, s.limit);
      const confirm = s.confirm === "all";
      body = `<div class="d2-hist">${shown.map((r) => cookRow(r, m.unit, lang, r.picture ? pics[r.id] : "")).join("")}</div>
        ${d.records.length > shown.length ? `<button class="d2-link" data-act="hist-more">Show ${Math.min(HIST_PAGE, d.records.length - shown.length)} more</button>` : ""}
        ${d.enabled ? "" : `<div class="d2-sh-note">History is off: new cooks aren't saved. Turn it on in this oven's options in Home Assistant.</div>`}
        <div class="d2-set-acts">${confirm
          ? `<button class="d2-ghost" data-act="hist-cancel">Keep</button><button class="d2-ghost is-danger" data-act="hist-clear">Delete all ${d.records.length}</button>`
          : `<button class="d2-ghost" data-act="hist-clear">Clear history…</button>`}</div>`;
    }
    return `<div class="d2-sheet d2-set d2-hsheet" role="dialog" aria-modal="true" aria-label="${esc(m.name)} cook history">${head}<div class="d2-set-list">${body}</div></div>`;
  }

  function menuSheet(models, focus, pos) {
    const items = models.map((m) => `<button class="d2-mi l-${lamp(m)}" role="menuitemradio" aria-checked="${m.ids.climate === focus}" data-act="pick" data-oven="${esc(m.ids.climate)}"><span class="d2-lamp">${m.oic}</span><span class="d2-mi-n">${esc(m.name)}</span><span class="d2-mi-s">${esc(m.key === "offline" ? "Offline" : m.heating ? m.word : "Off")}</span>${m.ids.climate === focus ? I.check : ""}</button>`).join("");
    return `<div class="d2-menu-back" data-act="sheet-close"></div>
      <div class="d2-menu" role="menu" aria-label="Ovens" style="left:${pos.x}px;top:${pos.y}px;max-height:${pos.h}px">${items}</div>`;
  }

  // ---- the card ------------------------------------------------------------------------------------
  class JulyOvenCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      // The stylesheet is attached once, so :host sizing applies before the first measurement.
      // Sheets (review, settings, camera, oven menu) live in their own layer over the card, so the
      // card's re-renders never interrupt a slider drag or typing.
      // Until the first render, a plain panel holds the card's place; it fades in only if that takes a while.
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="jo-root"><div class="jo-skel" aria-label="Loading the oven" role="img"><i></i><b></b></div></div><div class="jo-over" hidden></div>`;
      this._root = this.shadowRoot.querySelector(".jo-root");
      this._overEl = this.shadowRoot.querySelector(".jo-over");
      this._busy = {};
      this._dismissed = {};
      this._page = 0;
      this._sheet = null;
      this._tucked = false;
      this._prefs = { icons: {}, probes: {} };
      this._size = "standard";
      this._imgs = {};
      this._hist = {};
      this._cooks = {};
      this._pics = {};
      this._cookExt = {};
      this._html = "";
    }

    static getStubConfig(hass) {
      const hit = Object.values((hass && hass.entities) || {}).find((e) => e.platform === DOMAIN && e.entity_id.startsWith("climate."));
      // The defaults are written out so the editor shows them (a missing toggle reads as off there).
      return { entity: hit ? hit.entity_id : "", theme: "dark", display_mode: "auto", load_fonts: true };
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
      // Ovens: `entity` (+ `icon`, `name`, `probe`), then `entities` (ids or {entity, icon, name, probe}), then the editor's entity_2..4.
      const ovens = [];
      const add = (o) => { if (o && o.entity && !ovens.some((x) => x.entity === o.entity)) ovens.push(o); };
      add({ entity: config.entity, icon: config.icon, name: config.name, probe: config.probe });
      for (const item of config.entities || []) add(typeof item === "string" ? { entity: item } : item);
      for (const n of [2, 3, 4]) add({ entity: config[`entity_${n}`], icon: config[`icon_${n}`], name: config[`name_${n}`], probe: config[`probe_${n}`] });
      for (const o of ovens) if (!String(o.entity).startsWith("climate.")) throw new Error(`${o.entity} is not a climate entity. Choose the oven itself.`);
      this._config = { theme: "dark", display_mode: "auto", load_fonts: true, camera_fps: 15, hide_name: true, clock: "auto", mode_order: "oven", columns: "auto", rows: "auto", scale: 100, icon_size: "large", food_sensor: "", food_target: null, food_auto_stop: false, ...config };
      this._ovenConf = ovens;
      this._ovens = ovens.map((o) => o.entity);
      // The oven last picked in this card, and the card's own settings, are remembered in this browser.
      this._focusKey = `july-oven-card:focus:${this._ovens.join(",")}`;
      this._prefsKey = `july-oven-card:prefs:${this._ovens.join(",")}`;
      try { this._focus = localStorage.getItem(this._focusKey) || undefined; } catch (e) { this._focus = undefined; }
      try { this._prefs = JSON.parse(localStorage.getItem(this._prefsKey)) || {}; } catch (e) { this._prefs = {}; }
      if (!this._prefs.icons || typeof this._prefs.icons !== "object") this._prefs.icons = {};
      if (!this._prefs.probes || typeof this._prefs.probes !== "object") this._prefs.probes = {};
      if (this._config.load_fonts !== false) loadFonts();
      if (this.isConnected) this._restartCamTimer();
      this._html = "";
      this._render();
      this._renderOver();
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
      if (this.isConnected) this._measure();
    }

    // Home Assistant sets editMode while the dashboard is being edited (a panel view then has an edit bar).
    set editMode(value) {
      this._editMode = !!value;
      if (this.isConnected) this._measure();
    }

    get editMode() {
      return this._editMode;
    }

    get layout() {
      return this._layout;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._measured) this._measure();
      this._render();
      this._foodAutoStop();
    }

    // Another thermometer: stop the oven once the food reaches food_target (food_auto_stop). Fires
    // once per cook and re-arms when the oven goes idle. The June probe's own target is the oven's job.
    _foodAutoStop() {
      if (!this._pref("food_auto_stop") || this._foodTarget() === null || !this._hass) return;
      this._probeFired = this._probeFired || {};
      for (const o of this._ovens) {
        if (!this._probeFor(this._conf(o))) { delete this._probeFired[o]; continue; }
        const m = this._model(this._conf(o), Date.now());
        const f = m && m.food ? m.food : null;
        if (!m || m.key !== "cooking" || !f || f.temp == null || f.target == null || f.temp < f.target) {
          delete this._probeFired[o];
          continue;
        }
        if (this._probeFired[o]) continue;
        this._probeFired[o] = true;
        this._call("climate", "turn_off", {}, o, `Food reached ${f.target}${m.unit} - oven stopped`);
      }
    }

    connectedCallback() {
      this._ro = new ResizeObserver(() => { this._measure(); this._syncRows(); });
      this._ro.observe(this);
      this._tick = setInterval(() => this._render(), 15000);
      this._restartCamTimer();
      this.shadowRoot.addEventListener("click", this._onClick = (e) => this._handleClick(e));
      this.shadowRoot.addEventListener("input", this._onInput = (e) => this._handleInput(e));
      this.shadowRoot.addEventListener("change", this._onChange = (e) => this._handleChange(e));
      // Only the pager, sheets and lists scroll. When a short card's contents are taller than the card,
      // focus (a tap, Tab) could scroll a clipped box such as the card itself, and nothing could scroll
      // it back: put any clipped box back the moment it moves. Scroll events don't bubble, so capture.
      this.shadowRoot.addEventListener("scroll", this._onScroll = (e) => this._unscroll(e.target), true);
      // Any touch, key, wheel or focus counts as use; idle time brings the mode pages back to the first.
      // A pointer moving over the card counts too, but only a touch, key or wheel stops a glide.
      this._onActive = () => this._armPageHome();
      this._onMove = () => { if (!this._homeAnim) this._armPageHome(); };
      for (const t of ["pointerdown", "keydown", "wheel", "focusin"]) this.shadowRoot.addEventListener(t, this._onActive, { capture: true, passive: true });
      this.shadowRoot.addEventListener("pointermove", this._onMove, { capture: true, passive: true });
      this._armPageHome();
      // On the window, so Escape closes a sheet even when nothing in the card has focus.
      window.addEventListener("keydown", this._onKey = (e) => this._handleKey(e));
      window.addEventListener("resize", this._onResize = () => this._measure());
      // A long oven name scrolls while the pointer (or focus) is on it.
      // The Air fry fan spins while the pointer is on its tile.
      this.shadowRoot.addEventListener("pointerover", this._onOver = (e) => { this._nameHover(e, true); this._fanHover(e, true); });
      this.shadowRoot.addEventListener("pointerout", this._onOut = (e) => { this._nameHover(e, false); this._fanHover(e, false); });
      this.shadowRoot.addEventListener("focusin", this._onOver);
      this.shadowRoot.addEventListener("focusout", this._onOut);
      this._showName();
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
      clearTimeout(this._cvTimer);
      clearTimeout(this._tuckTimer);
      if (this._onClick) this.shadowRoot.removeEventListener("click", this._onClick);
      if (this._onInput) this.shadowRoot.removeEventListener("input", this._onInput);
      if (this._onChange) this.shadowRoot.removeEventListener("change", this._onChange);
      if (this._onScroll) this.shadowRoot.removeEventListener("scroll", this._onScroll, true);
      if (this._onActive) for (const t of ["pointerdown", "keydown", "wheel", "focusin"]) this.shadowRoot.removeEventListener(t, this._onActive, { capture: true });
      if (this._onMove) this.shadowRoot.removeEventListener("pointermove", this._onMove, { capture: true });
      clearTimeout(this._homeTimer);
      if (this._homeAnim) cancelAnimationFrame(this._homeAnim);
      if (this._onKey) window.removeEventListener("keydown", this._onKey);
      if (this._onResize) window.removeEventListener("resize", this._onResize);
      if (this._onOver) { this.shadowRoot.removeEventListener("pointerover", this._onOver); this.shadowRoot.removeEventListener("focusin", this._onOver); }
      if (this._onOut) { this.shadowRoot.removeEventListener("pointerout", this._onOut); this.shadowRoot.removeEventListener("focusout", this._onOut); }
      clearTimeout(this._marqTimer);
      cancelAnimationFrame(this._fanRaf);
      this._fanRaf = null;
      this._fans = null;
      this._nameOn = null;
      this._sheet = null;
    }

    _measure() {
      if (!this.isConnected) return;
      this._measured = true;
      const box = this.getBoundingClientRect(), z = this._ui();
      this.style.setProperty("--ui", z);
      // Layout decisions use the card's own pixels, which Card size makes larger.
      const r = { top: box.top, width: box.width / z, height: box.height / z };
      const mode = this._config && this._config.display_mode;
      let size = mode && mode !== "auto" ? mode : "standard";
      // No height from the parent (masonry view, editor preview): give the card its own, and keep it.
      if (this._layout !== "grid" && r.height < 24 && !this._autoHeight) this._autoHeight = true;
      this._collapsed = !!this._autoHeight && this._layout !== "grid";
      // A panel view gives the card the whole view: the glass runs to the bottom of the window (above
      // the edit bar while editing).
      const panelH = this._layout === "panel" ? Math.max(376 * z, Math.round(window.innerHeight - Math.max(0, r.top + window.scrollY) - (this.editMode ? 59 : 0))) : 0;
      if (panelH !== this._panelH) { this._panelH = panelH; this._html = ""; this._render(); }
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

    // ---- back to the first page of cook modes after a while ----
    _armPageHome() {
      clearTimeout(this._homeTimer);
      // A touch during the glide stops it where it is; the pager then snaps as usual.
      if (this._homeAnim) {
        cancelAnimationFrame(this._homeAnim);
        this._homeAnim = 0;
        const p = this.shadowRoot.querySelector(".d2-pager");
        if (p) p.style.scrollSnapType = "";
      }
      this._homeTimer = setTimeout(() => this._pageHome(), PAGE_HOME_MS);
    }

    _pageHome() {
      if (!this._page) return;
      if (this._sheet) return this._armPageHome();
      const pager = this.shadowRoot.querySelector(".d2-pager");
      // Cooking, or another layout: the home screen opens on the first page next time.
      if (!pager || !pager.scrollLeft) { this._page = 0; if (pager) this._markPage(0); return; }
      const from = pager.scrollLeft, t0 = performance.now();
      const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const step = (t) => {
        // Re-renders replace the pager, so look it up each frame.
        const p = this.shadowRoot.querySelector(".d2-pager");
        if (!p) { this._homeAnim = 0; this._page = 0; return; }
        const k = still ? 1 : Math.min(1, (t - t0) / PAGE_HOME_GLIDE_MS);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        p.style.scrollSnapType = "none";
        p.scrollLeft = from * (1 - e);
        if (k < 1) { this._homeAnim = requestAnimationFrame(step); return; }
        p.style.scrollSnapType = "";
        this._homeAnim = 0;
        this._page = 0;
        this._markPage(0);
      };
      this._homeAnim = requestAnimationFrame(step);
    }

    _markPage(i) {
      this.shadowRoot.querySelectorAll(".d2-dot").forEach((d, j) => (j === i ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
    }

    // Swap in the new card around the pager that is already showing: each of the pager's ancestors
    // takes the new attributes and the new siblings; the pager itself is never removed.
    _graft(frag, fresh, pager) {
      const chain = (el, top) => { const out = []; for (let n = el; n && n !== top; n = n.parentNode) out.push(n); return out; };
      const a = chain(fresh, frag), b = chain(pager, this._root);
      if (a.length !== b.length || b[b.length - 1].parentNode !== this._root) return false;
      for (let i = 1; i < a.length; i++) if (a[i].tagName !== b[i].tagName) return false;
      const level = (from, to, keepFrom, keepTo) => {
        const before = [], after = [];
        let seen = false;
        for (const c of [...from.childNodes]) if (c === keepFrom) seen = true; else (seen ? after : before).push(c);
        for (const c of [...to.childNodes]) if (c !== keepTo) c.remove();
        keepTo.before(...before);
        keepTo.after(...after);
      };
      for (let i = a.length - 1; i >= 1; i--) {
        const n = a[i], o = b[i];
        for (const at of [...o.attributes]) if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
        for (const at of [...n.attributes]) if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
      }
      level(frag, this._root, a[a.length - 1], b[b.length - 1]);
      for (let i = a.length - 1; i >= 1; i--) level(a[i], b[i], a[i - 1], b[i - 1]);
      return true;
    }

    _unscroll(el) {
      if (!el || el.nodeType !== 1 || (!el.scrollTop && !el.scrollLeft)) return;
      const cs = getComputedStyle(el);
      const fixed = (v) => v === "hidden" || v === "clip";
      if (fixed(cs.overflowY) && el.scrollTop) el.scrollTop = 0;
      if (fixed(cs.overflowX) && el.scrollLeft) el.scrollLeft = 0;
    }

    // Other ovens' Stop buttons match the top Stop, whose width follows the main camera.
    _syncRows() {
      const root = this._root.querySelector(".d2-multi");
      if (!root) return;
      const col = root.querySelector(".d2-run .d2-camcol");
      if (col && col.offsetWidth) root.style.setProperty("--rowcamw", `${col.offsetWidth}px`);
      else root.style.removeProperty("--rowcamw");
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
      // An oven picked from the menu that this card does not list takes the first oven's place.
      let conf = this._ovenConf;
      if (this._focus && !this._ovens.includes(this._focus) && hass.states[this._focus]) conf = [{ entity: this._focus }, ...conf.slice(1)];
      const models = conf.map((o) => this._model(o, now));
      for (const m of models) if (this._busy[m.ids.climate] && !m.heating) delete this._busy[m.ids.climate];
      const f = this._focusIndex(models);
      const focus = models[f];
      const multi = models.length > 1;
      const theme = this._theme();
      const size = this._size;
      // The oven's clock shows the time without AM/PM.
      const cl = String(this._pref("clock"));
      const clock = new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit", hour12: cl === "12" ? true : cl === "24" ? false : undefined }).formatToParts(new Date(now))
        .filter((part) => part.type !== "dayPeriod").map((part) => part.value).join("").trim();
      const date = new Date(now).toLocaleDateString(lang, { weekday: "long", month: "long", day: "numeric" });

      // The name tucks only on the home screen (the mode tiles); in a cook it always shows. Coming back
      // home shows it again for 5 s.
      const home = focus.key === "off" && size !== "compact";
      if (home && this._wasHome === false) this._tuckLater();
      this._wasHome = home;
      const nb = { tucked: home && this._tucked && this._hideName(), open: !!(this._sheet && this._sheet.kind === "menu") };
      let body;
      if (size === "compact") body = compact(focus, { multi: false }, this._busy[focus.ids.climate]);
      else body = focus.key === "off" ? idle(focus, clock, date, this._page, size, nb, this._tiles(focus.ids.climate), this._grid(size, this._tiles(focus.ids.climate).length)) : run(focus, { size, multi, spark: size === "wall" ? this._spark(focus, now) : "" }, this._busy[focus.ids.climate], nb);
      this._multi = multi;
      this._focusId = focus.ids.climate;

      let rows = "";
      if (multi && size !== "compact") {
        const others = models.filter((_, i) => i !== f);
        const loud = others.filter((m) => m.heating || m.key === "done");
        const quiet = others.filter((m) => !(m.heating || m.key === "done"));
        rows = loud.map((m) => `<div class="d2-other" data-act="focus" data-oven="${esc(m.ids.climate)}" role="button" tabindex="0" aria-label="Show ${esc(m.name)}">${compact(m, { multi: true }, this._busy[m.ids.climate])}</div>`).join("") +
          (quiet.length ? `<div class="d2-other is-quiet" role="group" aria-label="Ovens that are off">${quiet.map((m) => `<button class="d2-quiet" data-act="focus" data-oven="${esc(m.ids.climate)}" aria-label="Show ${esc(m.name)}, off">${m.oic || svg("0 0 20 20", ST.off, "d2-sti")}<span class="d2-qn">${esc(m.name)}</span><span class="d2-qs">Off</span></button>`).join("")}</div>` : "");
      }
      const z = this._ui();
      const autoH = this._collapsed ? ` style="height:${this._panelH && size !== "compact" ? this._panelH : Math.round(z * (size === "compact" ? 56 : size === "wall" ? 504 : 376 + (multi ? 64 * (models.length - 1) : 0)))}px"` : "";
      this._clockText = clock;
      const html = `<ha-card${autoH}><div style="--isz:${ICON_SCALE[this._iconSize()]}" class="c-d2 d2-${theme} d2-${size}${focus.key === "off" ? " is-rest" : ""}${multi ? " d2-multi" : ""}"><div class="d2-pane">${body}</div>${rows}</div></ha-card>`;
      this._syncOver(theme, size);
      if (html === this._html) return;
      const pager = this.shadowRoot.querySelector(".d2-pager");
      const scroll = pager ? pager.scrollLeft : 0;
      this._html = html;
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      const fresh = tpl.content.querySelector(".d2-pager");
      // The clock and temperatures re-render the card often. An unchanged page of mode tiles stays
      // the same element, so its page, a swipe in progress and its momentum are never interrupted.
      if (pager && fresh && this._pagerHTML === fresh.outerHTML && this._graft(tpl.content, fresh, pager)) {
        this._syncRows();
      } else {
        this._root.replaceChildren(tpl.content);
        this._syncRows();
        const newPager = this.shadowRoot.querySelector(".d2-pager");
        this._pagerHTML = newPager ? newPager.outerHTML : "";
        if (newPager) {
          newPager.scrollLeft = scroll || this._page * newPager.clientWidth;
          newPager.addEventListener("scroll", () => {
            const i = Math.round(newPager.scrollLeft / Math.max(1, newPager.clientWidth));
            if (i !== this._page) { this._page = i; this._markPage(i); }
          }, { passive: true });
        }
      }
      this._placeCameras(models);
      if (this._nameOn) this._marquee(0);
    }

    // ---- temperature history for the wall graph ----
    _spark(m, now) {
      if (m.key === "offline" || !this._hass.callWS) return "";
      const id = m.ids.climate;
      // Done: the finished cook stays on the graph, up to the moment it finished.
      if (m.key === "done" && Number.isFinite(m.completed)) {
        let h = this._hist[id];
        if (!h || h.start >= m.completed) h = this._loadHistory(id, m.ids.probe, m.completed - 3600000);
        return spark(m, h, m.completed);
      }
      if (!m.heating) return "";
      const start = Number.isFinite(m.since) ? Math.max(now - 3600000, m.since) : now - 1800000;
      let h = this._hist[id];
      // A new cook, or the window has moved on: load Home Assistant's history again (at most every 2 min).
      if (!h || (Math.abs(h.start - start) > 90000 && now - h.at > 120000) || (!h.loading && h.failed && now - h.at > 120000)) h = this._loadHistory(id, m.ids.probe, start);
      // Between loads, the readings the card sees are added as they arrive.
      const add = (pts, v) => { if (v === null) return; const last = pts[pts.length - 1]; if (!last || last[1] !== v || now - last[0] > 60000) pts.push([now, v]); };
      add(h.cav, m.cur);
      if (m.ids.probe) add(h.food, m.probe);
      return spark(m, h, now);
    }

    _loadHistory(id, probeId, start) {
      const h = this._hist[id] = { start, at: Date.now(), cav: [], food: [], loading: true };
      const value = (v) => (v === null || v === undefined || v === "" ? NaN : +v);
      this._hass.callWS({
        type: "history/history_during_period", start_time: new Date(start).toISOString(),
        entity_ids: [id, probeId].filter(Boolean), minimal_response: false, no_attributes: false, significant_changes_only: false
      }).then((res) => {
        const rows = (eid) => (res && res[eid]) || [];
        const time = (r) => (r.lu || r.lc || 0) * 1000;
        let attrs = {};
        const cav = rows(id).map((r) => { if (r.a) attrs = r.a; return [time(r), value(attrs.current_temperature)]; }).filter(([t, v]) => t && Number.isFinite(v));
        const food = probeId ? rows(probeId).map((r) => [time(r), value(r.s)]).filter(([t, v]) => t && Number.isFinite(v)) : [];
        // Keep readings that arrived while loading.
        const after = (pts, last) => pts.filter(([t]) => t > last);
        h.cav = [...cav, ...after(h.cav, cav.length ? cav[cav.length - 1][0] : 0)];
        h.food = [...food, ...after(h.food, food.length ? food[food.length - 1][0] : 0)];
        h.loading = false;
        this._html = "";
        this._render();
      }).catch(() => { h.loading = false; h.failed = true; });
      return h;
    }

    // ---- cook history ----
    _loadCooks(oven) {
      const d = this._cooks[oven] = { ...(this._cooks[oven] || {}), loading: true, error: "" };
      const done = () => { if (this._sheet && this._sheet.kind === "history" && this._sheet.oven === oven) this._histRender(); };
      this._hass.callWS({ type: "june_oven/cook_history", entity_id: oven }).then((res) => {
        Object.assign(d, { loading: false, enabled: !!res.enabled, pictures: !!res.pictures, entry: res.entry_id, records: Array.isArray(res.records) ? res.records : [] });
        done();
        this._signPics(oven);
      }).catch((err) => {
        d.loading = false;
        d.error = err && err.code === "unknown_command" ? "Update the June Oven integration to 0.5.0 or later, then restart Home Assistant." : (err && err.message) || "Home Assistant didn't answer.";
        done();
      });
    }

    // Pictures are served to signed-in users only, so each one gets a signed link.
    _signPics(oven) {
      const d = this._cooks[oven], s = this._sheet;
      if (!d || !d.records || !s || s.kind !== "history") return;
      const want = s.open ? d.records.filter((r) => r.id === s.open) : d.records.slice(0, s.limit);
      want.filter((r) => r.picture && this._pics[r.id] === undefined).forEach((r) => {
        this._pics[r.id] = "";
        this._hass.callWS({ type: "auth/sign_path", path: `/api/june_oven/cook_picture/${d.entry}/${encodeURIComponent(r.id)}`, expires: 3600 })
          .then((res) => {
            this._pics[r.id] = res.path;
            const img = this._overEl.querySelector(`.d2-hr[data-id="${r.id}"] .d2-hr-pic`);
            if (img && !img.querySelector("img")) img.innerHTML = `<img src="${esc(res.path)}" alt="" loading="lazy">`;
            else if (this._sheet && this._sheet.open === r.id) this._histRender();
          })
          .catch(() => { delete this._pics[r.id]; });
      });
    }

    // The list leaves out each cook's temperature curve; it is fetched when the cook is opened.
    _loadCookCurve(r) {
      if (r.samples || r.curveLoading) return;
      r.curveLoading = true;
      const oven = this._sheet.oven;
      this._hass.callWS({ type: "june_oven/cook_history", entity_id: oven, record_id: r.id })
        .then((res) => { r.samples = (res.record && res.record.samples) || []; })
        .catch(() => { r.samples = []; })
        .finally(() => { r.curveLoading = false; if (this._sheet && this._sheet.open === r.id) this._histRender(); });
    }

    // Another thermometer's readings are not in the record: Home Assistant's history has them.
    _loadCookExt(r) {
      const o = this._conf(this._sheet.oven), probe = this._probeFor(o);
      if (!probe || (r.probe && r.probe.peak_c !== null) || this._cookExt[r.id] !== undefined) return;
      this._cookExt[r.id] = null;
      const t0 = Date.parse(r.started);
      this._hass.callWS({ type: "history/history_during_period", start_time: r.started, end_time: r.ended, entity_ids: [probe], minimal_response: true, no_attributes: true, significant_changes_only: false })
        .then((res) => {
          const pts = ((res && res[probe]) || []).map((x) => [((x.lu || x.lc || 0) * 1000 - t0) / 1000, Math.round(+x.s)]).filter(([t, v]) => Number.isFinite(v) && t > -60);
          this._cookExt[r.id] = pts.length ? pts : null;
          if (pts.length && this._sheet && this._sheet.open === r.id) this._histRender();
        }).catch(() => {});
    }

    _histRender() {
      const s = this._sheet;
      const list = this._overEl.querySelector(".d2-set-list");
      const top = list ? list.scrollTop : 0;
      this._renderOver();
      const again = this._overEl.querySelector(".d2-set-list");
      if (again && s) { again.scrollTop = s.jump !== undefined ? s.jump : top; delete s.jump; }
    }

    async _histAct(act, el) {
      const s = this._sheet, d = s && this._cooks[s.oven];
      if (!s || s.kind !== "history" || !d || !d.records) return;
      const list = this._overEl.querySelector(".d2-set-list");
      if (act === "hist-open") {
        s.listTop = list ? list.scrollTop : 0;
        s.open = el.dataset.id; s.confirm = null; s.jump = 0;
        const r = d.records.find((x) => x.id === s.open);
        if (r) { this._loadCookExt(r); this._loadCookCurve(r); }
        this._histRender();
        return this._signPics(s.oven);
      }
      if (act === "hist-back") { s.open = null; s.confirm = null; s.jump = s.listTop || 0; return this._histRender(); }
      if (act === "hist-more") { s.limit += HIST_PAGE; this._histRender(); return this._signPics(s.oven); }
      if (act === "hist-cancel") { s.confirm = null; return this._histRender(); }
      if (act === "hist-del" || act === "hist-clear") {
        const id = act === "hist-del" ? el.dataset.id : "all";
        if (s.confirm !== id) { s.confirm = id; return this._histRender(); }
        try {
          await this._hass.callWS({ type: "june_oven/cook_history/delete", entity_id: s.oven, ...(id === "all" ? {} : { record_id: id }) });
        } catch (err) {
          s.confirm = null; this._histRender();
          return this._toast(`Couldn't delete: ${(err && err.message) || "no answer from Home Assistant"}`);
        }
        d.records = id === "all" ? [] : d.records.filter((r) => r.id !== id);
        s.confirm = null;
        if (id !== "all") { s.open = null; s.jump = s.listTop || 0; }
        this._toast(id === "all" ? "History cleared" : "Cook deleted");
        return this._histRender();
      }
    }

    // ---- the Air fry fan: spins up on hover, then coasts to rest where it started ----
    // It stops on a whole third of a turn: the three blades look the same at 0°, 120° and 240°, so the
    // resting fan is drawn exactly as before. State is kept per oven, so a re-render mid-spin carries on.
    _fanHover(e, on) {
      if (e.type !== "pointerover" && e.type !== "pointerout") return;
      const tile = e.target.closest && e.target.closest('.d2-tile[data-mode="airfry"]');
      if (!tile || (e.relatedTarget && tile.contains(e.relatedTarget))) return;
      const fans = this._fans || (this._fans = {}), key = tile.dataset.oven;
      if (on && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!fans[key]) { if (!on) return; fans[key] = { a: 0, v: 0 }; }
      fans[key].on = on;
      fans[key].stop = null;
      if (!this._fanRaf) { this._fanT = performance.now(); this._fanRaf = requestAnimationFrame((t) => this._fanStep(t)); }
    }

    _fanStep(t) {
      const SPEED = 720, SPIN_UP = 0.35, COAST = 0.35; // deg/s at full speed; seconds to reach it; least coast
      const dt = Math.min(0.05, Math.max(0, (t - this._fanT) / 1000)), fans = this._fans || {};
      this._fanT = t;
      for (const key of Object.keys(fans)) {
        const f = fans[key];
        if (f.on) {
          f.v = Math.min(SPEED, f.v + (SPEED / SPIN_UP) * dt);
          f.a = (f.a + f.v * dt) % 360;
        } else {
          if (!f.stop) {
            // Ease out from the current speed (cubic: starting speed 3D/T) onto the next third of a turn.
            const target = Math.ceil((f.a + f.v * COAST) / 120 - 1e-6) * 120, D = target - f.a;
            f.stop = { a0: f.a, D, T: D < 0.01 ? 0 : Math.min(2, Math.max(0.3, (3 * D) / Math.max(f.v, 1))), s: 0 };
          }
          const st = f.stop;
          st.s += dt;
          const k = st.T ? Math.min(1, st.s / st.T) : 1, r = 1 - k;
          f.a = st.a0 + st.D * (1 - r * r * r);
          f.v = st.T ? ((3 * st.D) / st.T) * r * r : 0;
          if (k >= 1) f.done = true;
        }
        const tile = [...this.shadowRoot.querySelectorAll('.jo-root .d2-tile[data-mode="airfry"]')].find((x) => x.dataset.oven === key);
        const el = tile && tile.querySelector(".d2-fan");
        if (el) el.style.transform = f.done ? "" : `rotate(${f.a.toFixed(2)}deg)`;
        if (f.done) delete fans[key];
      }
      this._fanRaf = Object.keys(fans).length ? requestAnimationFrame((n) => this._fanStep(n)) : null;
    }

    // ---- the oven name, scrolled when it doesn't fit ----
    _nameHover(e, on) {
      const btn = e.target.closest && e.target.closest(".d2-ovb");
      if (!btn) return;
      if (!on && e.relatedTarget && btn.contains(e.relatedTarget)) return;
      if (on && this._nameOn === btn) return;
      clearTimeout(this._marqTimer);
      if (this._nameOn) this._nameOn.classList.remove("is-marquee");
      this._nameOn = on ? btn : null;
      // A tucked name opens first (0.5 s); measure once it has.
      if (on) this._marquee(btn.classList.contains("is-tucked") ? 550 : 0);
    }

    _marquee(wait) {
      clearTimeout(this._marqTimer);
      this._marqTimer = setTimeout(() => {
        if (!this._nameOn) return;
        // After a re-render the button is a new element; follow the one in the same place.
        if (!this._nameOn.isConnected) this._nameOn = this.shadowRoot.querySelector(this._nameOn.closest(".jo-over") ? ".jo-over .d2-ovb" : ".jo-root .d2-ovb");
        const btn = this._nameOn, nm = btn && btn.querySelector(".d2-nm");
        if (!nm || btn.classList.contains("is-marquee")) return;
        const over = nm.scrollWidth - nm.clientWidth;
        if (over < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        nm.style.setProperty("--nm-shift", `${-over}px`);
        // About 40 px a second, so a long name doesn't race past.
        nm.style.setProperty("--nm-dur", `${Math.max(1.6, over / 40 + 1.2).toFixed(2)}s`);
        btn.classList.add("is-marquee");
      }, wait);
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
      if (document.hidden || !this._liveCams || (this._sheet && this._sheet.kind === "camera")) return;
      for (const id of Object.keys(this._imgs)) this._loadStill(id, false);
    }

    // ---- settings ----
    // Home Assistant can attach the card before it gets its config (while the card is still being
    // defined on a new registry), so this answers before setConfig too.
    _pref(k) {
      const prefs = this._prefs || {}, config = this._config || {};
      return prefs[k] !== undefined ? prefs[k] : config[k];
    }

    _theme() {
      const t = this._pref("theme");
      return ["light", "dark"].includes(t) ? t : "auto";
    }

    _hideName() {
      const v = this._pref("hide_name");
      return v !== false && v !== "false";
    }

    _fps() {
      const v = +this._pref("camera_fps");
      return Number.isFinite(v) && v > 0 ? Math.min(15, Math.max(0.1, v)) : 15;
    }

    // Columns and rows of cook modes: 0 is automatic.
    _gridPref(k, max) {
      const v = parseInt(this._pref(k), 10);
      return Number.isFinite(v) && v > 0 ? Math.min(max, v) : 0;
    }

    _grid(size, n) {
      return gridFor(size, n, this._gridPref("columns", MAX_COLS), this._gridPref("rows", MAX_ROWS));
    }

    _layoutInfo(oven) {
      const tiles = this._tiles(oven);
      const size = this._size === "wall" ? "wall" : "standard";
      const g = this._grid(size, tiles.length);
      const colsSet = this._gridPref("columns", MAX_COLS) > 0, rowsSet = this._gridPref("rows", MAX_ROWS) > 0;
      return { ...g, colsSet, rowsSet, auto: !colsSet && !rowsSet, tiles, clock: this._clockText || "" };
    }

    // Card size: 80-150 %.
    _ui() {
      const v = +this._pref("scale");
      return Number.isFinite(v) && v > 0 ? Math.min(150, Math.max(80, v)) / 100 : 1;
    }

    _iconSize() {
      const v = String(this._pref("icon_size"));
      return ICON_SCALE[v] ? v : "large";
    }

    // Cooks started from the card, per oven and mode. Kept apart from the settings, so Reset keeps them.
    _uses() {
      try { const u = JSON.parse(localStorage.getItem(USES_KEY)); return u && typeof u === "object" ? u : {}; } catch (e) { return {}; }
    }

    _countUse(oven, mode) {
      const u = this._uses();
      u[oven] = u[oven] || {};
      u[oven][mode] = (u[oven][mode] || 0) + 1;
      try { localStorage.setItem(USES_KEY, JSON.stringify(u)); } catch (e) { /* private window: not counted */ }
    }

    // Mode tiles: the oven's order, or most used first (ties keep the oven's order). Camera and Settings stay last.
    _tiles(oven) {
      if (this._pref("mode_order") !== "used") return TILES;
      const n = this._uses()[oven] || {};
      const modes = STARTABLE.map((t, i) => [t, i]).sort((a, b) => (n[b[0][0]] || 0) - (n[a[0][0]] || 0) || a[1] - b[1]).map(([t]) => t);
      return [...modes, ...TILES.filter(([k]) => UTIL.includes(k))];
    }

    _savePrefs() {
      try { localStorage.setItem(this._prefsKey, JSON.stringify(this._prefs)); } catch (e) { /* private window: not remembered */ }
    }

    _restartCamTimer() {
      clearInterval(this._camTimer);
      // The small pictures on the card refresh at most once a second (the oven's own rate); only the
      // camera window runs faster.
      this._camTimer = setInterval(() => this._refreshCameras(), Math.max(1000, 1000 / this._fps()));
    }

    // ---- ovens ----
    _conf(entity) {
      return this._ovenConf.find((o) => o.entity === entity) || { entity };
    }

    _model(o, now = Date.now()) {
      const hass = this._hass;
      let ids = ovenEntities(hass, o.entity);
      // Another thermometer for food temperature: its readings replace the June probe's, and the
      // card's food target, if set, stands in for the probe target.
      const ext = this._probeFor(o);
      if (ext) ids = { ...ids, probe: ext, probeTarget: null };
      const food = ext ? { target: this._foodTarget() } : null;
      return ovenModel(hass, ids, ovenName(hass, ids, o), now, this._dismissed[o.entity], this._prefs.icons[o.entity] || o.icon, food);
    }

    // The food probe chosen in Settings for this oven, else the config's `probe`; "" is the June probe.
    _probeFor(o) {
      const p = this._prefs.probes || {};
      const v = Object.prototype.hasOwnProperty.call(p, o.entity) ? p[o.entity] : o.probe || this._pref("food_sensor");
      return typeof v === "string" && v.startsWith("sensor.") ? v : "";
    }

    // The food target for another thermometer, in the card's unit (food_target), or null.
    _foodTarget() {
      const v = this._pref("food_target");
      return v !== null && v !== undefined && v !== "" && Number.isFinite(+v) && +v > 0 ? +v : null;
    }

    // Every June oven in Home Assistant: the card's own first, then the rest.
    _allOvens() {
      const found = Object.values(this._hass.entities || {})
        .filter((e) => e.platform === DOMAIN && e.entity_id.startsWith("climate.") && this._hass.states[e.entity_id])
        .map((e) => e.entity_id).sort();
      return [...this._ovens, ...found.filter((id) => !this._ovens.includes(id))].map((id) => this._conf(id));
    }

    _focusedOven() {
      return this._focusId || this._ovens[0];
    }

    // The name shows for 5 s, then tucks into the icon (it comes back on hover, focus, or with the menu).
    _showName() {
      const was = this._tucked;
      this._tuckLater();
      if (was) { this._html = ""; this._render(); }
    }

    _tuckLater() {
      clearTimeout(this._tuckTimer);
      this._tucked = false;
      this._tuckTimer = setTimeout(() => {
        this._tucked = true;
        // Tuck the home screen's button in place so it animates; the next render carries the same class.
        if (this._hideName()) this.shadowRoot.querySelectorAll(".d2-idle .d2-ovb").forEach((b) => b.classList.add("is-tucked"));
      }, TUCK_MS);
    }

    // ---- sheets ----
    _openSheet(sheet) {
      this._closeSheet(true);
      this._sheet = sheet;
      this._html = "";
      this._render();
      this._renderOver();
    }

    _closeSheet(quiet) {
      const was = this._sheet;
      clearTimeout(this._reviewTimer);
      clearTimeout(this._cvTimer);
      this._sheet = null;
      if (quiet) return;
      this._html = "";
      this._render();
      this._renderOver();
      // Back to what opened the sheet, for keyboards.
      const back = was && this.shadowRoot.querySelector(was.kind === "menu" ? ".d2-ovb" : was.kind === "review" ? `.d2-tile[data-mode="${was.mode}"]` : `.d2-tile[data-act="${was.kind}"], .d2-cam`);
      if (back && was.byKey) back.focus();
    }

    _syncOver(theme, size) {
      const el = this._overEl;
      el.className = `jo-over c-d2 d2-${theme} d2-${size}`;
      if (this._sheet && (size === "compact" || !this._hass.states[this._sheet.oven])) { this._sheet = null; this._renderOver(); }
    }

    _renderOver() {
      const el = this._overEl, s = this._sheet;
      if (!s || !this._hass || !this._config) { el.hidden = true; el.innerHTML = ""; return; }
      el.className = `jo-over c-d2 d2-${this._theme()} d2-${this._size}`;
      el.dataset.kind = s.kind;
      el.hidden = false;
      const now = Date.now();
      const m = this._model(this._conf(s.oven), now);
      if (s.kind === "review") el.innerHTML = review(s, m.name, m.unit, now, this._multi);
      else if (s.kind === "settings") el.innerHTML = settingsSheet({ theme: this._theme(), camera_fps: this._fps(), hide_name: this._hideName(), clock: String(this._pref("clock")), mode_order: this._pref("mode_order") === "used" ? "used" : "oven", layout: this._layoutInfo(s.oven), scale: Math.round(this._ui() * 100), icon_size: this._iconSize(), food: { target: this._foodTarget() !== null ? String(this._foodTarget()) : "", stop: this._pref("food_auto_stop") ? "true" : "false" } }, m,
        this._allOvens().map((o) => ({ m: this._model(o, now), icon: this._prefs.icons[o.entity] || o.icon, probe: this._probeFor(o) })), s.iconFor || s.oven, probeChoices(this._hass));
      else if (s.kind === "camera") el.innerHTML = cameraSheet(m);
      else if (s.kind === "history") el.innerHTML = historySheet(s, m, this._cooks[s.oven], this._pics, this._cookExt, (this._hass.locale && this._hass.locale.language) || this._hass.language || undefined);
      else if (s.kind === "menu") el.innerHTML = menuSheet(this._allOvens().map((o) => this._model(o, now)), s.oven, s.pos);
      const first = el.querySelector(s.kind === "menu" ? '.d2-mi[aria-checked="true"]' : ".d2-icbtn");
      if (first && s.byKey) first.focus();
      if (s.kind === "camera") this._cvFrame();
    }

    _openMenu(btn, byKey) {
      const z = this._ui(), host = this.getBoundingClientRect(), r = btn.getBoundingClientRect();
      const w = host.width / z, x = Math.max(8, Math.min((r.left - host.left) / z - 4, w - 268));
      const y = (r.bottom - host.top) / z + 6;
      this._openSheet({ kind: "menu", oven: this._focusedOven(), byKey, pos: { x: Math.round(x), y: Math.round(y), h: Math.max(96, Math.round(host.height / z - y - 8)) } });
    }

    // Camera window: pictures from Home Assistant's camera proxy at the chosen frame rate.
    _cvFrame() {
      const s = this._sheet;
      if (!s || s.kind !== "camera") return;
      clearTimeout(this._cvTimer);
      const el = this._overEl;
      // A failed picture is retried every 5 s, not at the frame rate.
      const next = (wait = 1000 / this._fps()) => { if (this._sheet === s) this._cvTimer = setTimeout(() => this._cvFrame(), Math.max(0, wait - (Date.now() - t0))); };
      const t0 = Date.now();
      const m = this._model(this._conf(s.oven), t0);
      const st = m.ids.camera && this._hass.states[m.ids.camera];
      const show = (title, text) => {
        const msg = el.querySelector(".d2-cv-msg"), pill = el.querySelector(".d2-cv-pill");
        if (!msg) return;
        msg.hidden = !title;
        if (title) { msg.querySelector("b").textContent = title; msg.querySelector("span").textContent = text; }
        if (pill) {
          pill.hidden = !s.shown;
          pill.textContent = s.ok ? "LIVE" : s.shown ? `Picture from ${new Date(s.shown).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "";
          pill.classList.toggle("is-old", !s.ok);
        }
      };
      if (!st || !st.attributes.entity_picture) { show("No camera", "This oven has no camera in Home Assistant."); return; }
      if (document.hidden) return next();
      const base = st.attributes.entity_picture;
      const img = new Image();
      img.onload = () => {
        if (this._sheet !== s) return;
        const view = el.querySelector(".d2-cv-img");
        if (view) view.src = img.src;
        s.ok = true; s.shown = Date.now();
        show("", "");
        next();
      };
      img.onerror = () => {
        if (this._sheet !== s) return;
        s.ok = false;
        // Home Assistant answers 503 while the camera is off and 500 when the oven has no picture.
        if (!s.shown) show(m.heating ? "Waiting for a picture" : "Camera off", m.heating ? "The oven hasn't sent a picture yet." : "The oven's camera runs while it heats.");
        else show("", "");
        next(Math.max(5000, 1000 / this._fps()));
      };
      img.src = `${base}${base.includes("?") ? "&" : "?"}_t=${t0}`;
    }

    _handleClick(e) {
      const el = e.target.closest("[data-act]");
      if (!el || el.disabled) return;
      const act = el.dataset.act, oven = el.dataset.oven;
      const hass = this._hass;
      const byKey = e.detail === 0;
      if (act === "stop") return this._stop(oven);
      if (act === "add") return this._call("june_oven", "add_cook_time", { minutes: +el.dataset.min }, oven, `Added ${el.dataset.min} min`);
      if (act === "dismiss") { this._dismissed[oven] = +el.dataset.completed; this._html = ""; return this._render(); }
      if (act === "focus" || act === "pick") {
        this._focus = oven;
        try { localStorage.setItem(this._focusKey, oven); } catch (err) { /* private window: not remembered */ }
        if (act === "pick") { this._closeSheet(true); this._renderOver(); this._showName(); }
        this._html = "";
        return this._render();
      }
      if (act === "menu") return this._sheet && this._sheet.kind === "menu" ? this._closeSheet() : this._openMenu(el, byKey);
      if (act === "sheet-close") return this._closeSheet();
      if (act === "more") return this._moreInfo(oven);
      if (act === "camera") {
        // The one-row card is too small for a window: Home Assistant's camera dialog instead.
        if (this._size === "compact") { const ids = ovenEntities(hass, oven); return this._moreInfo(ids.camera || oven); }
        return this._openSheet({ kind: "camera", oven, byKey });
      }
      if (act === "page") {
        const pager = this.shadowRoot.querySelector(".d2-pager");
        this._page = +el.dataset.i;
        if (pager) pager.scrollLeft = this._page * pager.clientWidth;
        this.shadowRoot.querySelectorAll(".d2-dot").forEach((d, j) => (j === this._page ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
        return;
      }
      if (act === "settings") return this._openSheet({ kind: "settings", oven, byKey });
      if (act === "history") { this._openSheet({ kind: "history", oven, byKey, open: null, limit: HIST_PAGE, confirm: null }); return this._loadCooks(oven); }
      if (act.startsWith("hist-")) return this._histAct(act, el);
      if (act === "set") return this._setPref(el.dataset.k, el.dataset.v, oven);
      if (act === "set-iconfor") { this._sheet.iconFor = this._sheet.iconFor === oven || (!this._sheet.iconFor && this._sheet.oven === oven) ? "-" : oven; return this._prefsChanged(true); }
      if (act === "set-reset") { this._prefs = { icons: {}, probes: {} }; this._hist = {}; this._measure(); return this._prefsChanged(); }
      if (act === "lay") {
        const l = this._layoutInfo(oven), k = el.dataset.k;
        const v = Math.max(1, Math.min(k === "cols" ? MAX_COLS : MAX_ROWS, l[k] + +el.dataset.d));
        this._prefs[k === "cols" ? "columns" : "rows"] = v;
        // Fixing one keeps the other as it looks now.
        const other = k === "cols" ? "rows" : "columns";
        if (!this._gridPref(other, other === "rows" ? MAX_ROWS : MAX_COLS)) this._prefs[other] = k === "cols" ? l.rows : l.cols;
        this._page = 0;
        return this._prefsChanged();
      }
      if (act === "lay-auto") { this._prefs.columns = "auto"; this._prefs.rows = "auto"; this._page = 0; return this._prefsChanged(); }
      if (act === "set-ha") {
        const ids = ovenEntities(hass, oven);
        this._closeSheet();
        if (!ids.deviceId) return this._moreInfo(oven);
        history.pushState(null, "", `/config/devices/device/${ids.deviceId}`);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
        return;
      }
      if (act === "tile") return this._openReview(oven, el.dataset.mode, byKey);
      if (act === "rv-dec" || act === "rv-inc") return this._setTemp(this._sheet && this._sheet.temp + (act === "rv-inc" ? 1 : -1) * this._sheet.step);
      if (act === "toast-dec" || act === "toast-inc") return this._toastLevel(act === "toast-inc" ? 1 : -1);
      if (act === "grill-heat") return this._grillHeat(+el.dataset.v);
      if (act === "tm-dec" || act === "tm-inc") {
        const t = (this._sheet && this._sheet.timer) || 60;
        return this._timerSet(act === "tm-inc" ? (t < 5 ? 5 : t + 5) : Math.max(1, t - 5));
      }
      if (act === "timer-set") return this._timerSet(+el.dataset.min);
      if (act === "rv-start") return this._start();
    }

    _handleInput(e) {
      const r = this._sheet;
      if (r && r.kind === "settings" && e.target.matches(".d2-ui")) {
        // Card size applies while dragging; the sheet itself is redrawn when the slider is let go.
        const v = +e.target.value;
        this._prefs.scale = v;
        e.target.style.setProperty("--p", (v - 80) / 70);
        const out = e.target.parentElement.querySelector(".d2-scale-v");
        if (out) out.textContent = `${v}%`;
        this._savePrefs();
        this._measure();
        this._html = "";
        return this._render();
      }
      if (!r || r.kind !== "review") return;
      if (e.target.matches(".d2-timer-range")) return this._timerSet(+e.target.value);
      if (e.target.matches(".d2-timer-in, .d2-timer-h")) {
        const t = e.target.value.replace(/\D/g, "");
        if (t !== e.target.value) e.target.value = t;
        if (e.target.matches(".d2-timer-h")) e.target.classList.toggle("is-wide", t.length > 1);
        const v = this._timerTyped();
        if (v >= 1 && v <= 600) this._timerSet(v, e.target);
        return;
      }
      if (e.target.matches(".d2-level-range")) return this._toastLevel(+e.target.value - (r.level || 5));
      if (e.target.matches(".d2-temp-range")) return this._setTemp(+e.target.value);
      if (e.target.matches(".d2-temp-in")) {
        // Digits only while typing; the slider follows any value in range, the number snaps on Enter or leaving.
        const t = e.target.value.replace(/\D/g, "").slice(0, 3);
        if (t !== e.target.value) e.target.value = t;
        const v = parseInt(t, 10);
        if (v >= r.min && v <= r.max) this._setTemp(v, true);
      }
    }

    _handleChange(e) {
      if (e.target.matches(".d2-ui")) return this._prefsChanged();
      if (e.target.matches(".d2-probe")) {
        const oven = e.target.dataset.oven;
        this._prefs.probes[oven] = e.target.value;
        delete this._hist[oven];
        return this._prefsChanged();
      }
      if (e.target.matches(".d2-temp-in")) this._commitTyped(e.target);
      if (e.target.matches(".d2-timer-in, .d2-timer-h")) {
        const v = this._timerTyped();
        this._timerSet(v >= 1 && v <= 600 ? v : (this._sheet && this._sheet.timer) || 60);
        return;
      }
      if (e.target.matches(".d2-mdi")) {
        const v = e.target.value.trim().toLowerCase();
        if (/^mdi:[a-z0-9-]+$/.test(v)) this._setPref("icon", v, e.target.dataset.oven);
        else if (!v) this._setPref("icon", "oven", e.target.dataset.oven);
        else e.target.value = e.target.defaultValue;
      }
      if (e.target.matches(".d2-foodin")) {
        const k = e.target.dataset.k;
        if (k === "food_target") {
          const v = parseInt(e.target.value, 10);
          if (Number.isFinite(v) && v > 0) this._setPref(k, v);
          // Cleared: no target, whatever the YAML says.
          else if (!e.target.value.trim()) { this._prefs[k] = ""; this._prefsChanged(); }
          else e.target.value = this._foodTarget() !== null ? String(this._foodTarget()) : "";
        } else {
          this._setPref(k, e.target.value.trim());
        }
        return;
      }
    }

    _handleKey(e) {
      if (!this._sheet) return;
      const t = e.composedPath()[0];
      if (t && t.matches && t.matches(".d2-temp-in") && this._overEl.contains(t)) {
        if (e.key === "Enter") { this._commitTyped(t); t.blur(); }
        if (e.key === "Escape") { t.value = this._sheet.temp; t.blur(); }
        return;
      }
      if (t && t.matches && t.matches(".d2-mdi") && e.key === "Enter") return t.blur();
      if (t && t.matches && t.matches(".d2-foodin") && e.key === "Enter") return t.blur();
      if (t && t.matches && t.matches(".d2-timer-in, .d2-timer-h") && e.key === "Enter") return t.blur();
      if (e.key === "Escape") { this._sheet.byKey = this.shadowRoot.activeElement !== null; this._closeSheet(); }
    }

    _setPref(k, v, oven) {
      if (k === "icon") {
        if (oven) this._prefs.icons[oven] = v;
      } else if (k === "camera_fps") this._prefs[k] = +v;
      else if (k === "hide_name") this._prefs[k] = v === "true";
      else if (k === "food_auto_stop") this._prefs[k] = v === "true";
      else if (k === "food_target") this._prefs[k] = +v;
      else this._prefs[k] = v;
      this._prefsChanged();
    }

    _prefsChanged(viewOnly) {
      if (!viewOnly) {
        this._savePrefs();
        this._restartCamTimer();
        if (this._hideName()) this._showName(); else { clearTimeout(this._tuckTimer); this._tucked = false; }
        this._html = "";
        this._render();
      }
      const sheet = this._sheet;
      const scroll = this._overEl.querySelector(".d2-set-list");
      const top = scroll ? scroll.scrollTop : 0;
      this._renderOver();
      const again = this._overEl.querySelector(".d2-set-list");
      if (again && sheet) again.scrollTop = top;
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

    _openReview(oven, mode, byKey) {
      const c = this._hass.states[oven];
      const step = (c && +c.attributes.target_temp_step) || 5;
      const min = (c && +c.attributes.min_temp) || 100, max = (c && +c.attributes.max_temp) || 500;
      const r = { kind: "review", oven, mode, step, min, max, temp: 350, fixed: false, level: 5, timer: null, until: Date.now() + REVIEW_MS, byKey };
      if (mode in FIXED_TEMPS) {
        r.fixed = true;
        r.temp = FIXED_TEMPS[mode];
      } else {
        const mt = MODE_TEMP[mode];
        if (mt) { r.min = mt.min; r.max = mt.max; }
        // The oven's last target, when it fits this mode's range; otherwise the mode's usual temperature.
        const last = c && c.attributes.temperature !== null && Number.isFinite(+c.attributes.temperature) ? +c.attributes.temperature : null;
        r.temp = snap(r, last !== null && last >= r.min && last <= r.max ? last : (mt ? mt.def : 350));
      }
      if (mode === "toast") {
        const ids = ovenEntities(this._hass, oven);
        const lv = ids.toastLevel && this._hass.states[ids.toastLevel];
        if (lv && Number.isFinite(+lv.state)) r.level = Math.min(9, Math.max(1, +lv.state));
      }
      if (mode === "grill") {
        const ids = ovenEntities(this._hass, oven);
        const gh = ids.grillHeat && this._hass.states[ids.grillHeat];
        r.grill = gh && Number.isFinite(+gh.state) ? Math.min(2, Math.max(0, +gh.state)) : 0;
        r.temp = GRILL_TEMP[r.grill];
      }
      if (mode === "reheat") r.timer = 60;
      this._openSheet(r);
      this._setTemp(r.temp);
      const tick = () => {
        if (this._sheet !== r) return;
        const left = r.until - Date.now();
        if (left <= 0) return this._closeSheet();
        const el = this._overEl.querySelector(".d2-sh-left");
        if (el) el.textContent = duration(left / 1000);
        this._reviewTimer = setTimeout(tick, 1000 - (left % 1000) + 5);
      };
      tick();
    }

    // Number, slider and − / + stay in step; updated in place so a drag or typing is never interrupted.
    _setTemp(v, typing) {
      const r = this._sheet;
      if (!r || r.kind !== "review" || !Number.isFinite(v)) return;
      r.temp = snap(r, v);
      const range = this._overEl.querySelector(".d2-temp-range"), input = this._overEl.querySelector(".d2-temp-in");
      if (range) { range.value = r.temp; range.style.setProperty("--p", fill(r)); }
      if (input && !typing) input.value = r.temp;
      // Only the temperature's − / +: the toast level has its own.
      this._overEl.querySelectorAll('.d2-round[data-act^="rv-"]').forEach((b) => { b.disabled = b.dataset.act === "rv-dec" ? r.temp <= r.min : r.temp >= r.max; });
    }

    _commitTyped(input) {
      const v = parseInt(input.value, 10);
      if (Number.isFinite(v)) this._setTemp(v);
      input.value = this._sheet ? this._sheet.temp : input.value;
    }

    // Minutes from the timer fields: hours (when shown) and minutes; an empty field counts as 0.
    _timerTyped() {
      const o = this._overEl, v = o && o.querySelector(".d2-timer-v");
      if (!v) return NaN;
      const n = (sel) => parseInt(o.querySelector(sel).value, 10) || 0;
      return (v.classList.contains("has-h") ? n(".d2-timer-h") * 60 : 0) + n(".d2-timer-in");
    }

    // typing: the field being typed in. It and the hours/minutes split stay as they are until the
    // field is left, so "90" typed into minutes becomes "1 hr 30 min" only then.
    _timerSet(min, typing) {
      const r = this._sheet;
      if (!r || r.kind !== "review") return;
      r.timer = Math.min(600, Math.max(1, Math.round(min)));
      const range = this._overEl.querySelector(".d2-timer-range");
      if (range) { range.value = r.timer; range.style.setProperty("--p", (r.timer - 1) / 599); }
      const v = this._overEl.querySelector(".d2-timer-v");
      if (v && !typing) {
        const [h, m] = timerParts(r.timer);
        v.classList.toggle("has-h", r.timer >= 60);
        v.querySelector(".d2-timer-h").value = h;
        v.querySelector(".d2-timer-h").classList.toggle("is-wide", h >= 10);
        v.querySelector(".d2-timer-in").value = m;
      }
      this._overEl.querySelectorAll('.d2-round[data-act^="tm-"]').forEach((b) => { b.disabled = b.dataset.act === "tm-dec" ? r.timer <= 1 : r.timer >= 600; });
    }

    async _grillHeat(v) {
      const r = this._sheet;
      if (!r || r.kind !== "review" || r.mode !== "grill") return;
      const ids = ovenEntities(this._hass, r.oven);
      if (!ids.grillHeat) return;
      r.grill = Math.min(2, Math.max(0, v));
      r.temp = GRILL_TEMP[r.grill];
      this._renderOver();
      await this._call("number", "set_value", { value: r.grill }, ids.grillHeat);
    }

    async _toastLevel(d) {
      const r = this._sheet;
      if (!r || r.kind !== "review" || r.mode !== "toast") return;
      const ids = ovenEntities(this._hass, r.oven);
      if (!ids.toastLevel) return;
      r.level = Math.min(9, Math.max(1, (r.level || 5) + d));
      // In place, so dragging the slider is never interrupted; the oven's setting follows once it settles.
      const o = this._overEl, lv = o.querySelector(".d2-sh-lv"), range = o.querySelector(".d2-level-range");
      if (lv) lv.textContent = r.level;
      if (range) { range.value = r.level; range.style.setProperty("--p", ((r.level - 1) / 8).toFixed(4)); }
      o.querySelectorAll('.d2-round[data-act^="toast-"]').forEach((b) => { b.disabled = b.dataset.act === "toast-dec" ? r.level <= 1 : r.level >= 9; });
      clearTimeout(this._levelTimer);
      const level = r.level;
      this._levelSend = () => { clearTimeout(this._levelTimer); this._levelSend = null; return this._call("number", "set_value", { value: level }, ids.toastLevel); };
      this._levelTimer = setTimeout(this._levelSend, 250);
    }

    async _start() {
      const r = this._sheet;
      if (!r || r.kind !== "review" || r.busy) return;
      const input = this._overEl.querySelector(".d2-temp-in");
      if (input) this._commitTyped(input);
      // A toast level picked a moment ago reaches the oven before the start.
      if (this._levelSend) await this._levelSend();
      r.busy = true;
      this._renderOver();
      const c = this._hass.states[r.oven];
      const steps = [];
      if (!c || c.attributes.preset_mode !== r.mode) steps.push(["set_preset_mode", { preset_mode: r.mode }]);
      steps.push(["set_temperature", { temperature: r.temp }], ["turn_on", {}]);
      for (const [service, data] of steps) {
        if (!(await this._call("climate", service, data, r.oven))) { r.busy = false; if (this._sheet === r) this._renderOver(); return; }
      }
      if (r.timer) await this._call("june_oven", "set_timer", { minutes: r.timer }, r.oven);
      this._countUse(r.oven, r.mode);
      this._toast(r.timer ? `Started with a ${r.timer} min timer` : `Preheating to ${r.temp}°`);
      if (this._sheet === r) this._closeSheet();
    }
  }

  const CSS = `.c-d2{--sheen-a:118deg;--f:'Barlow Semi Condensed','Barlow',system-ui,sans-serif;--fn:'Barlow Condensed','Barlow',system-ui,sans-serif;position:relative;width:100%;height:100%;box-sizing:border-box;overflow:hidden;overflow:clip;font-family:var(--f);color:var(--fg);border-radius:var(--ha-card-border-radius,12px);
  background:linear-gradient(var(--sheen-a),transparent 0 63%,var(--sheen) 63.4%,transparent 84%),linear-gradient(180deg,var(--bg) 0%,var(--bg2) 100%);box-shadow:inset 0 0 0 1px var(--rim);-webkit-font-smoothing:antialiased}
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
.c-d2.d2-standard{--lift:8cqh;--slh:26px;--px:16px;--py:16px;--camw:34cqw;--cg:16px;--rg:12px;--hs:min(26cqw,27cqh);--hts:min(9.5cqw,14cqh);--clock:min(15cqw,19cqh);--camoff:max(64px,16cqw);--tgap:clamp(10px,3.4cqw,20px);--tmax:104px}
.c-d2.d2-wall{--lift:0px;--slh:36px;--px:28px;--py:28px;--camw:30cqw;--cg:40px;--rg:20px;--hs:min(15cqw,25cqh);--hts:min(9cqw,16cqh);--clock:min(12cqw,19cqh);--camoff:min(11cqw,120px);--tgap:clamp(16px,3.4cqw,28px);--tmax:132px}
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
/* Standard: the camera spans from the top of the degree sign to the foot of the bar, so its size
   follows the number group (number, status line, gap, bar: --hs * .793 + --k). The number gives up
   at most 10% of its old size to make that fit; past that the camera keeps its foot on the bar and
   starts lower. The camera never takes the number's room: 1.84em is "12:30", the widest number. */
.c-d2.d2-standard .d2-run{--k:calc(var(--slh) + var(--rg) + 6px);--w:calc(100cqw - 2 * var(--px) - var(--cg) - 4px);
  --hsn:min(26cqw,27cqh,calc((66cqw - 2 * var(--px) - var(--cg) - 4px) / 1.84));
  --hs:min(var(--hsn),max(calc(var(--hsn) * .9),calc((var(--w) - var(--k) * 4 / 3) / 2.897)));
  --camw:min(calc((var(--hs) * .793 + var(--k)) * 4 / 3),calc(var(--w) - var(--hs) * 1.84))}
.c-d2.d2-standard .d2-camcol{grid-row:3/5;align-self:end;margin-top:0}
.c-d2 .d2-hero.is-long{font-size:calc(var(--hs) * .75);line-height:calc(var(--hs) * .84)}
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
.c-d2 .d2-cam{position:relative;display:block;width:100%;aspect-ratio:4/3;border-radius:12px;overflow:hidden;isolation:isolate;background:var(--win)}
/* The camera's edge matches the tiles: a faint ring drawn inside, above the picture, so the rounded
   clip can't shave it unevenly. Corners match the Stop button above. */
.c-d2 .d2-cam:not(.is-off)::after{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px var(--uRim),inset 0 1px 0 var(--tSheen)}
/* No picture yet (or offline): hide the empty image, or Chrome outlines it as a missing image. */
.c-d2 .d2-win img:not([src]){display:none}
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
.c-d2 .d2-spark polyline{fill:none;stroke:var(--ember);stroke-width:2.5;stroke-linejoin:round;filter:drop-shadow(0 0 3px var(--glow))}
.c-d2 .d2-spark polyline.sp-food{stroke:var(--food);filter:none}
.c-d2 .d2-spark .sp-tgt{stroke:var(--fg2);stroke-width:1;stroke-dasharray:4 4;opacity:.7}
.c-d2 .d2-plot{flex:1 1 auto;min-height:0;container:d2plot/size;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;column-gap:8px;padding-top:7px;font:400 12px/14px var(--f);color:var(--fg2);font-variant-numeric:tabular-nums;white-space:nowrap}
.c-d2 .d2-py{position:relative;grid-row:1;grid-column:1;text-align:right}
.c-d2 .d2-py i{display:block;height:0;overflow:hidden;visibility:hidden;font-style:normal}
.c-d2 .d2-py span{position:absolute;right:0;transform:translateY(-50%)}
.c-d2 .d2-py span.is-tgt{color:var(--fg);font-weight:600}
@container d2plot (max-height:120px){.c-d2 .d2-py span.is-odd{display:none}}
@container d2plot (max-height:76px){.c-d2 .d2-py span.is-mid{display:none}}
.c-d2 .d2-plot svg{grid-row:1;grid-column:2;display:block;width:100%;height:100%;min-height:24px;overflow:visible}
.c-d2 .d2-plot .sp-grid{stroke:var(--line);stroke-width:1}
.c-d2 .d2-px{grid-row:2;grid-column:2;position:relative;height:14px;margin-top:5px}
.c-d2 .d2-px span{position:absolute;top:0;transform:translateX(-50%)}
.c-d2 .d2-px span.is-start{transform:none}
.c-d2 .d2-px span.is-end{transform:translateX(-100%)}
.c-d2 .d2-sp-cap{display:flex;align-items:center;gap:14px;margin-top:6px;font:400 15px/18px var(--f);color:var(--fg2);white-space:nowrap}
.c-d2 .d2-sp-key{display:inline-flex;align-items:center;gap:6px}
.c-d2 .d2-sp-key i{width:12px;height:3px;border-radius:2px;background:var(--ember)}
.c-d2 .d2-sp-key.k-food i{background:var(--food)}
.c-d2 .d2-sp-span{margin-left:auto}
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
/* Under the camera to the bottom edge: the camera's top margin, its 4:3 height and a gap, then the graph fills the rest. */
.c-d2.d2-wall .d2-spcol{grid-column:2;grid-row:3/7;min-width:0;min-height:0;display:flex;flex-direction:column;padding-top:calc(var(--hs) * .047 + var(--camw) * .75 + 22px)}
.c-d2.d2-wall .d2-spcol .d2-spark{margin:0;flex:1 1 auto;min-height:0;max-height:320px}
.c-d2.d2-wall .d2-sp-cap{margin-top:4px}
.c-d2.d2-wall .d2-plot{font-size:14px;line-height:16px;padding-top:8px}
.c-d2.d2-wall .d2-px{height:16px}
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
.c-d2 .d2-page{--lab:23px;--rgap:10px;--tile:min(calc((100cqw - (var(--cols) - 1) * var(--tgap)) / var(--cols)),calc((100cqh - var(--rows) * var(--lab) - (var(--rows) - 1) * var(--rgap)) / var(--rows)),calc(var(--tmax) * var(--isz,1)));flex:0 0 100%;min-width:0;scroll-snap-align:start;display:grid;grid-template-columns:repeat(var(--cols),var(--tile));justify-content:center;column-gap:var(--tgap);row-gap:var(--rgap);align-content:center}
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
.c-d2 .d2-face::after{content:"";position:absolute;inset:0;background:linear-gradient(var(--sheen-a),transparent 0 56%,var(--tSheen) 56.5%,transparent 78%);opacity:.7;pointer-events:none}
.c-d2 .d2-glyph{position:absolute;left:16%;top:16%;width:68%;height:68%;fill:none;stroke:var(--glyph);stroke-width:4;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 2px var(--gglow)) drop-shadow(0 0 7px var(--gglow))}
.c-d2 .d2-glyph .fill{fill:var(--glyph);stroke:none}
.c-d2 .d2-glyph .solid{fill:var(--glyph)}
.c-d2 .d2-glyph .thin{stroke-width:3}
.c-d2 .d2-glyph .d2-fan{transform-box:view-box;transform-origin:24px 24px}
/* Hover glow fades in and out rather than switching. */
.c-d2 .d2-tile .d2-glyph{transition:opacity .35s ease,filter .35s ease,stroke .35s ease}
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
.c-d2 .d2-tile.is-util:hover .d2-glyph,.c-d2 .d2-tile.is-util:focus-visible .d2-glyph{stroke:var(--fg)}
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
.c-d2 .d2-other .d2-crow{display:grid;grid-template-columns:auto auto minmax(0,1fr) var(--rowcamw,var(--camw));align-items:center;column-gap:10px}
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
:host{display:block;height:100%;position:relative}
.jo-root{height:100%}
/* Card size: the glass and its sheets are drawn larger or smaller as a whole. */
.jo-root>ha-card>.c-d2,.c-d2.jo-over{zoom:var(--ui,1)}
.jo-skel{position:relative;height:100%;min-height:56px;box-sizing:border-box;padding:16px;overflow:hidden;border-radius:var(--ha-card-border-radius,12px);background:var(--ha-card-background,var(--card-background-color,#1c1c1c));box-shadow:inset 0 0 0 1px var(--divider-color,rgba(127,127,127,.15));animation:jo-in .25s .3s both}
.jo-skel i,.jo-skel b{display:block;border-radius:8px;background:var(--divider-color,rgba(127,127,127,.15));animation:jo-pulse 1.4s ease-in-out .3s infinite alternate}
.jo-skel i{width:38%;max-width:180px;height:22px}
.jo-skel b{width:58%;max-width:280px;height:clamp(16px,18%,64px);margin-top:14px}
@keyframes jo-in{from{opacity:0}}
@keyframes jo-pulse{to{opacity:.45}}
@media (prefers-reduced-motion:reduce){.jo-skel,.jo-skel i,.jo-skel b{animation:none}}
@container (max-width:400px){.c-d2.d2-standard .d2-idle .d2-name{font-size:19px;line-height:24px}}
@container (max-width:340px){.c-d2.d2-standard .d2-idle .d2-name{font-size:18px;line-height:24px}}
ha-card{height:100%;overflow:hidden;overflow:clip;background:none;border:none;box-shadow:none;border-radius:var(--ha-card-border-radius,12px);padding:0}
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
/* Review: the tile stays at the left; the control sits on the sheet's centre line, in the middle of
   two equal columns (on a card too narrow for that, it moves right just enough to clear the tile). */
.c-d2 .d2-sh-row{--tile:clamp(44px,17cqw,72px);--sg:min(16px,4cqw);display:grid;grid-template-columns:minmax(var(--tile),1fr) minmax(0,auto) minmax(0,1fr);align-items:center;column-gap:var(--sg)}
.c-d2 .d2-sh-face{--tile:inherit;justify-self:start}
.c-d2 .d2-sh-mid{text-align:center}
.c-d2 .d2-sh-temp{min-width:0;display:flex;align-items:center;justify-content:center;gap:min(14px,2.5cqw)}
/* On a narrow card the − / + buttons and the number shrink so the row always fits. */
.c-d2 .d2-sh-temp .d2-round{width:clamp(32px,13cqw,48px);height:clamp(32px,13cqw,48px)}
.c-d2 .d2-sh-temp .d2-round .d2-ic{width:clamp(16px,5.5cqw,20px);height:clamp(16px,5.5cqw,20px)}
.c-d2 .d2-sh-v{font:400 16px/1 var(--f);color:var(--fg2);white-space:nowrap}
.c-d2 .d2-sh-v b{min-width:1.1em;font-family:var(--fn);font-weight:300;font-size:min(46px,13.5cqw);line-height:1;color:var(--fg);text-align:center;font-variant-numeric:tabular-nums}
.c-d2 .d2-sh-note{font:400 14px/19px var(--f);color:var(--fg2)}
.c-d2 .d2-sh-acts{display:flex;gap:10px;margin-top:auto}
.c-d2 .d2-go{flex:1;min-width:0;height:52px;padding:0 10px;border-radius:14px;background:linear-gradient(90deg,#f6a53a,#ea5a17);color:#1a0a02;font:600 min(17px,6.2cqw)/1.1 var(--f)}
.c-d2 .d2-go[disabled]{opacity:.7;cursor:progress}
.c-d2.d2-wall .d2-sh-t{font-size:28px;line-height:34px}
.c-d2.d2-wall .d2-sh-note{font-size:19px;line-height:26px}
.c-d2.d2-wall .d2-sh-v b{font-size:min(72px,13.5cqw)}
.c-d2.d2-wall .d2-sh-row{--tile:96px}
.c-d2.d2-wall .d2-sh-line{font-size:18px}
.c-d2.d2-wall .d2-seg.d2-sh-seg{width:min(520px,calc(100cqw - 2 * var(--px) - var(--tile) - 2 * var(--sg)),max(200px,calc(100cqw - 2 * var(--px) - 2 * var(--tile) - 2 * var(--sg))))}
.c-d2.d2-wall .d2-seg.d2-sh-seg button{min-height:64px;font-size:22px}
.c-d2.d2-wall .d2-go{height:64px;font-size:22px}
/* ---- The oven button: icon (the oven's lamp) and a name that tucks into it ---- */
.c-d2 .d2-ovb{display:flex;align-items:center;justify-self:start;align-self:start;max-width:100%;min-width:0;min-height:44px;margin:-8px 0 -8px calc(-6px - .175em);padding:0 6px;border-radius:12px;text-align:left;transition:background-color .2s}
.c-d2 .d2-ovb:hover,.c-d2 .d2-ovb.is-open{background:color-mix(in srgb,var(--fg) 7%,transparent)}
.c-d2 .d2-lamp{display:flex;flex:none}
.c-d2 .d2-ovb .d2-oic,.c-d2 .d2-mi .d2-oic{width:1.2em;height:1.2em;margin:0;vertical-align:0;color:var(--fg);--mdc-icon-size:1.2em;transition:color .3s,filter .3s}
.c-d2 .l-on .d2-oic{color:var(--ember);filter:drop-shadow(0 0 3px var(--glow)) drop-shadow(0 0 9px var(--glow))}
.c-d2 .l-lost .d2-oic{color:var(--grey);opacity:.75}
.c-d2 .d2-nm{min-width:0;max-width:80cqw;padding-left:.4em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:max-width .5s ease,padding .5s ease,opacity .35s ease}
.c-d2 .d2-ovb.is-tucked .d2-nm{max-width:0;padding-left:0;opacity:0}
.c-d2 .d2-ovb.is-marquee .d2-nm{text-overflow:clip;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 .4em,#000 calc(100% - .6em),transparent);mask-image:linear-gradient(90deg,transparent 0,#000 .4em,#000 calc(100% - .6em),transparent)}
.c-d2 .d2-ovb.is-marquee .d2-nmt{display:inline-block;animation:d2-marq var(--nm-dur,3s) ease-in-out .3s infinite alternate}
@keyframes d2-marq{0%,12%{transform:translateX(0)}88%,100%{transform:translateX(var(--nm-shift,0))}}
.c-d2 .d2-ovb.is-tucked:hover .d2-nm,.c-d2 .d2-ovb.is-tucked:focus-visible .d2-nm,.c-d2 .d2-ovb.is-tucked.is-open .d2-nm{max-width:80cqw;padding-left:.4em;opacity:1}
.c-d2 .d2-idle .d2-top{align-items:start}
/* Equal margins, measured to the ink: the icon's drawing and the clock's digits start at the
   card's padding, like the tiles (the icon's grid has a 3.5/24 inset, the digits sit .15em down). */
.c-d2 .d2-idle .d2-ovb{margin-top:calc(.4em - 22px)}
.c-d2 .d2-idle .d2-time{margin-top:-.15em}
/* Equal margins: the tiles reach the card's side padding and sit on its bottom padding, the same
   distance as the name and clock from the top; spare height goes between the clock and the tiles. */
.c-d2 .d2-page{justify-content:space-between;align-content:end}
/* A wall tablet's single row leaves too much height for one gap: there the tiles sit midway. */
.c-d2.d2-wall .d2-page{align-content:center}
.c-d2 .d2-idle.no-dots .d2-pager{padding-top:var(--py)}
/* ---- Sheets layer ---- */
.jo-over[hidden]{display:none!important}
.c-d2.jo-over{position:absolute;inset:0;z-index:10;background:none;box-shadow:none;container-type:size}
.c-d2 .d2-sheet{box-shadow:inset 0 0 0 1px var(--rim)}
/* A short card scrolls the review instead of cutting off Start; settings scrolls its own list. */
.c-d2 .d2-sheet:not(.d2-set){overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}
.c-d2 .d2-sheet:not(.d2-set)>*{flex:none}
/* Review: number you can type in, slider, − and + */
.c-d2 .d2-sh-v{display:flex;align-items:baseline;gap:2px;cursor:text}
.c-d2 .d2-timer-v{gap:min(10px,2cqw)}
.c-d2 .d2-timer-v>label{display:flex;align-items:baseline;gap:2px}
.c-d2 .d2-timer-v:not(.has-h)>.d2-tm-h{display:none}
/* Hours and minutes: smaller digits and tighter fields so the pair fits where one number did. */
.c-d2 .d2-timer-v.has-h .d2-sh-in{font-size:min(46px,9.5cqw);width:1.2em}
.c-d2.d2-wall .d2-timer-v.has-h .d2-sh-in{font-size:min(72px,9.5cqw)}
.c-d2 .d2-timer-v.has-h .d2-timer-h{width:.7em}
.c-d2 .d2-timer-v.has-h .d2-timer-h.is-wide{width:1.2em}
.c-d2 .d2-timer-v.has-h span{font-size:min(16px,4.5cqw)}
.c-d2 .d2-sh-in{width:1.75em;padding:0 0 2px;border:0;border-bottom:2px dashed var(--chipb);border-radius:0;background:none;font-family:var(--fn);font-weight:300;font-size:min(46px,13.5cqw);line-height:1;color:var(--fg);text-align:center;font-variant-numeric:tabular-nums;outline:none;caret-color:var(--ember)}
.c-d2 .d2-sh-in:hover{border-bottom-color:var(--fg2)}
.c-d2 .d2-sh-in:focus{border-bottom:2px solid var(--ember)}
.c-d2.d2-wall .d2-sh-in{font-size:min(72px,13.5cqw)}
.c-d2 .d2-round[disabled]{opacity:.35;cursor:default}
.c-d2 .d2-sh-slide{padding:0 2px}
.c-d2 .d2-range{-webkit-appearance:none;appearance:none;display:block;width:100%;height:32px;margin:0;background:none;cursor:pointer;--trk:linear-gradient(90deg,var(--ember2),var(--ember)) 0/calc(var(--p) * 100%) 100% no-repeat,var(--track)}
.c-d2 .d2-range::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:var(--trk)}
.c-d2 .d2-range::-moz-range-track{height:6px;border-radius:3px;background:var(--trk)}
.c-d2 .d2-range::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;margin-top:-10px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--ember),0 2px 6px rgba(0,0,0,.35)}
.c-d2 .d2-range::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--ember),0 2px 6px rgba(0,0,0,.35)}
.c-d2 .d2-range:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:6px}
.c-d2 .d2-sh-ends{display:flex;justify-content:space-between;gap:8px;font:400 12px/14px var(--f);color:var(--fg2);white-space:nowrap}
.c-d2 .d2-sh-ends span:nth-child(2):not(:last-child){color:var(--fg);text-align:center}
/* Three labels: equal outer columns keep the middle one on the centre line. */
.c-d2 .d2-sh-ends3{display:grid;grid-template-columns:1fr auto 1fr}
.c-d2 .d2-sh-ends3 span:first-child{text-align:left}
.c-d2 .d2-sh-ends3 span:last-child{text-align:right}
/* No slider: one line in its place, so every review keeps the same rhythm. */
.c-d2 .d2-sh-line{display:flex;align-items:center;justify-content:center;min-height:46px;font:400 15px/19px var(--f);color:var(--fg2);text-align:center}
.c-d2 .d2-sh-seg{width:min(360px,calc(100cqw - 2 * var(--px) - var(--tile) - 2 * var(--sg)),max(200px,calc(100cqw - 2 * var(--px) - 2 * var(--tile) - 2 * var(--sg))))}
.c-d2 .d2-seg.d2-sh-seg button{min-height:48px;font-size:min(17px,5cqw)}
.c-d2.d2-wall .d2-sh-ends{font-size:16px;line-height:20px}
/* Settings */
.c-d2 .d2-set{gap:6px;padding-bottom:0}
.c-d2 .d2-set-list{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;margin:0 calc(var(--px) * -1);padding:0 var(--px) var(--py)}
.c-d2 .d2-set-row{padding:10px 0;border-top:1px solid var(--line)}
.c-d2 .d2-set-row:first-child{border-top:0;padding-top:4px}
.c-d2 .d2-set-l{font:600 13px/18px var(--f);letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);margin-bottom:8px}
.c-d2 .d2-set-h{font:400 13px/17px var(--f);color:var(--fg2);margin-top:6px}
.c-d2 .d2-seg{display:flex;flex-wrap:wrap;gap:6px}
.c-d2 .d2-seg button{flex:1 1 auto;min-height:40px;padding:0 12px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--chipb);font:500 15px/1 var(--f);color:var(--fg);white-space:nowrap}
.c-d2 .d2-seg button[aria-checked="true"],.c-d2 .d2-ici[aria-checked="true"]{background:color-mix(in srgb,var(--ember) 16%,transparent);box-shadow:inset 0 0 0 1.5px var(--ember)}
.c-d2 .d2-icons{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px}
.c-d2 .d2-ici{height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;box-shadow:inset 0 0 0 1px var(--chipb);color:var(--fg)}
.c-d2 .d2-ici .d2-oic{width:24px;height:24px;margin:0;color:inherit}
.c-d2 .d2-ic-list{display:flex;flex-direction:column;gap:6px}
.c-d2 .d2-ic-row{border-radius:12px;box-shadow:inset 0 0 0 1px var(--line)}
.c-d2 .d2-ic-row.is-open{box-shadow:inset 0 0 0 1.5px var(--ember);background:color-mix(in srgb,var(--ember) 6%,transparent)}
.c-d2 .d2-ic-head{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:0 12px;font:500 16px/20px var(--f);color:var(--fg);text-align:left}
.c-d2 .d2-ic-head .d2-oic{width:26px;height:26px;margin:0;color:var(--fg);--mdc-icon-size:26px}
.c-d2 .d2-ic-row.l-on .d2-ic-head .d2-oic{color:var(--ember);filter:drop-shadow(0 0 3px var(--glow))}
.c-d2 .d2-ic-row.l-lost .d2-ic-head .d2-oic{color:var(--grey)}
.c-d2 .d2-ic-n{flex:1 1 auto;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d2 .d2-ic-s{flex:none;font:600 12px/16px var(--f);letter-spacing:.07em;text-transform:uppercase;color:var(--fg2)}
.c-d2 .d2-ic-row.l-on .d2-ic-s{color:var(--ember)}
.c-d2 .d2-ic-go{flex:none;min-width:58px;padding:6px 10px;border-radius:8px;box-shadow:inset 0 0 0 1px var(--chipb);font:500 13px/1 var(--f);text-align:center;color:var(--fg)}
.c-d2 .d2-ic-row.is-open .d2-ic-go{background:var(--ember);box-shadow:none;color:#1a0a02}
.c-d2 .d2-ic-pick{padding:2px 12px 12px}
.c-d2 .d2-ic-cap{display:block;font:400 13px/18px var(--f);color:var(--fg2);margin:0 0 6px}
.c-d2 .d2-ic-cap b{font-weight:600;color:var(--fg)}
.c-d2 .d2-mdi-l{margin:10px 0 0}
.c-d2 .d2-mdi{display:block;width:100%;height:40px;margin-top:6px;padding:0 12px;border:0;border-radius:10px;box-shadow:inset 0 0 0 1px var(--chipb);background:none;font:400 15px/1 var(--f);color:var(--fg);outline:none}
.c-d2 .d2-mdi:focus{box-shadow:inset 0 0 0 1.5px var(--ember)}
.c-d2 .d2-mdi::placeholder{color:var(--fg2)}
.c-d2 .d2-pr-list{display:flex;flex-direction:column;gap:8px}
.c-d2 .d2-pr-n{display:block;margin-bottom:4px;font:500 13px/18px var(--f);color:var(--fg2)}
.c-d2 .d2-sel{display:block;width:100%;height:44px;padding:0 36px 0 12px;border:0;border-radius:10px;box-shadow:inset 0 0 0 1px var(--chipb);background:no-repeat right 12px center/14px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6' fill='none' stroke='%23999' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E");font:400 15px/1 var(--f);color:var(--fg);outline:none;appearance:none;-webkit-appearance:none;text-overflow:ellipsis;cursor:pointer}
.c-d2 .d2-sel:focus-visible{box-shadow:inset 0 0 0 1.5px var(--ember)}
.c-d2 .d2-sel option{background:var(--bg);color:var(--fg)}
.c-d2.d2-wall .d2-sel{height:56px;font-size:19px}
.c-d2 .d2-food{display:flex;flex-direction:column;gap:8px}
.c-d2 .d2-foodin{display:block;width:100%;height:40px;padding:0 12px;border:0;border-radius:10px;box-shadow:inset 0 0 0 1px var(--chipb);background:none;font:400 15px/1 var(--f);color:var(--fg);outline:none;margin:0}
.c-d2 .d2-foodin:focus{box-shadow:inset 0 0 0 1.5px var(--ember)}
.c-d2 .d2-foodin::placeholder{color:var(--fg2)}
.c-d2 .d2-set-ver{padding-top:10px;font:400 12px/16px var(--f);color:var(--fg2);text-align:center}
.c-d2.d2-wall .d2-ic-head{min-height:64px;font-size:20px}
.c-d2 .d2-set-acts{display:flex;flex-wrap:wrap;gap:8px;padding-top:10px;border-top:1px solid var(--line)}
.c-d2 .d2-set-acts .d2-ghost{flex:1 1 auto;height:44px}
.c-d2.d2-wall .d2-seg button{min-height:52px;font-size:19px}
.c-d2 .d2-lay-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 0 10px}
.c-d2 .d2-lay-l{min-width:0;font:500 16px/1 var(--f);color:var(--fg)}
.c-d2 .d2-lay-ctl{display:flex;align-items:center;gap:min(10px,2.5cqw);flex:none}
.c-d2 .d2-lay-b{width:clamp(34px,13cqw,44px);height:clamp(34px,13cqw,44px);border-radius:12px;box-shadow:inset 0 0 0 1px var(--chipb);font:500 22px/1 var(--f)}
.c-d2 .d2-lay-b:disabled{opacity:.35;cursor:default}
.c-d2 .d2-lay-v{display:flex;flex-direction:column;align-items:center;min-width:min(48px,14cqw);font:400 26px/1 var(--fn);color:var(--fg)}
.c-d2 .d2-lay-v small{font:500 11px/1 var(--f);letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);margin-top:3px}
.c-d2 .d2-lay-prev{border-radius:12px;background:var(--bg);box-shadow:inset 0 0 0 1px var(--rim);padding:10px 12px 12px;display:flex;flex-direction:column;align-items:center;gap:8px}
.c-d2 .d2-lay-clock{font:300 22px/1 var(--fn);color:var(--fg2)}
.c-d2 .d2-lay-grid{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,40px));gap:6px;width:100%;justify-content:center}
.c-d2 .d2-lay-grid u{display:block;aspect-ratio:1;border-radius:22%;background:linear-gradient(180deg,var(--tA),var(--tB));box-shadow:inset 0 0 0 1px var(--tRim)}
.c-d2 .d2-lay-grid u.is-util{background:linear-gradient(180deg,var(--uA),var(--uB));box-shadow:inset 0 0 0 1px var(--uRim)}
.c-d2 .d2-lay-pages{display:flex;gap:6px}
.c-d2 .d2-lay-pages i{width:6px;height:6px;border-radius:50%;background:var(--track)}
.c-d2 .d2-lay-pages i.on{background:var(--fg2)}
.c-d2 .d2-lay-note{font:400 14px/18px var(--f);color:var(--fg2);margin-top:6px}
.c-d2 .d2-link{margin-top:8px;font:500 15px/1 var(--f);color:var(--ember);text-decoration:underline;text-underline-offset:3px;min-height:32px}
.c-d2 .d2-scale{display:flex;align-items:center;gap:12px}
.c-d2 .d2-scale .d2-range{flex:1 1 auto}
.c-d2 .d2-scale-v{min-width:48px;text-align:right;font:500 16px/1 var(--f);color:var(--fg)}
.c-d2.d2-wall .d2-set-l{font-size:16px;line-height:22px}
.c-d2.d2-wall .d2-set-h{font-size:16px;line-height:22px}
/* Camera window: floats over the card, the picture uncropped, X to close */
.c-d2 .d2-cv-back{position:absolute;inset:0;background:rgba(0,0,0,.55)}
.c-d2 .d2-cv{position:absolute;inset:calc(var(--px) / 2);display:flex;flex-direction:column;border-radius:14px;overflow:hidden;background:#000;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 10px 34px rgba(0,0,0,.55)}
.c-d2 .d2-cv-win{position:relative;flex:1 1 auto;min-height:0}
.c-d2 .d2-cv-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.c-d2 .d2-cv-img:not([src]){visibility:hidden}
.c-d2 .d2-cv-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 24px;text-align:center;color:#d4d4d8;font:400 14px/19px var(--f)}
.c-d2 .d2-cv-msg[hidden]{display:none}
.c-d2 .d2-cv-msg .d2-ic{width:30px;height:30px;color:#a1a1aa}
.c-d2 .d2-cv-msg b{font:600 17px/22px var(--f);color:#f4f4f5}
.c-d2 .d2-cv-bar{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 6px 18px 14px;background:linear-gradient(180deg,rgba(0,0,0,.7),transparent);color:#fff;font:600 16px/20px var(--f)}
.c-d2 .d2-cv-t{display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d2 .d2-cv-pill{position:static;font-size:11px;padding:3px 6px;border-radius:5px;background:#c62828;color:#fff}
.c-d2 .d2-cv-pill.is-old{background:rgba(0,0,0,.66);color:#fbbf24}
.c-d2 .d2-cv-pill[hidden]{display:none}
.c-d2 .d2-cv-x{background:rgba(0,0,0,.45);color:#fff}
.c-d2 .d2-hsheet .d2-set-list{display:flex;flex-direction:column}
.c-d2 .d2-hd-ht{flex:1;min-width:0}
.c-d2 .d2-hd-ht .d2-sh-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c-d2 .d2-hist{display:flex;flex-direction:column}
.c-d2 .d2-hr{display:flex;align-items:center;gap:min(12px,3cqw);width:100%;min-height:64px;padding:8px 0;border-top:1px solid var(--line);text-align:left}
.c-d2 .d2-hr:first-child{border-top:0}
.c-d2 .d2-hr-pic{flex:none;width:clamp(44px,18cqw,64px);aspect-ratio:4/3;border-radius:9px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.c-d2 .d2-hr-pic img{width:100%;height:100%;object-fit:cover;display:block;background:var(--win)}
.c-d2 .d2-hr-pic .d2-face{--tile:min(44px,100%);background:linear-gradient(180deg,var(--uA),var(--uB));box-shadow:inset 0 0 0 1px var(--uRim)}
.c-d2 .d2-hr-pic .d2-glyph{stroke:var(--uGlyph);filter:none}
.c-d2 .d2-hr-m{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.c-d2 .d2-hr-t{font:600 16px/21px var(--f);color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .35s ease}
.c-d2 .d2-hr-s{font:400 13px/17px var(--f);color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c-d2 .d2-hr:hover .d2-hr-t,.c-d2 .d2-hr:focus-visible .d2-hr-t{color:var(--ember)}
.c-d2 .d2-hr-o{flex:none;padding:5px 7px;border-radius:6px;font:600 11px/1 var(--f);letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);box-shadow:inset 0 0 0 1px var(--line)}
.c-d2 .d2-hr-o.is-done{color:var(--green);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--green) 45%,transparent)}
.c-d2 .d2-hsheet .d2-link{align-self:center}
.c-d2 .d2-hist-msg{display:flex;flex-direction:column;gap:6px;padding:28px 8px;text-align:center;font:400 14px/19px var(--f);color:var(--fg2)}
.c-d2 .d2-hist-msg b{font:600 17px/22px var(--f);color:var(--fg)}
.c-d2 .d2-hd{display:flex;flex-direction:column;gap:14px;padding-top:2px}
.c-d2 .d2-hd-pic{border-radius:12px;overflow:hidden;background:var(--win);aspect-ratio:4/3;max-height:min(300px,42cqh);box-shadow:inset 0 0 0 1px var(--rim)}
.c-d2 .d2-hd-pic img{width:100%;height:100%;object-fit:cover;display:block}
.c-d2 .d2-hd-graph .d2-plot{height:132px}
.c-d2 .d2-hd-graph polyline{fill:none;stroke:var(--ember);stroke-width:2.5;stroke-linejoin:round;filter:drop-shadow(0 0 3px var(--glow))}
.c-d2 .d2-hd-graph polyline.sp-food{stroke:var(--food);filter:none}
.c-d2 .d2-hd-graph .sp-tgt{stroke:var(--fg2);stroke-width:1;stroke-dasharray:4 4;opacity:.7}
.c-d2 .d2-sp-key.k-tgt i{height:0;background:none;border-top:1px dashed var(--fg2)}
.c-d2 .d2-hd-graph .d2-sp-cap{flex-wrap:wrap;row-gap:4px;font-size:13px}
.c-d2 .d2-hd-graph.is-loading{height:122px}
.c-d2 .d2-hd-nog{font:400 13px/17px var(--f);color:var(--fg2)}
.c-d2 .d2-hd-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px 16px;margin:0}
.c-d2 .d2-hd-st dt{font:600 11px/14px var(--f);letter-spacing:.06em;text-transform:uppercase;color:var(--fg2)}
.c-d2 .d2-hd-st dd{margin:3px 0 0;font:500 15px/20px var(--f);color:var(--fg)}
.c-d2 .d2-hd-acts{display:flex;gap:8px;padding:10px 0 var(--py);border-top:1px solid var(--line)}
.c-d2 .d2-hd-acts .d2-ghost,.c-d2 .d2-hsheet .d2-set-acts .d2-ghost{flex:1 1 auto;height:44px}
.c-d2 .d2-ghost.is-danger{background:#c62828;color:#fff;box-shadow:none}
.c-d2.d2-wall .d2-hr{min-height:84px;gap:16px}
.c-d2.d2-wall .d2-hr-pic{width:92px;height:69px;border-radius:12px}
.c-d2.d2-wall .d2-hr-pic .d2-face{--tile:60px}
.c-d2.d2-wall .d2-hr-t{font-size:20px;line-height:26px}
.c-d2.d2-wall .d2-hr-s{font-size:16px;line-height:21px}
.c-d2.d2-wall .d2-hr-o{font-size:13px;padding:6px 9px}
.c-d2.d2-wall .d2-hist-msg,.c-d2.d2-wall .d2-hd-nog{font-size:16px;line-height:22px}
.c-d2.d2-wall .d2-hd-graph .d2-plot{height:180px}
.c-d2.d2-wall .d2-hd.has-pic{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-auto-flow:row dense;column-gap:24px;row-gap:14px;align-items:start}
.c-d2.d2-wall .d2-hd.has-pic>*{grid-column:2}
.c-d2.d2-wall .d2-hd.has-pic>.d2-hd-pic{grid-column:1;grid-row:1 / span 3;max-height:none}
.c-d2.d2-wall .d2-hd.has-pic>.d2-hd-acts,.c-d2.d2-wall .d2-hd.has-pic>.d2-sh-note{grid-column:1 / -1}
.c-d2.d2-wall .d2-hd-st dt{font-size:13px;line-height:17px}
.c-d2.d2-wall .d2-hd-st dd{font-size:19px;line-height:25px}
.c-d2.d2-wall .d2-hd-stats{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.c-d2.d2-wall .d2-cv-bar{font-size:22px;line-height:28px;padding:10px 10px 26px 20px}
.c-d2.d2-wall .d2-cv-pill{font-size:15px;padding:5px 9px}
/* Oven menu */
.c-d2 .d2-menu-back{position:absolute;inset:0}
.c-d2 .d2-menu{position:absolute;width:min(260px,calc(100cqw - 16px));overflow-y:auto;padding:6px;border-radius:14px;background:var(--dlg);box-shadow:0 0 0 1px var(--line),0 12px 32px rgba(0,0,0,.4);animation:d2-drop .16s ease-out}
@keyframes d2-drop{from{opacity:0;transform:translateY(-6px)}}
.c-d2 .d2-mi{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:0 10px;border-radius:10px;font:500 16px/20px var(--f);color:var(--fg);text-align:left;transition:background-color .2s}
.c-d2 .d2-mi:hover,.c-d2 .d2-mi:focus-visible{background:color-mix(in srgb,var(--fg) 7%,transparent)}
.c-d2 .d2-mi .d2-oic{font-size:18px}
.c-d2 .d2-mi-n{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-d2 .d2-mi-s{flex:none;font:600 12px/16px var(--f);letter-spacing:.07em;text-transform:uppercase;color:var(--fg2)}
.c-d2 .d2-mi.l-on .d2-mi-s{color:var(--ember)}
.c-d2 .d2-mi>.d2-ic{flex:none;width:18px;height:18px;color:var(--fg2)}
.c-d2.d2-wall .d2-mi{min-height:60px;font-size:22px}
.c-d2.d2-wall .d2-menu{width:min(340px,calc(100cqw - 16px))}
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
  // Home Assistant's app installs that polyfill a moment after this file runs, and Lovelace waits for the
  // card to appear on the new registry before showing it. Check often while the page starts, so the
  // card shows at once rather than at the next slow check, then every 2 s.
  const fastCheck = setInterval(ensureDefined, 50);
  setTimeout(() => clearInterval(fastCheck), 30000);
  setInterval(ensureDefined, 2000);
  window.addEventListener("location-changed", ensureDefined);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: TAG,
    name: "July Oven",
    description: "The June oven's glass screen for your dashboard: status, camera, Stop, and a reviewed start.",
    preview: false,
    documentationURL: "https://github.com/prj-july/ha-june-oven"
  });
  console.info(`%c JULY-OVEN-CARD %c ${VERSION} `, "color:#fff;background:#c62828;font-weight:700", "color:#c62828");
})();
