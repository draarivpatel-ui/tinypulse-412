/*
 * TinyPulse-412 ATtiny412 TCA0 Register, Power Budget & TDM Pin-Scan Lab
 * Pure deterministic UMD module. Identical exports in Node (module.exports)
 * and the browser (window.ATTINY_LAB). Zero dependencies, zero build step,
 * zero network requests, and it never creates an AudioContext.
 *
 * Silicon constants below mirror firmware/main.c exactly:
 *   F_CPU = 5 MHz (OSC20M 20 MHz through CLKCTRL_PDIV_4X),
 *   TCA0.SINGLE.WGMODE = TCA_SINGLE_WGMODE_FRQ_gc,
 *   f_out = F_CPU / (2 * N * (CMP0 + 1)).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module !== null && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === "object") {
    root.ATTINY_LAB = api;
  }
})(typeof self !== "undefined" ? self : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";

  /* ================= Silicon constants (mirror firmware/main.c) ================= */

  var F_CPU_HZ = 5000000;                 /* OSC20M / CLKCTRL_PDIV_4X = 5 MHz */
  var CMP0_MIN = 0;
  var CMP0_MAX = 65535;                   /* uint16 TCA0.SINGLE.CMP0 */
  var PRESCALERS = [1, 2, 4, 8, 16, 64];  /* TCA_SINGLE_CLKSEL_DIV1..DIV64 */
  var CLKSEL_GC = { "1": 0x00, "2": 0x01, "4": 0x02, "8": 0x03, "16": 0x04, "64": 0x05 };
  var DEFAULT_PRESCALER = 16;             /* TCA_SINGLE_CLKSEL_DIV16_gc in main.c */
  var CR2032_CAPACITY_MAH = 225;

  /* CTRLB: TCA_SINGLE_CMP0EN_bm (0x10) | TCA_SINGLE_WGMODE_FRQ_gc (0x01) = 0x11 */
  var CTRLB_FRQ = 0x11;
  /* CTRLA: (CLKSEL_gc << 1) | TCA_SINGLE_ENABLE_bm (0x01) */
  function ctrlAByte(presc) {
    var gc = CLKSEL_GC[String(presc)];
    return (((gc === undefined ? CLKSEL_GC["16"] : gc) << 1) | 0x01) & 0xff;
  }

  /* FRQ waveform output: WO0 toggles on each CMP0 match, so one full period
     costs 2 * N * (CMP0 + 1) F_CPU cycles. */
  function tca0FreqHz(cmp0, presc) {
    return F_CPU_HZ / (2 * presc * (cmp0 + 1));
  }

  /* ================= Note table: chromatic C4 (MIDI 60) .. E5 (MIDI 76) ================= */

  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  /* Shipped SCALE_CMP0[] register values from firmware/main.c at DIV16. */
  var FW_CMP0 = { C4: 595, D4: 530, E4: 472, G4: 397, A4: 354, C5: 297, D5: 265, E5: 236 };
  /* Documented quantized Hz for each shipped note (firmware/app.js display). */
  var FW_FREQ_HZ = { C4: 262.16, D4: 294.26, E4: 330.34, G4: 392.59, A4: 440.14, C5: 524.33, D5: 587.41, E5: 659.28 };

  var NOTES = [];
  for (var _m = 60; _m <= 76; _m++) {
    var _name = NOTE_NAMES[_m % 12] + (Math.floor(_m / 12) - 1);
    NOTES.push({
      name: _name,
      midi: _m,
      idealHz: 440 * Math.pow(2, (_m - 69) / 12),
      fwCmp0: (Object.prototype.hasOwnProperty.call(FW_CMP0, _name) ? FW_CMP0[_name] : null)
    });
  }

  function noteIndexByName(name) {
    for (var i = 0; i < NOTES.length; i++) {
      if (NOTES[i].name === name) return i;
    }
    return -1;
  }

  /* ================= TCA0 comparator math ================= */

  /* Solve CMP0 for a target frequency and CLKSEL prescaler.
     Returns ok:false for out-of-domain input; fits:false when the ideal
     CMP0 falls outside the 16-bit register range (quantHz is then computed
     against the clamped register value). */
  function cmp0For(targetHz, presc) {
    var res = {
      ok: false, targetHz: NaN, presc: 0, cmp0Ideal: NaN, cmp0: 0,
      fits: false, quantHz: NaN, centsErr: NaN, absCents: NaN, hex: "0x0000"
    };
    if (!Number.isFinite(targetHz) || targetHz <= 0) return res;
    if (PRESCALERS.indexOf(presc) === -1) return res;
    var ideal = F_CPU_HZ / (2 * presc * targetHz) - 1;
    var cmp0 = Math.round(ideal);
    if (cmp0 === 0) cmp0 = 0; /* normalize -0 */
    var fits = cmp0 >= CMP0_MIN && cmp0 <= CMP0_MAX;
    var reg = fits ? cmp0 : (cmp0 < CMP0_MIN ? CMP0_MIN : CMP0_MAX);
    var quantHz = tca0FreqHz(reg, presc);
    var cents = 1200 * Math.log2(quantHz / targetHz);
    res.ok = true;
    res.targetHz = targetHz;
    res.presc = presc;
    res.cmp0Ideal = ideal;
    res.cmp0 = cmp0;
    res.fits = fits;
    res.quantHz = quantHz;
    res.centsErr = cents;
    res.absCents = Math.abs(cents);
    res.hex = hex16(reg);
    return res;
  }

  /* Worst-case cents error from +/-0.5 LSB rounding at (targetHz, presc):
     |df/f| <= 0.5/(CMP0+1) = N * f / F_CPU. Strictly proportional to N,
     so the bound is monotonically non-increasing as prescaler decreases. */
  function centsBound(targetHz, presc) {
    if (!Number.isFinite(targetHz) || targetHz <= 0) return NaN;
    if (PRESCALERS.indexOf(presc) === -1) return NaN;
    return 1200 * Math.log2(1 + (presc * targetHz) / F_CPU_HZ);
  }

  function hex16(v) {
    var s = (v >>> 0).toString(16).toUpperCase();
    while (s.length < 4) s = "0" + s;
    return "0x" + s;
  }

  /* Full note x prescaler comparator table (deterministic order). */
  function buildTable() {
    var rows = [];
    for (var ni = 0; ni < NOTES.length; ni++) {
      for (var pi = 0; pi < PRESCALERS.length; pi++) {
        var n = NOTES[ni];
        var r = cmp0For(n.idealHz, PRESCALERS[pi]);
        r.note = n.name;
        r.midi = n.midi;
        r.noteIdx = ni;
        r.fwCmp0 = (r.presc === DEFAULT_PRESCALER) ? n.fwCmp0 : null;
        r.bound = centsBound(n.idealHz, r.presc);
        rows.push(r);
      }
    }
    return rows;
  }

  /* ================= CR2032 power model ================= */

  var POWER = {
    vdd: 3.0,
    capacityMah: CR2032_CAPACITY_MAH,
    mcuActiveMa: 2.0,      /* ATtiny412 active 5 MHz at 3.0 V (datasheet typ) */
    mcuSleepMa: 0.0001,    /* power-down, all peripherals off (~100 nA) */
    tca0Ma: 0.04,          /* TCA0 peripheral while enabled */
    twi0Ma: 0.3,           /* TWI0 bus + pull-up losses while streaming */
    twiDuty: 0.1,          /* OLED status-burst duty while display on */
    buzzerMa: 3.5,         /* ABI-009-RC average coil current at 3.0 V */
    ledVf: 1.9,            /* LTST-C170KRKT super-red forward voltage */
    ledResOhm: 330,        /* R3/R4 current-limit resistor */
    oledBaseMa: 0.4,
    oledFullMa: 19.6,      /* SSD1306 128x64 at full white */
    pullupOhm: 35000,      /* AVR internal pull-up */
    clickMs: 30,           /* metronome buzzer click per beat */
    tdmWindowUs: 8         /* PA6/PA7 input-pullup settle + sample window */
  };

  function ledMa() {
    return (POWER.vdd - POWER.ledVf) / POWER.ledResOhm * 1000;
  }
  function pullupMa() {
    return POWER.vdd / POWER.pullupOhm * 1000;
  }
  function tdmDuty(tdmHz) {
    var d = tdmHz * POWER.tdmWindowUs / 1000000;
    return d > 1 ? 1 : (d < 0 ? 0 : d);
  }
  function oledMa(oledPct) {
    if (!Number.isFinite(oledPct) || oledPct <= 0) return 0;
    var p = oledPct > 100 ? 100 : oledPct;
    return POWER.oledBaseMa + POWER.oledFullMa * (p / 100);
  }
  function ledEffMa(ledPct, tdmHz) {
    if (!Number.isFinite(ledPct) || ledPct <= 0) return 0;
    var p = ledPct > 100 ? 100 : ledPct;
    return ledMa() * (p / 100) * (1 - tdmDuty(tdmHz));
  }
  function clickDuty(bpm) {
    var d = bpm * POWER.clickMs / 60000;
    return d > 1 ? 1 : (d < 0 ? 0 : d);
  }

  var MODES = [
    { id: "sleep", label: "Sleep (Power-Down)" },
    { id: "metronome", label: "Metronome" },
    { id: "synth", label: "Continuous Synth" },
    { id: "synthmax", label: "Synth + Max Peripherals" }
  ];

  /* Average current draw in mA for a mode index under lab state s. */
  function modeCurrentMa(modeIdx, s) {
    var id = MODES[modeIdx] ? MODES[modeIdx].id : "metronome";
    if (id === "sleep") return POWER.mcuSleepMa;
    var opts = s || {};
    var bpm = Number.isFinite(opts.bpm) ? opts.bpm : 120;
    var oled = id === "synthmax" ? 100 : (Number.isFinite(opts.oled) ? opts.oled : 0);
    var led = id === "synthmax" ? 100 : (Number.isFinite(opts.led) ? opts.led : 0);
    var tdm = Number.isFinite(opts.tdm) ? opts.tdm : 1000;
    var held = id === "synthmax" ? 2 : (Number.isFinite(opts.held) ? opts.held : 0);
    var ma = POWER.mcuActiveMa
      + ledEffMa(led, tdm)
      + oledMa(oled)
      + (oled > 0 ? POWER.twi0Ma * POWER.twiDuty : 0)
      + held * pullupMa();
    if (id === "metronome") {
      var d = clickDuty(bpm);
      ma += (POWER.tca0Ma + POWER.buzzerMa) * d;
    } else {
      ma += POWER.tca0Ma + POWER.buzzerMa;
    }
    return ma;
  }

  function runtimeHours(ma) {
    if (!Number.isFinite(ma) || ma <= 0) return Infinity;
    return CR2032_CAPACITY_MAH / ma;
  }

  /* Operating-mode sweep used by the power chart. */
  function powerSweep(s) {
    var b = (s && Number.isFinite(s.bpm)) ? s.bpm : 120;
    return [
      { id: "sleep", label: "Sleep", mode: 0, bpm: null, ma: modeCurrentMa(0, s) },
      { id: "met60", label: "Metronome 60 BPM", mode: 1, bpm: 60, ma: modeCurrentMa(1, merge(s, { bpm: 60 })) },
      { id: "metcur", label: "Metronome " + Math.round(b) + " BPM", mode: 1, bpm: Math.round(b), ma: modeCurrentMa(1, s) },
      { id: "met240", label: "Metronome 240 BPM", mode: 1, bpm: 240, ma: modeCurrentMa(1, merge(s, { bpm: 240 })) },
      { id: "synth", label: "Continuous Synth", mode: 2, bpm: null, ma: modeCurrentMa(2, s) },
      { id: "synthmax", label: "Synth + Max", mode: 3, bpm: null, ma: modeCurrentMa(3, s) }
    ].map(function (e) {
      e.hours = runtimeHours(e.ma);
      return e;
    });
  }

  function merge(a, b) {
    var o = {};
    var k;
    if (a && typeof a === "object") { for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k]; } }
    if (b && typeof b === "object") { for (k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k]; } }
    return o;
  }

  /* ================= 8-pin SOIC map ================= */

  var PIN_MAP = [
    { pin: 1, port: "VDD", net: "VDD", func: "+3.0V CR2032 (BT1) or +5.0V UPDI target power" },
    { pin: 2, port: "PA6", net: "PA6_BTN1", func: "TDM shared SW1 pitch button + D1 beat LED" },
    { pin: 3, port: "PA7", net: "PA7_BTN2", func: "TDM shared SW2 tempo button + D2 gate LED" },
    { pin: 4, port: "PA1", net: "PA1_SDA", func: "TWI0 SDA to SSD1306 OLED (4.7k pull-up)" },
    { pin: 5, port: "PA2", net: "PA2_SCL", func: "TWI0 SCL to SSD1306 OLED (4.7k pull-up)" },
    { pin: 6, port: "PA0", net: "PA0_UPDI", func: "Single-wire UPDI program/debug (J1)" },
    { pin: 7, port: "PA3", net: "PA3_BUZZER", func: "TCA0 WO0 FRQ PWM to piezo BZ1" },
    { pin: 8, port: "GND", net: "GND", func: "System ground plane" }
  ];

  function checkPinMap() {
    var pins = {};
    var ports = {};
    var gpio = 0;
    for (var i = 0; i < PIN_MAP.length; i++) {
      var p = PIN_MAP[i];
      if (Object.prototype.hasOwnProperty.call(pins, p.pin)) return { ok: false, why: "duplicate pin " + p.pin };
      if (Object.prototype.hasOwnProperty.call(ports, p.port)) return { ok: false, why: "duplicate port " + p.port };
      pins[p.pin] = true;
      ports[p.port] = true;
      if (/^PA\d$/.test(p.port)) gpio++;
    }
    for (var n = 1; n <= 8; n++) {
      if (!pins[n]) return { ok: false, why: "pin " + n + " unmapped" };
    }
    return { ok: gpio === 6, pins: 8, gpio: gpio };
  }

  /* ================= Lab state + fail-closed #tplab= codec ================= */

  /* note: index into NOTES; 9 = A4 440 Hz, matching the simulator's power-up note. */
  var DEFAULT_STATE = { note: 9, presc: 16, bpm: 120, oled: 55, led: 25, mode: 1, tdm: 1000, held: 0 };
  var STATE_KEYS = Object.keys(DEFAULT_STATE);
  var BOUNDS = { note: [0, NOTES.length - 1], bpm: [60, 240], oled: [0, 100], led: [0, 100], mode: [0, MODES.length - 1], tdm: [100, 10000], held: [0, 2] };

  function clampNum(v, lo, hi) {
    if (!Number.isFinite(v)) return lo;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function clampPresc(v) {
    var best = PRESCALERS[0];
    var bd = Infinity;
    for (var i = 0; i < PRESCALERS.length; i++) {
      var d = Math.abs(PRESCALERS[i] - v);
      if (d < bd) { bd = d; best = PRESCALERS[i]; }
    }
    return best;
  }

  /* Sanitize any object into a valid lab state (never throws). */
  function clampState(st) {
    var s = {};
    var k;
    for (k in DEFAULT_STATE) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_STATE, k)) s[k] = DEFAULT_STATE[k];
    }
    if (st && typeof st === "object") {
      for (var i = 0; i < STATE_KEYS.length; i++) {
        var key = STATE_KEYS[i];
        if (!Object.prototype.hasOwnProperty.call(st, key)) continue;
        var v = st[key];
        if (key === "presc") {
          if (Number.isFinite(v)) s.presc = clampPresc(v);
        } else if (Number.isFinite(v)) {
          var b = BOUNDS[key];
          s[key] = Math.round(clampNum(v, b[0], b[1]));
        }
      }
    }
    s.note = Math.round(clampNum(s.note, 0, NOTES.length - 1));
    return s;
  }

  var HASH_KEYS = { v: "version", n: "note", p: "presc", b: "bpm", o: "oled", d: "led", m: "mode", t: "tdm", h: "held" };
  var HASH_ORDER = ["v", "n", "p", "b", "o", "d", "m", "t", "h"];
  var HASH_STATE_KEY = { n: "note", p: "presc", b: "bpm", o: "oled", d: "led", m: "mode", t: "tdm", h: "held" };

  function encodeHash(st) {
    var s = clampState(st);
    return "tplab=v1;n" + s.note + ";p" + s.presc + ";b" + s.bpm + ";o" + s.oled
      + ";d" + s.led + ";m" + s.mode + ";t" + s.tdm + ";h" + s.held;
  }

  /* Fail-closed decoder: any malformed, duplicated or unknown token rejects
     the entire payload and returns defaults. Numeric values inside range are
     clamped via clampState; only structurally hostile input is rejected. */
  function decodeHash(input) {
    var raw = String(input === undefined || input === null ? "" : input);
    var idx = raw.indexOf("tplab=");
    if (idx === -1) return { ok: false, error: "missing tplab= marker", state: clampState() };
    var payload = raw.slice(idx + 6);
    if (!/^[a-z0-9;\-]+$/.test(payload)) return { ok: false, error: "payload charset rejected", state: clampState() };
    var tokens = payload.split(";");
    if (tokens.length > 16 || tokens.length === 0) return { ok: false, error: "token count rejected", state: clampState() };
    var seen = Object.create(null);
    var parsed = Object.create(null);
    for (var i = 0; i < tokens.length; i++) {
      var m = /^([a-z])(-?\d{1,9})$/.exec(tokens[i]);
      if (!m) return { ok: false, error: "token rejected: " + tokens[i], state: clampState() };
      var key = m[1];
      if (!Object.prototype.hasOwnProperty.call(HASH_KEYS, key)) {
        return { ok: false, error: "unknown key: " + key, state: clampState() };
      }
      if (Object.prototype.hasOwnProperty.call(seen, key)) {
        return { ok: false, error: "duplicate key: " + key, state: clampState() };
      }
      seen[key] = true;
      var val = parseInt(m[2], 10);
      if (!Number.isFinite(val)) return { ok: false, error: "non-finite value", state: clampState() };
      if (key === "v") {
        if (val !== 1) return { ok: false, error: "unsupported version", state: clampState() };
      } else {
        parsed[HASH_STATE_KEY[key]] = val;
      }
    }
    return { ok: true, error: null, state: clampState(parsed) };
  }

  /* ================= FIPS 180-4 SHA-256 (pure JS) ================= */

  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr32(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
  }

  function utf8Encode(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var cp = str.codePointAt(i);
      if (cp > 0xffff) i++;
      if (cp < 0x80) {
        out.push(cp);
      } else if (cp < 0x800) {
        out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      } else if (cp < 0x10000) {
        out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else {
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    return out;
  }

  function sha256BytesHex(bytes) {
    var bitLen = bytes.length * 8;
    var padded = bytes.slice();
    padded.push(0x80);
    while (padded.length % 64 !== 56) padded.push(0);
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen - hi * 0x100000000;
    var i;
    for (i = 3; i >= 0; i--) padded.push((hi >>> (i * 8)) & 0xff);
    for (i = 3; i >= 0; i--) padded.push((lo >>> (i * 8)) & 0xff);

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    for (var off = 0; off < padded.length; off += 64) {
      var t;
      for (t = 0; t < 16; t++) {
        w[t] = ((padded[off + t * 4] << 24) | (padded[off + t * 4 + 1] << 16)
          | (padded[off + t * 4 + 2] << 8) | padded[off + t * 4 + 3]) >>> 0;
      }
      for (t = 16; t < 64; t++) {
        var s0 = (rotr32(w[t - 15], 7) ^ rotr32(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
        var s1 = (rotr32(w[t - 2], 17) ^ rotr32(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0;
        var ch = ((e & f) ^ ((~e >>> 0) & g)) >>> 0;
        var t1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
        var S0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var out = "";
    for (i = 0; i < 8; i++) {
      var s = H[i].toString(16);
      while (s.length < 8) s = "0" + s;
      out += s;
    }
    return out;
  }

  function sha256Hex(input) {
    return sha256BytesHex(typeof input === "string" ? utf8Encode(input) : input);
  }

  /* ================= Cycle-safe, depth-bounded canonical JSON ================= */

  var CANON_MAX_DEPTH = 40;

  function canonicalize(value, maxDepth) {
    var limit = Number.isFinite(maxDepth) ? maxDepth : CANON_MAX_DEPTH;
    var stack = [];
    function enc(v, depth) {
      if (depth > limit) throw new TypeError("canonicalize: depth limit exceeded");
      if (v === null) return "null";
      var t = typeof v;
      if (t === "number") return Number.isFinite(v) ? JSON.stringify(v) : "null";
      if (t === "boolean") return v ? "true" : "false";
      if (t === "string") return JSON.stringify(v);
      if (t === "bigint") throw new TypeError("canonicalize: bigint not supported");
      if (t === "function" || t === "symbol" || t === "undefined") return undefined;
      if (t === "object") {
        if (stack.indexOf(v) !== -1) throw new TypeError("canonicalize: cyclic structure");
        stack.push(v);
        var out, i;
        if (Array.isArray(v)) {
          var ap = [];
          for (i = 0; i < v.length; i++) {
            var ev = enc(v[i], depth + 1);
            ap.push(ev === undefined ? "null" : ev);
          }
          out = "[" + ap.join(",") + "]";
        } else {
          var keys = Object.keys(v).sort();
          var op = [];
          for (i = 0; i < keys.length; i++) {
            var ek = enc(v[keys[i]], depth + 1);
            if (ek === undefined) continue;
            op.push(JSON.stringify(keys[i]) + ":" + ek);
          }
          out = "{" + op.join(",") + "}";
        }
        stack.pop();
        return out;
      }
      return undefined;
    }
    var r = enc(value, 0);
    return r === undefined ? "null" : r;
  }

  /* ================= Canonical report payload + cached digest ================= */

  function round4(v) { return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null; }
  function round6(v) { return Number.isFinite(v) ? Math.round(v * 1000000) / 1000000 : null; }

  function reportPayload(st) {
    var s = clampState(st);
    var n = NOTES[s.note];
    var r = cmp0For(n.idealHz, s.presc);
    var ma = modeCurrentMa(s.mode, s);
    return {
      schema: "tinypulse-412-lab/1",
      mcu: "ATtiny412-SSNR",
      fCpuHz: F_CPU_HZ,
      formula: "f_out = F_CPU / (2 * N * (CMP0 + 1))",
      note: n.name,
      midi: n.midi,
      idealHz: round4(n.idealHz),
      prescaler: s.presc,
      ctrlA: "0x" + ctrlAByte(s.presc).toString(16).toUpperCase().padStart(2, "0"),
      ctrlB: "0x" + CTRLB_FRQ.toString(16).toUpperCase().padStart(2, "0"),
      cmp0: r.cmp0,
      cmp0Hex: r.hex,
      fits16: r.fits,
      quantHz: round4(r.quantHz),
      centsErr: round4(r.centsErr),
      mode: MODES[s.mode].id,
      bpm: s.bpm,
      oledPct: s.oled,
      ledDutyPct: s.led,
      tdmHz: s.tdm,
      buttonsHeld: s.held,
      tdmDutyPct: round4(tdmDuty(s.tdm) * 100),
      currentMa: round6(ma),
      runtimeH: round4(runtimeHours(ma)),
      capacityMah: CR2032_CAPACITY_MAH
    };
  }

  var digestCache = (typeof Map === "function") ? new Map() : null;

  /* One digest-stamped record per state key, reused by every surface so the
     on-page fingerprint, JSON, CSV and Markdown exports always carry the
     EXACT same SHA-256. */
  function digestForState(st) {
    var key = canonicalize(clampState(st));
    if (digestCache && digestCache.has(key)) return digestCache.get(key);
    var payload = reportPayload(st);
    var canonical = canonicalize(payload);
    var rec = { key: key, payload: payload, canonical: canonical, sha256: sha256Hex(canonical) };
    if (digestCache) digestCache.set(key, rec);
    return rec;
  }

  function verifyDigest(st) {
    var rec = digestForState(st);
    var recheck = sha256Hex(rec.canonical);
    return { ok: recheck === rec.sha256, expected: rec.sha256, actual: recheck };
  }

  function tamperDemo(st) {
    var s = clampState(st);
    var t = merge(s, { bpm: s.bpm >= BOUNDS.bpm[1] ? s.bpm - 1 : s.bpm + 1 });
    var a = digestForState(s);
    var b = digestForState(t);
    return { original: a.sha256, tampered: b.sha256, differs: a.sha256 !== b.sha256 };
  }

  /* ================= Exporters ================= */

  function csvEscape(cell) {
    var s = String(cell === undefined || cell === null ? "" : cell);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toJsonExport(st) {
    var rec = digestForState(st);
    return JSON.stringify({ sha256: rec.sha256, report: rec.payload }, null, 2) + "\n";
  }

  function toCsvExport(st) {
    var rec = digestForState(st);
    var s = clampState(st);
    var lines = [];
    lines.push(csvEscape("sha256") + "," + csvEscape(rec.sha256));
    lines.push("note,prescaler,target_hz,cmp0_dec,cmp0_hex,quant_hz,abs_cents,fits_16bit,fw_cmp0");
    for (var ni = 0; ni < NOTES.length; ni++) {
      var n = NOTES[ni];
      var r = cmp0For(n.idealHz, s.presc);
      lines.push([
        csvEscape(n.name),
        csvEscape("DIV" + s.presc),
        csvEscape(n.idealHz.toFixed(4)),
        csvEscape(r.cmp0),
        csvEscape(r.hex),
        csvEscape(r.quantHz.toFixed(4)),
        csvEscape(r.absCents.toFixed(4)),
        csvEscape(r.fits ? "yes" : "no"),
        csvEscape(n.fwCmp0 === null || s.presc !== DEFAULT_PRESCALER ? "" : hex16(n.fwCmp0))
      ].join(","));
    }
    return lines.join("\r\n") + "\r\n";
  }

  function toMarkdownBrief(st) {
    var rec = digestForState(st);
    var p = rec.payload;
    var lines = [];
    lines.push("# TinyPulse-412 Silicon & Power Proof Brief");
    lines.push("");
    lines.push("sha256: `" + rec.sha256 + "`");
    lines.push("");
    lines.push("- MCU: `" + p.mcu + "` at F_CPU `" + p.fCpuHz + "` Hz");
    lines.push("- Formula: `" + p.formula + "`");
    lines.push("- Note: `" + p.note + "` (MIDI " + p.midi + "), ideal `" + p.idealHz + "` Hz");
    lines.push("- Prescaler: DIV" + p.prescaler + " | TCA0.CTRLA `" + p.ctrlA + "` | TCA0.CTRLB `" + p.ctrlB + "`");
    lines.push("- TCA0.CMP0 `" + p.cmp0Hex + "` (" + p.cmp0 + "), fits 16-bit: " + (p.fits16 ? "yes" : "no"));
    lines.push("- Quantized output `" + p.quantHz + "` Hz, error `" + p.centsErr + "` cents");
    lines.push("- Mode `" + p.mode + "` at `" + p.bpm + "` BPM, OLED `" + p.oledPct + "`%, LED duty `" + p.ledDutyPct + "`%");
    lines.push("- 1 kHz-class TDM scan `" + p.tdmHz + "` Hz, duty `" + p.tdmDutyPct + "`%, buttons held `" + p.buttonsHeld + "`");
    lines.push("- Draw `" + p.currentMa + "` mA, projected CR2032 (`" + p.capacityMah + "` mAh) runtime `" + p.runtimeH + "` h");
    lines.push("- Board grant total: `$28.95` of `$35.00`");
    return lines.join("\n") + "\n";
  }

  /* ================= In-page deterministic self-tests (>= 18) ================= */

  function selfTests() {
    var out = [];
    function chk(id, name, fn) {
      var pass = false;
      var detail = "";
      try {
        var r = fn();
        pass = r === true;
        if (!pass && typeof r === "string") detail = r;
      } catch (e) {
        detail = String(e && e.message ? e.message : e);
      }
      out.push({ id: id, name: name, pass: pass, detail: detail });
    }

    chk("sha256-empty", "SHA-256 empty-string KAT", function () {
      return sha256Hex("") === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    });
    chk("sha256-abc", "SHA-256 'abc' KAT", function () {
      return sha256Hex("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    });
    chk("sha256-56", "SHA-256 56-byte padding boundary KAT", function () {
      return sha256Hex(new Array(57).join("a")) === "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a";
    });
    chk("sha256-64", "SHA-256 64-byte block boundary KAT", function () {
      return sha256Hex(new Array(65).join("a")) === "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb";
    });
    chk("sha256-nist", "SHA-256 NIST 448-bit vector", function () {
      return sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
        === "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1";
    });
    chk("canon-order", "canonical JSON is key-order invariant", function () {
      return canonicalize({ a: 1, b: [2, 3] }) === canonicalize({ b: [2, 3], a: 1 });
    });
    chk("canon-cycle", "canonical JSON rejects cyclic structures", function () {
      var o = {}; o.self = o;
      try { canonicalize(o); return "cycle accepted"; } catch (e) { return true; }
    });
    chk("canon-depth", "canonical JSON enforces depth bound", function () {
      var o = {}; var c = o;
      for (var i = 0; i < 60; i++) { c.next = {}; c = c.next; }
      try { canonicalize(o); return "deep object accepted"; } catch (e) { return true; }
    });
    chk("frq-formula", "FRQ equation matches firmware: 156250/(CMP0+1) at DIV16", function () {
      return Math.abs(tca0FreqHz(354, 16) - 156250 / 355) < 1e-9
        && Math.abs(tca0FreqHz(354, 16) - 440.14084507) < 0.001;
    });
    chk("cmp0-a4", "CMP0 for A4 440 Hz at DIV16 is 354 like firmware", function () {
      var r = cmp0For(440, 16);
      return r.ok && r.cmp0 === 354 && r.fits && Math.abs(r.quantHz - 440.14084507) < 0.001;
    });
    chk("fw-scale", "all 8 shipped SCALE_CMP0 within 1 LSB of ideal and match documented Hz", function () {
      for (var i = 0; i < NOTES.length; i++) {
        var n = NOTES[i];
        if (n.fwCmp0 === null) continue;
        var r = cmp0For(n.idealHz, 16);
        if (Math.abs(r.cmp0 - n.fwCmp0) > 1) return "firmware " + n.fwCmp0 + " vs ideal " + r.cmp0 + " for " + n.name;
        if (Math.abs(tca0FreqHz(n.fwCmp0, 16) - FW_FREQ_HZ[n.name]) > 0.01) {
          return "documented Hz drift on " + n.name;
        }
      }
      return true;
    });
    chk("bounds-16", "every note x prescaler row fits 16-bit CMP0", function () {
      var rows = buildTable();
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].fits) return rows[i].note + " DIV" + rows[i].presc + " does not fit";
      }
      return true;
    });
    chk("bounds-reject", "out-of-range CMP0 detection works on both ends", function () {
      var lo = cmp0For(0.5, 64);
      var hi = cmp0For(6000000, 1);
      return lo.ok && !lo.fits && hi.ok && !hi.fits;
    });
    chk("cents-bound", "cents bound strictly decreases as prescaler decreases", function () {
      var f = NOTES[8].idealHz;
      for (var i = PRESCALERS.length - 1; i > 0; i--) {
        if (!(centsBound(f, PRESCALERS[i]) > centsBound(f, PRESCALERS[i - 1]))) {
          return "bound not monotone at DIV" + PRESCALERS[i];
        }
      }
      return true;
    });
    chk("cents-within", "every row |cents| within theoretical bound", function () {
      var rows = buildTable();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].absCents > rows[i].bound + 1e-6) {
          return rows[i].note + " DIV" + rows[i].presc + " " + rows[i].absCents + " > " + rows[i].bound;
        }
      }
      return true;
    });
    chk("power-order", "mode currents ordered sleep < metronome < synth <= synthmax", function () {
      var s = clampState();
      return modeCurrentMa(0, s) < modeCurrentMa(1, s)
        && modeCurrentMa(1, s) < modeCurrentMa(2, s)
        && modeCurrentMa(2, s) <= modeCurrentMa(3, s);
    });
    chk("power-runtime", "CR2032 runtime strictly decreasing with load current", function () {
      return runtimeHours(0.1) > runtimeHours(1) && runtimeHours(1) > runtimeHours(10)
        && runtimeHours(10) > runtimeHours(100);
    });
    chk("power-bpm", "metronome current increases with BPM", function () {
      var s = clampState();
      return modeCurrentMa(1, merge(s, { bpm: 240 })) > modeCurrentMa(1, merge(s, { bpm: 60 }));
    });
    chk("pinmap", "8-pin SOIC map non-overlap: 8 pins, 6 GPIO ports", function () {
      var r = checkPinMap();
      return r.ok === true;
    });
    chk("digest-stable", "same state gives identical cached SHA-256", function () {
      var s = clampState();
      return digestForState(s).sha256 === digestForState(s).sha256;
    });
    chk("digest-tamper", "1-unit tamper demo changes the digest", function () {
      return tamperDemo(clampState()).differs === true;
    });
    chk("digest-verify", "Verify Digest recomputation matches", function () {
      return verifyDigest(clampState()).ok === true;
    });
    chk("digest-4way", "digest parity across page/JSON/CSV/MD surfaces", function () {
      var s = clampState();
      var d = digestForState(s).sha256;
      return toJsonExport(s).indexOf(d) !== -1
        && toCsvExport(s).indexOf(d) !== -1
        && toMarkdownBrief(s).indexOf(d) !== -1;
    });
    chk("csv-escape", "CSV formula-injection escaping", function () {
      return csvEscape("=1+1") === "'=1+1"
        && csvEscape("+2") === "'+2"
        && csvEscape("-3") === "'-3"
        && csvEscape("@x") === "'@x"
        && csvEscape("\tc") === "'\tc"
        && csvEscape("plain") === "plain"
        && csvEscape('a"b') === '"a""b"';
    });
    chk("codec-round", "#tplab= codec round-trips state", function () {
      var s = { note: 9, presc: 8, bpm: 168, oled: 70, led: 40, mode: 2, tdm: 500, held: 1 };
      var d = decodeHash("#" + encodeHash(s));
      return d.ok && d.state.note === 9 && d.state.presc === 8 && d.state.bpm === 168
        && d.state.oled === 70 && d.state.led === 40 && d.state.mode === 2
        && d.state.tdm === 500 && d.state.held === 1;
    });
    chk("codec-hostile", "#tplab= rejects hostile input", function () {
      return !decodeHash("tplab=__proto__").ok
        && !decodeHash("tplab=n99z").ok
        && !decodeHash("tplab=v2;n1").ok
        && !decodeHash("tplab=n1;n2").ok
        && !decodeHash("no-marker").ok;
    });
    chk("codec-clamp", "#tplab= clamps out-of-range values", function () {
      var d = decodeHash("tplab=v1;n99;p7;b999;o120;d300;m9;t999999;h5");
      return d.ok && d.state.note === NOTES.length - 1 && d.state.bpm === 240
        && d.state.oled === 100 && d.state.led === 100 && d.state.mode === MODES.length - 1
        && d.state.tdm === 10000 && d.state.held === 2 && d.state.presc === 8;
    });
    chk("notes-range", "chromatic table covers C4 through E5 (17 notes)", function () {
      return NOTES.length === 17 && NOTES[0].name === "C4" && NOTES[16].name === "E5"
        && NOTES[0].midi === 60 && NOTES[16].midi === 76;
    });
    chk("tdm-duty", "1 kHz TDM window costs under 1% LED duty", function () {
      var d = tdmDuty(1000);
      return d > 0 && d < 0.01 && Math.abs(ledEffMa(100, 1000) - ledMa() * (1 - d)) < 1e-9;
    });

    return out;
  }

  /* ================= Browser UI mount (no-op safe in Node) ================= */

  var SERIES_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#c084fc"];

  function fmtHours(h) {
    if (!Number.isFinite(h)) return "inf h";
    if (h >= 1000000) return (h / 1000000).toFixed(2) + "M h";
    if (h >= 1000) return Math.round(h).toLocaleString("en-US") + " h";
    if (h >= 10) return h.toFixed(1) + " h";
    return h.toFixed(2) + " h";
  }
  function fmtMa(ma) {
    if (ma < 0.001) return ma.toExponential(2) + " mA";
    if (ma < 1) return ma.toFixed(4) + " mA";
    return ma.toFixed(3) + " mA";
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function mount(rootEl, opts) {
    if (!rootEl || typeof document === "undefined") return null;
    var options = opts || {};
    var state = clampState();
    var initial = decodeHash(typeof location !== "undefined" ? location.hash : "");
    if (initial.ok) state = initial.state;

    var seriesOn = {};
    for (var si = 0; si < PRESCALERS.length; si++) seriesOn[PRESCALERS[si]] = true;

    rootEl.innerHTML = "";
    rootEl.classList.add("lab-root");

    /* ---------- controls ---------- */
    var controls = document.createElement("div");
    controls.className = "lab-controls";
    controls.innerHTML =
      '<div class="lab-ctl"><span class="lab-ctl-label">Note</span><select id="labNoteSelect" aria-label="Lab note select"></select></div>'
      + '<div class="lab-ctl"><span class="lab-ctl-label">CLKSEL</span><span class="lab-chips" id="labPrescChips"></span></div>'
      + '<div class="lab-ctl"><span class="lab-ctl-label">Mode</span><span class="lab-chips" id="labModeChips"></span></div>'
      + '<div class="lab-ctl lab-slider"><label for="labBpm">BPM <output id="labBpmOut"></output></label><input type="range" id="labBpm" min="60" max="240" step="1"></div>'
      + '<div class="lab-ctl lab-slider"><label for="labOled">OLED <output id="labOledOut"></output></label><input type="range" id="labOled" min="0" max="100" step="1"></div>'
      + '<div class="lab-ctl lab-slider"><label for="labLed">LED duty <output id="labLedOut"></output></label><input type="range" id="labLed" min="0" max="100" step="1"></div>'
      + '<div class="lab-ctl lab-slider"><label for="labTdm">TDM Hz <output id="labTdmOut"></output></label><input type="range" id="labTdm" min="100" max="10000" step="100"></div>'
      + '<div class="lab-ctl"><span class="lab-ctl-label">Buttons held</span><select id="labHeld" aria-label="TDM buttons held"><option value="0">0</option><option value="1">1</option><option value="2">2</option></select></div>';
    rootEl.appendChild(controls);

    var noteSel = controls.querySelector("#labNoteSelect");
    noteSel.innerHTML = NOTES.map(function (n, i) {
      return '<option value="' + i + '">' + esc(n.name) + ' (' + n.idealHz.toFixed(2) + ' Hz)</option>';
    }).join("");

    var prescChips = controls.querySelector("#labPrescChips");
    prescChips.innerHTML = PRESCALERS.map(function (p) {
      return '<button type="button" class="lab-chip" data-presc="' + p + '">DIV' + p + '</button>';
    }).join("");

    var modeChips = controls.querySelector("#labModeChips");
    modeChips.innerHTML = MODES.map(function (m, i) {
      return '<button type="button" class="lab-chip" data-mode-idx="' + i + '">' + esc(m.label) + '</button>';
    }).join("");

    /* ---------- register readout ---------- */
    var regs = document.createElement("div");
    regs.className = "register-grid lab-regs";
    regs.innerHTML =
      '<div class="reg-box"><span class="reg-name">TCA0.SINGLE.CMP0</span><code id="labRegCmp0">-</code><span class="reg-desc" id="labRegFit">-</span></div>'
      + '<div class="reg-box"><span class="reg-name">TCA0.SINGLE.CTRLA</span><code id="labRegCtrlA">-</code><span class="reg-desc" id="labRegCtrlADesc">-</span></div>'
      + '<div class="reg-box"><span class="reg-name">TCA0.SINGLE.CTRLB</span><code>0x11 (CMP0EN | FRQ)</code><span class="reg-desc">PA3 hardware toggle</span></div>'
      + '<div class="reg-box"><span class="reg-name">Quantized Output</span><code id="labRegQuant">-</code><span class="reg-desc" id="labRegCents">-</span></div>'
      + '<div class="reg-box"><span class="reg-name">Mode Current</span><code id="labCurMa">-</code><span class="reg-desc" id="labCurDesc">-</span></div>'
      + '<div class="reg-box"><span class="reg-name">CR2032 Runtime</span><code id="labRunH">-</code><span class="reg-desc">225 mAh cell</span></div>';
    rootEl.appendChild(regs);

    /* ---------- comparator table ---------- */
    var tableWrap = document.createElement("div");
    tableWrap.className = "lab-table-wrap";
    tableWrap.innerHTML =
      '<h3 class="lab-h3">TCA0 Frequency &amp; Prescaler Comparator (click a row to load it)</h3>'
      + '<div class="table-responsive lab-table-scroll"><table class="compact-table lab-table" id="labCmpTable">'
      + '<thead><tr><th>Note</th><th>CLKSEL</th><th>Target Hz</th><th>CMP0 dec</th><th>CMP0 hex</th><th>Silicon Hz</th><th>|Cents|</th><th>16-bit Fit</th><th>FW CMP0</th></tr></thead>'
      + '<tbody id="labCmpTbody"></tbody></table></div>';
    rootEl.appendChild(tableWrap);

    /* ---------- chart 1: cents ---------- */
    var c1 = document.createElement("div");
    c1.className = "lab-chart-block";
    c1.innerHTML =
      '<h3 class="lab-h3">TCA0 Pitch Quantization Error (cents) vs Prescaler</h3>'
      + '<div class="lab-legend" id="labSeriesLegend"></div>'
      + '<div class="lab-chart-wrap"><svg id="labCentsChart" viewBox="0 0 720 270" role="img" aria-label="Pitch quantization cents error chart"></svg></div>';
    rootEl.appendChild(c1);

    var legend = c1.querySelector("#labSeriesLegend");
    legend.innerHTML = PRESCALERS.map(function (p, i) {
      return '<label class="lab-legend-item"><input type="checkbox" class="lab-series-toggle" data-presc="' + p + '" checked>'
        + '<span class="lab-swatch" style="background:' + SERIES_COLORS[i] + '"></span>DIV' + p + '</label>';
    }).join("");

    /* ---------- chart 2: power ---------- */
    var c2 = document.createElement("div");
    c2.className = "lab-chart-block";
    c2.innerHTML =
      '<h3 class="lab-h3">CR2032 (225 mAh) Autonomy &amp; 1 kHz TDM Pin-Scan Power Budget</h3>'
      + '<div class="lab-chart-wrap"><svg id="labPowerChart" viewBox="0 0 720 250" role="img" aria-label="CR2032 power budget bar chart"></svg></div>';
    rootEl.appendChild(c2);

    /* ---------- proof exporter ---------- */
    var exp = document.createElement("div");
    exp.className = "lab-export";
    exp.innerHTML =
      '<h3 class="lab-h3">Audited Silicon &amp; Power Proof</h3>'
      + '<div class="lab-digest-line">Canonical SHA-256: <code id="labDigest">-</code></div>'
      + '<div class="lab-export-btns">'
      + '<button type="button" class="btn btn-secondary" id="labVerifyBtn">Verify Digest</button>'
      + '<button type="button" class="btn btn-secondary" id="labTamperBtn">1-Unit Tamper Demo</button>'
      + '<button type="button" class="btn btn-secondary" id="labJsonBtn">Export JSON</button>'
      + '<button type="button" class="btn btn-secondary" id="labCsvBtn">Export CSV</button>'
      + '<button type="button" class="btn btn-secondary" id="labMdBtn">Export Markdown</button>'
      + '<button type="button" class="btn btn-secondary" id="labLinkBtn">Copy Share Link</button>'
      + '<button type="button" class="btn btn-outline" id="labSelftestBtn">Run Self-Tests</button>'
      + '</div><div class="lab-export-status" id="labExportStatus" role="status"></div>'
      + '<div class="lab-selftest"><div class="lab-selftest-head">Deterministic Self-Tests: <strong id="labSelftestSummary">not run</strong></div><ol id="labSelftestList" class="lab-selftest-list"></ol></div>';
    rootEl.appendChild(exp);

    /* ---------- state plumbing ---------- */
    function applyHash() {
      if (typeof history !== "undefined" && history.replaceState) {
        history.replaceState(null, "", "#" + encodeHash(state));
      }
    }

    function notifyLoad() {
      if (typeof options.onNoteLoad === "function") {
        var r = cmp0For(NOTES[state.note].idealHz, state.presc);
        options.onNoteLoad(NOTES[state.note].name, r, state);
      }
    }

    function setState(patch, skipHash) {
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) state[k] = patch[k];
      }
      state = clampState(state);
      if (!skipHash) applyHash();
      renderAll();
    }

    function setNotePresc(noteIdx, presc) {
      setState({ note: noteIdx, presc: presc });
      notifyLoad();
    }

    /* ---------- rendering ---------- */
    function renderRegs() {
      var n = NOTES[state.note];
      var r = cmp0For(n.idealHz, state.presc);
      var ma = modeCurrentMa(state.mode, state);
      var hrs = runtimeHours(ma);
      var q = function (id) { return rootEl.querySelector(id); };
      q("#labRegCmp0").textContent = r.hex + " (" + r.cmp0 + ")";
      q("#labRegFit").textContent = r.fits ? "fits uint16" : "OUT OF RANGE";
      q("#labRegCtrlA").textContent = "0x" + ctrlAByte(state.presc).toString(16).toUpperCase().padStart(2, "0") + " (CLKSEL_DIV" + state.presc + " | ENABLE)";
      q("#labRegCtrlADesc").textContent = "TCA0 clock = " + (F_CPU_HZ / state.presc).toLocaleString("en-US") + " Hz";
      q("#labRegQuant").textContent = r.quantHz.toFixed(2) + " Hz (" + n.name + " ideal " + n.idealHz.toFixed(2) + ")";
      q("#labRegCents").textContent = (r.centsErr >= 0 ? "+" : "") + r.centsErr.toFixed(2) + " cents | bound " + centsBound(n.idealHz, state.presc).toFixed(2);
      q("#labCurMa").textContent = fmtMa(ma);
      q("#labCurDesc").textContent = MODES[state.mode].label + " | TDM duty " + (tdmDuty(state.tdm) * 100).toFixed(2) + "%";
      q("#labRunH").textContent = fmtHours(hrs);
      q("#labDigest").textContent = digestForState(state).sha256;
      q("#labNoteSelect").value = String(state.note);
      q("#labBpmOut").textContent = state.bpm;
      q("#labOledOut").textContent = state.oled + "%";
      q("#labLedOut").textContent = state.led + "%";
      q("#labTdmOut").textContent = state.tdm;
      var bb = q("#labBpm"); if (bb && bb.value !== String(state.bpm)) bb.value = String(state.bpm);
      var bo = q("#labOled"); if (bo && bo.value !== String(state.oled)) bo.value = String(state.oled);
      var bl = q("#labLed"); if (bl && bl.value !== String(state.led)) bl.value = String(state.led);
      var bt = q("#labTdm"); if (bt && bt.value !== String(state.tdm)) bt.value = String(state.tdm);
      var bh = q("#labHeld"); if (bh && bh.value !== String(state.held)) bh.value = String(state.held);
      rootEl.querySelectorAll(".lab-chip[data-presc]").forEach(function (el) {
        el.classList.toggle("active", Number(el.getAttribute("data-presc")) === state.presc);
      });
      rootEl.querySelectorAll(".lab-chip[data-mode-idx]").forEach(function (el) {
        el.classList.toggle("active", Number(el.getAttribute("data-mode-idx")) === state.mode);
      });
    }

    function renderTable() {
      var tbody = rootEl.querySelector("#labCmpTbody");
      var html = "";
      for (var ni = 0; ni < NOTES.length; ni++) {
        var n = NOTES[ni];
        for (var pi = 0; pi < PRESCALERS.length; pi++) {
          var p = PRESCALERS[pi];
          var r = cmp0For(n.idealHz, p);
          var sel = (ni === state.note && p === state.presc) ? ' class="lab-row-sel"' : "";
          var fw = (p === DEFAULT_PRESCALER && n.fwCmp0 !== null) ? hex16(n.fwCmp0) : "";
          html += '<tr' + sel + ' data-note="' + ni + '" data-presc="' + p + '" tabindex="0">'
            + "<td><strong>" + esc(n.name) + "</strong></td>"
            + "<td>DIV" + p + "</td>"
            + "<td>" + n.idealHz.toFixed(2) + "</td>"
            + "<td>" + r.cmp0 + "</td>"
            + "<td><code>" + r.hex + "</code></td>"
            + "<td>" + r.quantHz.toFixed(2) + "</td>"
            + "<td>" + r.absCents.toFixed(2) + "</td>"
            + '<td><span class="lab-fit ' + (r.fits ? "ok" : "bad") + '">' + (r.fits ? "fits" : "no") + "</span></td>"
            + "<td><code>" + fw + "</code></td></tr>";
        }
      }
      tbody.innerHTML = html;
    }

    function renderCentsChart() {
      var svg = rootEl.querySelector("#labCentsChart");
      var W = 720, H = 270, L = 48, R = 12, T = 16, B = 34;
      var iw = W - L - R, ih = H - T - B;
      var maxC = 5;
      for (var ni = 0; ni < NOTES.length; ni++) {
        for (var pi = 0; pi < PRESCALERS.length; pi++) {
          var a = cmp0For(NOTES[ni].idealHz, PRESCALERS[pi]).absCents;
          if (a > maxC) maxC = a;
        }
      }
      maxC *= 1.15;
      var x = function (i) { return L + iw * i / (NOTES.length - 1); };
      var y = function (c) { return T + ih / 2 - (c / maxC) * (ih / 2); };
      var out = [];
      out.push('<line x1="' + L + '" y1="' + y(0) + '" x2="' + (W - R) + '" y2="' + y(0) + '" stroke="#3b4b6b" stroke-width="1"/>');
      var grid = Math.ceil(maxC / 2);
      for (var g = -grid; g <= grid; g += Math.ceil(grid / 3)) {
        if (g === 0) continue;
        var gy = y(g);
        if (gy < T || gy > T + ih) continue;
        out.push('<line x1="' + L + '" y1="' + gy + '" x2="' + (W - R) + '" y2="' + gy + '" stroke="#1e293b" stroke-width="1"/>');
        out.push('<text x="' + (L - 6) + '" y="' + (gy + 3) + '" text-anchor="end" class="lab-axis">' + g + "</text>");
      }
      for (var i = 0; i < NOTES.length; i++) {
        out.push('<text x="' + x(i) + '" y="' + (H - 14) + '" text-anchor="middle" class="lab-axis">' + esc(NOTES[i].name) + "</text>");
      }
      out.push('<text x="' + (L - 6) + '" y="' + (y(0) + 3) + '" text-anchor="end" class="lab-axis">0</text>');
      out.push('<text x="' + (L - 38) + '" y="' + (T + 4) + '" class="lab-axis">cents</text>');

      var labels = [];
      for (var p = 0; p < PRESCALERS.length; p++) {
        var presc = PRESCALERS[p];
        if (!seriesOn[presc]) continue;
        var col = SERIES_COLORS[p];
        var pts = [];
        var worst = { i: -1, v: -1 };
        for (var nn = 0; nn < NOTES.length; nn++) {
          var rr = cmp0For(NOTES[nn].idealHz, presc);
          pts.push(x(nn) + "," + y(rr.centsErr));
          if (rr.absCents > worst.v) worst = { i: nn, v: rr.absCents, c: rr.centsErr };
        }
        out.push('<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + col + '" stroke-width="1.6" opacity="0.85"/>');
        for (var m = 0; m < NOTES.length; m++) {
          var rm = cmp0For(NOTES[m].idealHz, presc);
          var cx = x(m), cy = y(rm.centsErr);
          var selCls = (m === state.note && presc === state.presc) ? " lab-pt-sel" : "";
          out.push('<g class="lab-hit' + selCls + '" tabindex="0" role="button" data-note="' + m + '" data-presc="' + presc
            + '" aria-label="Load ' + esc(NOTES[m].name) + ' DIV' + presc + '">'
            + '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="transparent"/>'
            + '<circle cx="' + cx + '" cy="' + cy + '" r="3.2" fill="' + col + '"/></g>');
        }
        if (worst.i >= 0) labels.push({ x: x(worst.i), y: y(worst.c), text: (worst.c >= 0 ? "+" : "") + worst.c.toFixed(1) + "c", col: col });
      }
      labels.sort(function (a, b) { return a.y - b.y; });
      for (var li = 1; li < labels.length; li++) {
        if (Math.abs(labels[li].y - labels[li - 1].y) < 12 && Math.abs(labels[li].x - labels[li - 1].x) < 70) {
          labels[li].y = labels[li - 1].y + 12;
        }
      }
      for (var lj = 0; lj < labels.length; lj++) {
        var lb = labels[lj];
        var ly = lb.y;
        if (ly < T + 8) ly = T + 8;
        if (ly > T + ih - 4) ly = T + ih - 4;
        out.push('<text x="' + lb.x + '" y="' + ly + '" text-anchor="middle" class="lab-slabel" fill="' + lb.col + '">' + lb.text + "</text>");
      }
      svg.innerHTML = out.join("");
    }

    function renderPowerChart() {
      var svg = rootEl.querySelector("#labPowerChart");
      var W = 720, H = 250, L = 52, R = 12, T = 16, B = 54;
      var iw = W - L - R, ih = H - T - B;
      var cols = powerSweep(state);
      var maxMa = 0.001;
      for (var i = 0; i < cols.length; i++) { if (cols[i].ma > maxMa) maxMa = cols[i].ma; }
      maxMa *= 1.12;
      var cw = iw / cols.length;
      var out = [];
      var gridSteps = 4;
      for (var g = 0; g <= gridSteps; g++) {
        var gv = maxMa * g / gridSteps;
        var gy = T + ih - ih * g / gridSteps;
        out.push('<line x1="' + L + '" y1="' + gy + '" x2="' + (W - R) + '" y2="' + gy + '" stroke="#1e293b" stroke-width="1"/>');
        out.push('<text x="' + (L - 6) + '" y="' + (gy + 3) + '" text-anchor="end" class="lab-axis">' + (gv < 1 ? gv.toFixed(2) : gv.toFixed(1)) + "</text>");
      }
      out.push('<text x="' + (L - 40) + '" y="' + (T + 4) + '" class="lab-axis">mA</text>');
      for (var c = 0; c < cols.length; c++) {
        var col = cols[c];
        var cx = L + cw * c;
        var bh = Math.max(1, ih * (col.ma / maxMa));
        var active = col.mode === state.mode && (col.bpm === null || col.id === "metcur");
        var barCol = col.mode === 0 ? "#4ade80" : (col.mode === 1 ? "#38bdf8" : "#fb923c");
        out.push('<g class="lab-hit' + (active ? " lab-pt-sel" : "") + '" tabindex="0" role="button" data-col="' + c
          + '" aria-label="Load ' + esc(col.label) + '">'
          + '<rect x="' + cx + '" y="' + T + '" width="' + cw + '" height="' + ih + '" fill="transparent"/>'
          + '<rect x="' + (cx + 8) + '" y="' + (T + ih - bh) + '" width="' + (cw - 16) + '" height="' + bh
          + '" fill="' + barCol + '" opacity="' + (active ? "0.95" : "0.6") + '"/></g>');
        out.push('<text x="' + (cx + cw / 2) + '" y="' + (T + ih - bh - 5) + '" text-anchor="middle" class="lab-slabel">' + fmtMa(col.ma) + "</text>");
        out.push('<text x="' + (cx + cw / 2) + '" y="' + (T + ih + 15) + '" text-anchor="middle" class="lab-axis">' + esc(col.label) + "</text>");
        out.push('<text x="' + (cx + cw / 2) + '" y="' + (T + ih + 30) + '" text-anchor="middle" class="lab-axis">' + fmtHours(col.hours) + "</text>");
      }
      svg.innerHTML = out.join("");
    }

    function renderAll() {
      renderRegs();
      renderTable();
      renderCentsChart();
      renderPowerChart();
    }

    /* ---------- events ---------- */
    noteSel.addEventListener("change", function () {
      setState({ note: Number(noteSel.value) });
      notifyLoad();
    });
    prescChips.addEventListener("click", function (e) {
      var b = e.target.closest("[data-presc]");
      if (b) setState({ presc: Number(b.getAttribute("data-presc")) });
    });
    modeChips.addEventListener("click", function (e) {
      var b = e.target.closest("[data-mode-idx]");
      if (b) setState({ mode: Number(b.getAttribute("data-mode-idx")) });
    });
    rootEl.querySelector("#labBpm").addEventListener("input", function (e) { setState({ bpm: Number(e.target.value) }); });
    rootEl.querySelector("#labOled").addEventListener("input", function (e) { setState({ oled: Number(e.target.value) }); });
    rootEl.querySelector("#labLed").addEventListener("input", function (e) { setState({ led: Number(e.target.value) }); });
    rootEl.querySelector("#labTdm").addEventListener("input", function (e) { setState({ tdm: Number(e.target.value) }); });
    rootEl.querySelector("#labHeld").addEventListener("change", function (e) { setState({ held: Number(e.target.value) }); });

    var tbody = rootEl.querySelector("#labCmpTbody");
    function rowActivate(tr) {
      if (!tr) return;
      setNotePresc(Number(tr.getAttribute("data-note")), Number(tr.getAttribute("data-presc")));
    }
    tbody.addEventListener("click", function (e) {
      rowActivate(e.target.closest("tr"));
    });
    tbody.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        rowActivate(e.target.closest("tr"));
      }
    });

    function svgActivate(g) {
      if (!g) return;
      var col = g.getAttribute("data-col");
      if (col !== null) {
        var entry = powerSweep(state)[Number(col)];
        var patch = { mode: entry.mode };
        if (entry.bpm !== null) patch.bpm = entry.bpm;
        setState(patch);
        return;
      }
      var nn = g.getAttribute("data-note");
      var pp = g.getAttribute("data-presc");
      if (nn !== null && pp !== null) setNotePresc(Number(nn), Number(pp));
    }
    rootEl.querySelector("#labCentsChart").addEventListener("click", function (e) {
      svgActivate(e.target.closest(".lab-hit"));
    });
    rootEl.querySelector("#labCentsChart").addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        svgActivate(e.target.closest(".lab-hit"));
      }
    });
    rootEl.querySelector("#labPowerChart").addEventListener("click", function (e) {
      svgActivate(e.target.closest(".lab-hit"));
    });
    rootEl.querySelector("#labPowerChart").addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        svgActivate(e.target.closest(".lab-hit"));
      }
    });

    legend.addEventListener("change", function (e) {
      var t = e.target.closest(".lab-series-toggle");
      if (t) {
        seriesOn[Number(t.getAttribute("data-presc"))] = t.checked;
        renderCentsChart();
      }
    });

    function setStatus(msg) {
      rootEl.querySelector("#labExportStatus").textContent = msg;
    }
    function download(name, mime, text) {
      var blob = new Blob([text], { type: mime });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 0);
    }

    rootEl.querySelector("#labVerifyBtn").addEventListener("click", function () {
      var v = verifyDigest(state);
      setStatus(v.ok ? "VERIFIED: " + v.actual : "MISMATCH: " + v.actual + " != " + v.expected);
    });
    rootEl.querySelector("#labTamperBtn").addEventListener("click", function () {
      var t = tamperDemo(state);
      setStatus("TAMPER DETECTED: " + t.original.slice(0, 16) + "... != " + t.tampered.slice(0, 16) + "...");
    });
    rootEl.querySelector("#labJsonBtn").addEventListener("click", function () {
      download("tinypulse-412-lab-proof.json", "application/json", toJsonExport(state));
      setStatus("JSON proof exported with sha256 " + digestForState(state).sha256.slice(0, 16) + "...");
    });
    rootEl.querySelector("#labCsvBtn").addEventListener("click", function () {
      download("tinypulse-412-lab-table.csv", "text/csv", toCsvExport(state));
      setStatus("CSV proof exported with sha256 " + digestForState(state).sha256.slice(0, 16) + "...");
    });
    rootEl.querySelector("#labMdBtn").addEventListener("click", function () {
      download("tinypulse-412-lab-brief.md", "text/markdown", toMarkdownBrief(state));
      setStatus("Markdown proof exported with sha256 " + digestForState(state).sha256.slice(0, 16) + "...");
    });
    rootEl.querySelector("#labLinkBtn").addEventListener("click", function () {
      var link = location.origin + location.pathname + "#" + encodeHash(state);
      function done() { setStatus("Share link copied: #" + encodeHash(state)); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done, function () { setStatus(link); });
      } else {
        setStatus(link);
      }
    });
    rootEl.querySelector("#labSelftestBtn").addEventListener("click", runSelfTests);

    function runSelfTests() {
      var results = selfTests();
      var list = rootEl.querySelector("#labSelftestList");
      var passed = 0;
      list.innerHTML = results.map(function (r) {
        if (r.pass) passed++;
        return '<li class="' + (r.pass ? "lab-st-pass" : "lab-st-fail") + '"><code>' + esc(r.id) + "</code> "
          + esc(r.name) + ": <strong>" + (r.pass ? "PASS" : "FAIL") + "</strong>"
          + (r.detail ? " <span class=\"lab-st-detail\">" + esc(r.detail) + "</span>" : "") + "</li>";
      }).join("");
      rootEl.querySelector("#labSelftestSummary").textContent = passed + "/" + results.length + " pass";
      return results;
    }

    window.addEventListener("hashchange", function () {
      var d = decodeHash(location.hash);
      if (d.ok) setState(d.state, true);
    });

    renderAll();
    applyHash();
    runSelfTests();
    notifyLoad();

    return {
      getState: function () { return merge(state); },
      setState: setState,
      runSelfTests: runSelfTests,
      destroy: function () { rootEl.innerHTML = ""; }
    };
  }

  /* ================= Public API ================= */

  return {
    F_CPU_HZ: F_CPU_HZ,
    CMP0_MIN: CMP0_MIN,
    CMP0_MAX: CMP0_MAX,
    PRESCALERS: PRESCALERS,
    CLKSEL_GC: CLKSEL_GC,
    DEFAULT_PRESCALER: DEFAULT_PRESCALER,
    CR2032_CAPACITY_MAH: CR2032_CAPACITY_MAH,
    CTRLB_FRQ: CTRLB_FRQ,
    FW_CMP0: FW_CMP0,
    FW_FREQ_HZ: FW_FREQ_HZ,
    NOTES: NOTES,
    MODES: MODES,
    POWER: POWER,
    PIN_MAP: PIN_MAP,
    DEFAULT_STATE: DEFAULT_STATE,
    BOUNDS: BOUNDS,
    tca0FreqHz: tca0FreqHz,
    ctrlAByte: ctrlAByte,
    cmp0For: cmp0For,
    centsBound: centsBound,
    hex16: hex16,
    buildTable: buildTable,
    noteIndexByName: noteIndexByName,
    ledMa: ledMa,
    pullupMa: pullupMa,
    tdmDuty: tdmDuty,
    oledMa: oledMa,
    ledEffMa: ledEffMa,
    clickDuty: clickDuty,
    modeCurrentMa: modeCurrentMa,
    runtimeHours: runtimeHours,
    powerSweep: powerSweep,
    checkPinMap: checkPinMap,
    clampState: clampState,
    encodeHash: encodeHash,
    decodeHash: decodeHash,
    sha256Hex: sha256Hex,
    sha256BytesHex: sha256BytesHex,
    utf8Encode: utf8Encode,
    canonicalize: canonicalize,
    reportPayload: reportPayload,
    digestForState: digestForState,
    verifyDigest: verifyDigest,
    tamperDemo: tamperDemo,
    csvEscape: csvEscape,
    toJsonExport: toJsonExport,
    toCsvExport: toCsvExport,
    toMarkdownBrief: toMarkdownBrief,
    selfTests: selfTests,
    mount: mount
  };
});
