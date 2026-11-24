const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  SCALE_NOTES,
  BOM_ITEMS,
  PCB_TRACES,
  computeTca0FrequencyHz,
  computeTotalBudgetUsd,
  computePortaOutMask
} = require("./app.js");

const L = require("./attiny-lab.js");

const ROOT = __dirname;

test("1. KiCad 8 schematic, PCB layout (38.0 x 25.0 mm), and OSH Park DRC rules are valid", () => {
  const proPath = path.join(ROOT, "hardware", "tinypulse-412.kicad_pro");
  const schPath = path.join(ROOT, "hardware", "tinypulse-412.kicad_sch");
  const pcbPath = path.join(ROOT, "hardware", "tinypulse-412.kicad_pcb");

  assert.ok(fs.existsSync(proPath), "Missing tinypulse-412.kicad_pro");
  assert.ok(fs.existsSync(schPath), "Missing tinypulse-412.kicad_sch");
  assert.ok(fs.existsSync(pcbPath), "Missing tinypulse-412.kicad_pcb");

  const pro = JSON.parse(fs.readFileSync(proPath, "utf8"));
  assert.ok(pro.board.design_settings.rules.min_track_width >= 0.1524, "Track width must meet OSH Park 6 mil rule");
  assert.ok(pro.board.design_settings.rules.min_clearance >= 0.1524, "Clearance must meet OSH Park 6 mil rule");

  const sch = fs.readFileSync(schPath, "utf8");
  assert.match(sch, /ATtiny412-SSNR/);
  assert.match(sch, /CL21B104KBCNNNC/);
  assert.match(sch, /PA0_UPDI/);

  const pcb = fs.readFileSync(pcbPath, "utf8");
  assert.match(pcb, /\(gr_rect \(start 100\.0 100\.0\) \(end 138\.0 125\.0\)/, "Board outline must be 38.0 x 25.0 mm");
  assert.match(pcb, /SOIC-8 CLIP KEEPOUT/);
  assert.match(pcb, /PCBWay Sponsored Prototype/);
});

test("2. RS-274X Gerbers, Excellon drill file, and OSH Park / PCBWay ZIP archives exist", () => {
  const expectedGerbers = [
    "tinypulse-412-Edge_Cuts.gm1",
    "tinypulse-412-F_Cu.gtl",
    "tinypulse-412-B_Cu.gbl",
    "tinypulse-412-F_Mask.gts",
    "tinypulse-412-B_Mask.gbs",
    "tinypulse-412-F_SilkS.gto",
    "tinypulse-412-B_SilkS.gbo",
    "tinypulse-412-PTH.drl"
  ];

  for (const gf of expectedGerbers) {
    const p = path.join(ROOT, "hardware", "gerbers", gf);
    assert.ok(fs.existsSync(p), `Missing Gerber/Drill file: ${gf}`);
    assert.ok(fs.statSync(p).size > 100, `Gerber file too small: ${gf}`);
  }

  for (const zipName of ["tinypulse-412-oshpark.zip", "tinypulse-412-pcbway.zip"]) {
    const zp = path.join(ROOT, "hardware", zipName);
    assert.ok(fs.existsSync(zp), `Missing fabrication archive: ${zipName}`);
    const buf = fs.readFileSync(zp);
    assert.equal(buf[0], 0x50, "ZIP magic byte P");
    assert.equal(buf[1], 0x4b, "ZIP magic byte K");
  }
});

test("3. DigiKey BOM CSV has required Part Number column and totals $28.95 (< $35.00 grant cap)", () => {
  const bomPath = path.join(ROOT, "hardware", "bom.csv");
  assert.ok(fs.existsSync(bomPath), "Missing hardware/bom.csv");
  const bomText = fs.readFileSync(bomPath, "utf8").trim();
  const lines = bomText.split("\n");
  assert.match(lines[0], /Part Number/, "BOM header must contain 'Part Number'");

  const requiredMpns = [
    "ATTINY412-SSNR",
    "CL21B104KBCNNNC",
    "RC0805FR-074K7L",
    "RC0805FR-07330RL",
    "LTST-C170KRKT",
    "PTS645SM43SMTR92LFS",
    "BS-7",
    "PRPC003SAAN-RC",
    "PRPC004SAAN-RC"
  ];
  for (const mpn of requiredMpns) {
    assert.ok(bomText.includes(mpn), `BOM missing required MPN: ${mpn}`);
  }

  const totalUsd = computeTotalBudgetUsd(BOM_ITEMS);
  assert.equal(totalUsd, 28.95);
  assert.ok(totalUsd < 35.0, "Total hardware cost must be under the $35.00 Hack Club 8-Pin Grant limit");

  // BOM internal consistency: Qty_3_Boards = 3x per-board qty, ext = unit * qty3,
  // and every CSV row agrees with the app.js BOM_ITEMS table it renders.
  const csvRows = lines.slice(1).filter(Boolean).map(l => l.split(","));
  assert.equal(csvRows.length, BOM_ITEMS.length, "CSV row count must match BOM_ITEMS");
  for (const item of BOM_ITEMS) {
    assert.equal(item.qty3, item.qty1 * 3, `${item.ref}: Qty_3_Boards must be 3x the per-board qty`);
    assert.ok(Math.abs(item.ext3 - item.unit * item.qty3) < 0.005, `${item.ref}: ext price != unit * qty3`);
    const row = csvRows.find(r => r[0] === item.ref);
    assert.ok(row, `bom.csv missing row for ${item.ref}`);
    assert.equal(Number(row[1]), item.qty1, `${item.ref}: CSV per-board qty mismatch`);
    assert.equal(Number(row[2]), item.qty3, `${item.ref}: CSV 3-board qty mismatch`);
    assert.equal(Number(row[9]), item.unit, `${item.ref}: CSV unit price mismatch`);
    assert.equal(Number(row[10]), item.ext3, `${item.ref}: CSV ext price mismatch`);
  }

  // Export safety: no BOM field may begin with a spreadsheet formula character.
  for (const row of csvRows) {
    for (const cell of row) {
      assert.ok(!/^[=+\-@]/.test(cell), `CSV formula-injection risk: ${cell}`);
    }
  }
});

test("4. Engineering Journal (JOURNAL.md), Bare-Metal Firmware, and 3D Enclosure CAD exist", () => {
  const journal = fs.readFileSync(path.join(ROOT, "JOURNAL.md"), "utf8");
  assert.match(journal, /9\.5 Hours/);
  assert.match(journal, /Session 6/);

  const fw = fs.readFileSync(path.join(ROOT, "firmware", "main.c"), "utf8");
  assert.match(fw, /TCA0\.SINGLE\.CMP0/);
  assert.match(fw, /scan_multiplexed_buttons/);

  const stl = fs.readFileSync(path.join(ROOT, "cad", "enclosure.stl"), "utf8");
  assert.match(stl, /^solid tinypulse_412_enclosure/);
  assert.match(stl, /endsolid tinypulse_412_enclosure/);
});

test("5. ATtiny412 TCA0 frequency synthesizer math and trace design rules are accurate", () => {
  assert.equal(computeTca0FrequencyHz(354), 440.14);
  assert.equal(computeTca0FrequencyHz(0), 156250);
  assert.equal(computeTca0FrequencyHz(65535), 2.38);
  // CMP0 is a uint16 register: out-of-domain inputs must not yield Inf or negative Hz
  assert.equal(computeTca0FrequencyHz(-1), 0);
  assert.equal(computeTca0FrequencyHz(-5), 0);
  assert.equal(computeTca0FrequencyHz(Infinity), 0);
  assert.equal(computeTca0FrequencyHz(NaN), 0);
  assert.equal(SCALE_NOTES.length, 8);
  // The displayed/played frequency must equal the hardware formula output for every note
  for (const n of SCALE_NOTES) {
    assert.equal(n.freqHz, computeTca0FrequencyHz(n.cmp0),
      `${n.name}: freqHz ${n.freqHz} != actual ${computeTca0FrequencyHz(n.cmp0)}`);
  }
  for (const tr of PCB_TRACES) {
    assert.ok(tr.width >= 0.25, "All PCB traces must be >= 0.25 mm (9.8 mil)");
  }
});

test("6. Firmware registers the 5 MHz clock prescaler, debounces buttons, and addresses the OLED bar", () => {
  const fw = fs.readFileSync(path.join(ROOT, "firmware", "main.c"), "utf8");
  // ATtiny412 boots at 20 MHz; the firmware's math assumes F_CPU = 5 MHz
  assert.match(fw, /_PROTECTED_WRITE\(CLKCTRL\.MCLKCTRLB,\s*CLKCTRL_PDIV_4X_gc\s*\|\s*CLKCTRL_PEN_bm\)/,
    "main() must select the /4 prescaler so F_CPU actually is 5 MHz");
  assert.match(fw, /clock_init\(\);/, "clock_init must be called in main");
  assert.match(fw, /btn_lockout/, "button scan needs a debounce lockout");
  // Status-bar redraws must reset the GDDRAM cursor in horizontal addressing mode
  assert.match(fw, /ssd1306_cmd\(0x21\)/, "status bar must set the column address window");
  assert.match(fw, /ssd1306_cmd\(0x22\)/, "status bar must set the page address window");
});

test("6b. Simulator D1/D2 LEDs and PORTA.OUT mask mirror the firmware beat logic exactly", () => {
  const fw = fs.readFileSync(path.join(ROOT, "firmware", "main.c"), "utf8");
  // Firmware: D1 flashes only the downbeat, D2 gates the off-beats.
  assert.match(fw, /g_led1_on\s*=\s*\(g_beat_sub\s*==\s*0\)/,
    "firmware D1 must flash on g_beat_sub == 0 only");
  assert.match(fw, /g_led2_on\s*=\s*\(g_beat_sub\s*&\s*0x01\)/,
    "firmware D2 must gate odd beats via g_beat_sub & 1");
  // PA6 -> D1 is bit 0x40, PA7 -> D2 is bit 0x80 in PORTA.OUT.
  const expected = [0x40, 0x80, 0x00, 0x80];
  for (let beat = 0; beat < 4; beat++) {
    assert.equal(computePortaOutMask(beat), expected[beat],
      `beat ${beat}: sim OUT mask 0x${computePortaOutMask(beat).toString(16)} != firmware LED state`);
  }
  // Wrap-around and negative steps stay inside the 4-beat domain.
  assert.equal(computePortaOutMask(4), 0x40);
  assert.equal(computePortaOutMask(-1), 0x80);
});

test("7. Shipped Gerbers flash every pad and draw every track in the KiCad PCB", () => {
  const gdir = path.join(ROOT, "hardware", "gerbers");
  const fcu = fs.readFileSync(path.join(gdir, "tinypulse-412-F_Cu.gtl"), "utf8");
  const bcu = fs.readFileSync(path.join(gdir, "tinypulse-412-B_Cu.gbl"), "utf8");

  const fFlash = (fcu.match(/D03\*/g) || []).length;
  const bFlash = (bcu.match(/D03\*/g) || []).length;
  assert.equal(fFlash, 41, "F.Cu must flash all 30 SMD + 11 thru-hole pads");
  assert.equal(bFlash, 11, "B.Cu must flash all 11 thru-hole pads");
  assert.equal((fcu.match(/D01\*/g) || []).length, 13, "F.Cu must draw all 13 front segments");
  assert.equal((bcu.match(/D01\*/g) || []).length, 2, "B.Cu must draw all 2 back segments");

  // Every drilled hole needs an annular ring: a pad flash at the same coords on both layers
  const drl = fs.readFileSync(path.join(gdir, "tinypulse-412-PTH.drl"), "utf8");
  const holes = [...drl.matchAll(/^X(-?[\d.]+)Y(-[\d.]+)$/gm)]
    .map(m => [Math.round(parseFloat(m[1]) * 1e6), Math.round(parseFloat(m[2]) * 1e6)]);
  assert.equal(holes.length, 11, "drill file should have 11 holes");
  for (const [x, y] of holes) {
    const pat = `X${x}Y${y}D03*`;
    assert.ok(fcu.includes(pat), `F.Cu missing annular ring at drill hole ${x},${y}`);
    assert.ok(bcu.includes(pat), `B.Cu missing annular ring at drill hole ${x},${y}`);
  }

  // Mask layers open pads only, never copper tracks
  const fmask = fs.readFileSync(path.join(gdir, "tinypulse-412-F_Mask.gts"), "utf8");
  const bmask = fs.readFileSync(path.join(gdir, "tinypulse-412-B_Mask.gbs"), "utf8");
  assert.equal((fmask.match(/D01\*/g) || []).length, 0, "F.Mask must not contain track draws");
  assert.equal((bmask.match(/D01\*/g) || []).length, 0, "B.Mask must not contain track draws");
});

test("8. Schematic covers every BOM component refdes", () => {
  const sch = fs.readFileSync(path.join(ROOT, "hardware", "tinypulse-412.kicad_sch"), "utf8");
  // MOD1 (module, plugs into J2) and PCB1 (bare board) are legitimately absent
  for (const ref of ["U1","C1","R1","R2","R3","R4","D1","D2","SW1","SW2","BZ1","BT1","J1","J2"]) {
    assert.ok(sch.includes(`"Reference" "${ref}"`), `Schematic missing BOM part ${ref}`);
  }
});

test("9. Web UI obeys the title-only design rule and hygiene scans stay clean", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
  assert.ok(!/class="(chip-badge|subtitle|eyebrow|kicker|tagline)"/.test(html),
    "No eyebrow/kicker above a title or tagline under it");
  assert.ok(!/<\/h[12]>\s*<(p|span|div)[^>]*class="(muted|helper|tagline|subtitle)"/.test(html),
    "No helper line directly under a heading");
  assert.ok(!/&(mdash|ndash);/.test(html), "No dash HTML entities that render as em/en dashes");
  assert.ok(!/scroll-behavior/.test(css), "No scroll-behavior smooth");
});

test("10. Zero em-dashes or en-dashes in project source files", () => {
  const filesToCheck = [
    "index.html",
    "style.css",
    "app.js",
    "attiny-lab.js",
    "test.js",
    "README.md",
    "JOURNAL.md",
    "firmware/main.c",
    "hardware/bom.csv"
  ];
  for (const rel of filesToCheck) {
    const content = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(!content.includes("\u2014"), `Found forbidden em-dash in ${rel}`);
    assert.ok(!content.includes("\u2013"), `Found forbidden en-dash in ${rel}`);
  }
});

/* ==================== attiny-lab.js: SHA-256 ==================== */

const SHA_KATS = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
  ["The quick brown fox jumps over the lazy dog",
    "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"],
  ["The quick brown fox jumps over the lazy dog.",
    "ef537f25c895bfa782526529a9b63d97aa631564d5d789c2b765448c8635fb6c"],
  ["a".repeat(56), "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a"],
  ["a".repeat(64), "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb"],
  ["a".repeat(65), "635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0"]
];

for (const [msg, hex] of SHA_KATS) {
  test(`sha256 KAT (len ${msg.length})`, () => {
    assert.equal(L.sha256Hex(msg), hex);
  });
}

// 0..160 byte boundary sweep against Node crypto over varied deterministic bytes
for (let n = 0; n <= 160; n++) {
  test(`sha256 bytes sweep len=${n}`, () => {
    const bytes = Array.from({ length: n }, (_, i) => (i * 31 + n) & 0xff);
    const expected = crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
    assert.equal(L.sha256BytesHex(bytes), expected);
  });
}

test("sha256 hex of string matches utf8 crypto digest", () => {
  const s = "TinyPulse-412 register proof ~!@#$%^&*()";
  assert.equal(L.sha256Hex(s), crypto.createHash("sha256").update(s, "utf8").digest("hex"));
});

test("utf8Encode matches Buffer.from utf8 bytes", () => {
  const s = "Aé中\u{1f600}z";
  assert.deepEqual(L.utf8Encode(s), Array.from(Buffer.from(s, "utf8")));
});

/* ==================== attiny-lab.js: canonical JSON ==================== */

test("canonicalize is key-order invariant", () => {
  assert.equal(L.canonicalize({ a: 1, b: { c: 2, d: 3 } }), L.canonicalize({ b: { d: 3, c: 2 }, a: 1 }));
});

test("canonicalize produces sorted-key JSON string", () => {
  assert.equal(L.canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test("canonicalize handles arrays with element order preserved", () => {
  assert.equal(L.canonicalize([3, 1, 2]), "[3,1,2]");
});

test("canonicalize escapes strings like JSON.stringify", () => {
  assert.equal(L.canonicalize('a"b\n'), JSON.stringify('a"b\n'));
});

test("canonicalize maps non-finite numbers to null", () => {
  assert.equal(L.canonicalize({ a: NaN, b: Infinity, c: -Infinity }), '{"a":null,"b":null,"c":null}');
});

test("canonicalize drops undefined and functions in objects", () => {
  assert.equal(L.canonicalize({ a: undefined, b: () => 1, c: 3 }), '{"c":3}');
});

test("canonicalize maps array holes/undefined to null", () => {
  assert.equal(L.canonicalize([undefined, () => 1, 2]), "[null,null,2]");
});

test("canonicalize throws on bigint", () => {
  assert.throws(() => L.canonicalize({ a: 1n }), /bigint/);
});

test("canonicalize throws on cyclic structures", () => {
  const o = { a: 1 };
  o.self = o;
  assert.throws(() => L.canonicalize(o), /cyclic/);
});

test("canonicalize throws on shared (diamond) repeated object only when cyclic", () => {
  const shared = { x: 1 };
  assert.equal(L.canonicalize({ a: shared, b: shared }), '{"a":{"x":1},"b":{"x":1}}');
});

test("canonicalize enforces the depth bound", () => {
  let o = {}; let c = o;
  for (let i = 0; i < 100; i++) { c.next = {}; c = c.next; }
  assert.throws(() => L.canonicalize(o), /depth/);
});

test("canonicalize honors a custom depth limit", () => {
  const o = { a: { b: { c: { d: 1 } } } };
  assert.throws(() => L.canonicalize(o, 2), /depth/);
  assert.equal(L.canonicalize(o, 10), '{"a":{"b":{"c":{"d":1}}}}');
});

test("canonicalize of lab payload is deterministic across calls", () => {
  const p = L.reportPayload(L.DEFAULT_STATE);
  assert.equal(L.canonicalize(p), L.canonicalize(L.reportPayload(L.DEFAULT_STATE)));
});

test("canonicalize top-level undefined returns null", () => {
  assert.equal(L.canonicalize(undefined), "null");
});

/* ==================== attiny-lab.js: TCA0 register math vs firmware ==================== */

test("lab F_CPU matches firmware 5 MHz after CLKCTRL_PDIV_4X", () => {
  const fw = fs.readFileSync(path.join(ROOT, "firmware", "main.c"), "utf8");
  assert.match(fw, /CLKCTRL_PDIV_4X_gc/);
  assert.equal(L.F_CPU_HZ, 5000000);
});

test("lab FRQ formula is the firmware formula 156250/(CMP0+1) at DIV16", () => {
  const fw = fs.readFileSync(path.join(ROOT, "firmware", "main.c"), "utf8");
  assert.match(fw, /156,?250\s*\/\s*\(CMP0 \+ 1\)|156250/);
  for (let c = 0; c < 8; c++) {
    assert.equal(L.tca0FreqHz(c, 16), 156250 / (c + 1));
  }
});

test("lab CTRLB constant matches firmware CMP0EN|FRQ = 0x11", () => {
  const fw = fs.readFileSync(path.join(ROOT, "firmware", "main.c"), "utf8");
  assert.match(fw, /TCA_SINGLE_CMP0EN_bm\s*\|\s*TCA_SINGLE_WGMODE_FRQ_gc/);
  assert.equal(L.CTRLB_FRQ, 0x11);
});

test("lab CTRLA byte matches firmware CLKSEL_DIV16|ENABLE = 0x09", () => {
  const fw = fs.readFileSync(path.join(ROOT, "firmware", "main.c"), "utf8");
  assert.match(fw, /TCA_SINGLE_CLKSEL_DIV16_gc\s*\|\s*TCA_SINGLE_ENABLE_bm/);
  assert.match(fw, /#define TCA_SINGLE_CLKSEL_DIV16_gc \(0x04 << 1\)/);
  assert.equal(L.ctrlAByte(16), 0x09);
  assert.equal(L.ctrlAByte(1), 0x01);
  assert.equal(L.ctrlAByte(2), 0x03);
  assert.equal(L.ctrlAByte(4), 0x05);
  assert.equal(L.ctrlAByte(8), 0x07);
  assert.equal(L.ctrlAByte(64), 0x0b);
});

test("lab prescaler set is the silicon DIV1..DIV64 subset", () => {
  assert.deepEqual(L.PRESCALERS, [1, 2, 4, 8, 16, 64]);
  assert.equal(L.DEFAULT_PRESCALER, 16);
});

test("chromatic scale covers C4..E5 with correct ideal equal-tempered Hz", () => {
  assert.equal(L.NOTES.length, 17);
  assert.equal(L.NOTES[0].name, "C4");
  assert.equal(L.NOTES[16].name, "E5");
  for (const n of L.NOTES) {
    assert.ok(Math.abs(n.idealHz - 440 * Math.pow(2, (n.midi - 69) / 12)) < 1e-9);
  }
  assert.ok(Math.abs(L.NOTES[9].idealHz - 440) < 1e-9, "A4 must be 440.00 Hz");
});

// Full note x prescaler register grid: 17 x 6 = 102 exactness checks
for (let ni = 0; ni < L.NOTES.length; ni++) {
  for (let pi = 0; pi < L.PRESCALERS.length; pi++) {
    const n = L.NOTES[ni];
    const p = L.PRESCALERS[pi];
    test(`TCA0 register exactness ${n.name} DIV${p}`, () => {
      const r = L.cmp0For(n.idealHz, p);
      assert.ok(r.ok);
      assert.ok(r.fits, `CMP0 ${r.cmp0} out of 16-bit range`);
      assert.ok(Number.isInteger(r.cmp0));
      assert.ok(r.cmp0 >= 0 && r.cmp0 <= 65535);
      assert.equal(r.quantHz, L.tca0FreqHz(r.cmp0, p));
      assert.equal(r.quantHz, 5000000 / (2 * p * (r.cmp0 + 1)));
      assert.ok(r.absCents <= L.centsBound(n.idealHz, p) + 1e-6,
        `${r.absCents} cents exceeds bound ${L.centsBound(n.idealHz, p)}`);
      assert.ok(Math.abs(r.cmp0 - (5000000 / (2 * p * n.idealHz) - 1)) <= 0.5);
      assert.match(r.hex, /^0x[0-9A-F]{4}$/);
      assert.equal(parseInt(r.hex, 16), r.cmp0);
    });
  }
}

// Shipped firmware SCALE_CMP0 table parity
for (const [name, fwCmp0] of Object.entries(L.FW_CMP0)) {
  test(`firmware SCALE_CMP0 ${name}=0x${fwCmp0.toString(16).toUpperCase()} within 1 LSB of ideal`, () => {
    const idx = L.noteIndexByName(name);
    assert.ok(idx >= 0);
    const r = L.cmp0For(L.NOTES[idx].idealHz, 16);
    assert.ok(Math.abs(r.cmp0 - fwCmp0) <= 1, `ideal ${r.cmp0} vs firmware ${fwCmp0}`);
    assert.ok(Math.abs(L.tca0FreqHz(fwCmp0, 16) - L.FW_FREQ_HZ[name]) <= 0.01);
    assert.ok(Math.abs(L.tca0FreqHz(fwCmp0, 16) - computeTca0FrequencyHz(fwCmp0)) <= 0.01);
  });
}

test("cmp0For rejects non-finite and non-positive targets", () => {
  assert.equal(L.cmp0For(NaN, 16).ok, false);
  assert.equal(L.cmp0For(Infinity, 16).ok, false);
  assert.equal(L.cmp0For(0, 16).ok, false);
  assert.equal(L.cmp0For(-440, 16).ok, false);
});

test("cmp0For rejects unsupported prescalers", () => {
  for (const p of [0, 3, 32, 128, 256, -16, NaN]) {
    assert.equal(L.cmp0For(440, p).ok, false, `presc ${p} should be rejected`);
  }
});

test("cmp0For flags out-of-range 16-bit values", () => {
  const lo = L.cmp0For(0.5, 64);
  assert.equal(lo.ok, true);
  assert.equal(lo.fits, false);
  const hi = L.cmp0For(6000000, 1);
  assert.equal(hi.ok, true);
  assert.equal(hi.fits, false);
});

test("centsBound is strictly decreasing as prescaler decreases for every note", () => {
  for (const n of L.NOTES) {
    for (let i = L.PRESCALERS.length - 1; i > 0; i--) {
      assert.ok(L.centsBound(n.idealHz, L.PRESCALERS[i]) > L.centsBound(n.idealHz, L.PRESCALERS[i - 1]),
        `${n.name}: bound not monotone DIV${L.PRESCALERS[i]} -> DIV${L.PRESCALERS[i - 1]}`);
    }
  }
});

test("buildTable emits exactly 17x6 rows in deterministic order", () => {
  const rows = L.buildTable();
  assert.equal(rows.length, 102);
  assert.equal(rows[0].note, "C4");
  assert.equal(rows[0].presc, 1);
  assert.equal(rows[1].presc, 2);
  assert.equal(rows[6].note, "C#4");
  for (const r of rows) {
    assert.ok(r.fits);
    assert.ok(Number.isFinite(r.quantHz));
  }
});

test("hex16 renders 4-digit uppercase register hex", () => {
  assert.equal(L.hex16(354), "0x0162");
  assert.equal(L.hex16(0), "0x0000");
  assert.equal(L.hex16(65535), "0xFFFF");
});

/* ==================== attiny-lab.js: CR2032 power model ==================== */

test("LED current follows Ohm law through 330R at 3.0V", () => {
  assert.ok(Math.abs(L.ledMa() - (3.0 - 1.9) / 330 * 1000) < 1e-9);
  assert.ok(L.ledMa() > 3 && L.ledMa() < 4);
});

test("internal pull-up current matches 3.0V/35k", () => {
  assert.ok(Math.abs(L.pullupMa() - 3.0 / 35000 * 1000) < 1e-9);
});

test("TDM window duty at 1 kHz is under 1 percent", () => {
  assert.ok(Math.abs(L.tdmDuty(1000) - 0.008) < 1e-12);
  assert.equal(L.tdmDuty(0), 0);
  assert.equal(L.tdmDuty(1000000), 1);
});

test("OLED current is zero when off and scales with brightness", () => {
  assert.equal(L.oledMa(0), 0);
  assert.ok(L.oledMa(50) < L.oledMa(100));
  assert.ok(L.oledMa(100) <= 20);
  assert.equal(L.oledMa(150), L.oledMa(100));
});

test("LED effective duty is reduced by the TDM scan window", () => {
  assert.ok(L.ledEffMa(100, 1000) < L.ledMa());
  assert.ok(L.ledEffMa(100, 1000) > L.ledMa() * 0.98);
  assert.equal(L.ledEffMa(0, 1000), 0);
});

test("metronome click duty scales linearly with BPM", () => {
  assert.ok(Math.abs(L.clickDuty(120) - 0.06) < 1e-12);
  assert.ok(Math.abs(L.clickDuty(240) - 0.12) < 1e-12);
  assert.equal(L.clickDuty(0), 0);
});

test("mode currents: sleep < metronome < synth <= synthmax", () => {
  const s = L.clampState();
  assert.ok(L.modeCurrentMa(0, s) < L.modeCurrentMa(1, s));
  assert.ok(L.modeCurrentMa(1, s) < L.modeCurrentMa(2, s));
  assert.ok(L.modeCurrentMa(2, s) <= L.modeCurrentMa(3, s));
});

test("sleep mode draws only the power-down floor", () => {
  assert.equal(L.modeCurrentMa(0, L.clampState()), L.POWER.mcuSleepMa);
});

test("metronome current rises with BPM", () => {
  const s = L.clampState();
  assert.ok(L.modeCurrentMa(1, { ...s, bpm: 240 }) > L.modeCurrentMa(1, { ...s, bpm: 60 }));
});

test("synth current rises with OLED brightness and LED duty", () => {
  const s = L.clampState();
  assert.ok(L.modeCurrentMa(2, { ...s, oled: 100 }) > L.modeCurrentMa(2, { ...s, oled: 0 }));
  assert.ok(L.modeCurrentMa(2, { ...s, led: 100 }) > L.modeCurrentMa(2, { ...s, led: 0 }));
});

test("holding TDM buttons adds pull-up current", () => {
  const s = L.clampState();
  const d = L.modeCurrentMa(1, { ...s, held: 2 }) - L.modeCurrentMa(1, { ...s, held: 0 });
  assert.ok(Math.abs(d - 2 * L.pullupMa()) < 1e-9);
});

test("CR2032 runtime is inversely proportional to load", () => {
  assert.equal(L.runtimeHours(1), L.CR2032_CAPACITY_MAH);
  assert.equal(L.runtimeHours(L.CR2032_CAPACITY_MAH), 1);
  assert.ok(L.runtimeHours(0.5) > L.runtimeHours(1));
  assert.equal(L.runtimeHours(0), Infinity);
});

test("powerSweep returns 6 deterministic operating points", () => {
  const s = L.clampState();
  const sw = L.powerSweep(s);
  assert.equal(sw.length, 6);
  assert.deepEqual(sw.map(e => e.id), ["sleep", "met60", "metcur", "met240", "synth", "synthmax"]);
  for (const e of sw) {
    assert.ok(e.ma > 0);
    assert.equal(e.hours, L.CR2032_CAPACITY_MAH / e.ma);
  }
  assert.ok(sw[0].ma < sw[4].ma);
  assert.ok(sw[3].ma > sw[1].ma, "240 BPM metronome draws more than 60 BPM");
});

test("CR2032 capacity constant is 225 mAh", () => {
  assert.equal(L.CR2032_CAPACITY_MAH, 225);
  assert.equal(L.POWER.capacityMah, 225);
});

/* ==================== attiny-lab.js: 8-pin map ==================== */

test("pin map allocates all 8 SOIC pins exactly once", () => {
  const r = L.checkPinMap();
  assert.equal(r.ok, true);
  assert.equal(r.gpio, 6);
  const pins = L.PIN_MAP.map(p => p.pin).sort();
  assert.deepEqual(pins, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("pin map matches firmware header: PA6/PA7 TDM, PA1/PA2 TWI, PA3 TCA0, PA0 UPDI", () => {
  const fw = fs.readFileSync(path.join(ROOT, "firmware", "main.c"), "utf8");
  const byPort = {};
  for (const p of L.PIN_MAP) byPort[p.port] = p;
  assert.match(byPort.PA6.func, /SW1|D1|TDM/i);
  assert.match(byPort.PA7.func, /SW2|D2|TDM/i);
  assert.match(byPort.PA1.func, /SDA/i);
  assert.match(byPort.PA2.func, /SCL/i);
  assert.match(byPort.PA3.func, /TCA0|PWM|WO0/i);
  assert.match(byPort.PA0.func, /UPDI/i);
  assert.match(fw, /PA6 -> Time-Multiplexed SW1/);
  assert.match(fw, /PA7 -> Time-Multiplexed SW2/);
});

test("pin map port names are unique", () => {
  const ports = L.PIN_MAP.map(p => p.port);
  assert.equal(new Set(ports).size, ports.length);
});

test("pin map net names are unique", () => {
  const nets = L.PIN_MAP.map(p => p.net);
  assert.equal(new Set(nets).size, nets.length);
});

/* ==================== attiny-lab.js: digest + exporters ==================== */

test("digest is cached: identical state returns the identical record", () => {
  const a = L.digestForState(L.DEFAULT_STATE);
  const b = L.digestForState({ ...L.DEFAULT_STATE });
  assert.equal(a.sha256, b.sha256);
  assert.equal(a, b, "cached record should be reused");
});

test("digest parity across page/JSON/CSV/MD surfaces", () => {
  const s = { ...L.DEFAULT_STATE, note: 7, presc: 4, bpm: 168 };
  const d = L.digestForState(s).sha256;
  assert.match(d, /^[0-9a-f]{64}$/);
  assert.ok(L.toJsonExport(s).includes(d));
  assert.ok(L.toCsvExport(s).includes(d));
  assert.ok(L.toMarkdownBrief(s).includes(d));
});

test("verifyDigest recomputes and matches", () => {
  for (const s of [L.DEFAULT_STATE, { ...L.DEFAULT_STATE, bpm: 200 }, { ...L.DEFAULT_STATE, mode: 2 }]) {
    const v = L.verifyDigest(s);
    assert.equal(v.ok, true);
    assert.equal(v.expected, v.actual);
  }
});

test("tamper demo flips one unit and changes the digest", () => {
  const t = L.tamperDemo({ ...L.DEFAULT_STATE, bpm: 120 });
  assert.equal(t.differs, true);
  assert.notEqual(t.original, t.tampered);
});

test("distinct states produce distinct digests", () => {
  const a = L.digestForState({ ...L.DEFAULT_STATE, note: 4 });
  const b = L.digestForState({ ...L.DEFAULT_STATE, note: 5 });
  assert.notEqual(a.sha256, b.sha256);
});

test("reportPayload carries firmware-verifiable fields", () => {
  const p = L.reportPayload({ ...L.DEFAULT_STATE, note: L.noteIndexByName("A4"), presc: 16 });
  assert.equal(p.mcu, "ATtiny412-SSNR");
  assert.equal(p.fCpuHz, 5000000);
  assert.equal(p.cmp0, 354);
  assert.equal(p.cmp0Hex, "0x0162");
  assert.equal(p.ctrlA, "0x09");
  assert.equal(p.ctrlB, "0x11");
  assert.equal(p.mode, "metronome");
  assert.ok(Math.abs(p.quantHz - 440.1408) < 0.01);
  assert.equal(p.capacityMah, 225);
});

test("JSON export parses and stamps the same digest", () => {
  const s = L.clampState();
  const j = JSON.parse(L.toJsonExport(s));
  assert.equal(j.sha256, L.digestForState(s).sha256);
  assert.equal(j.report.midi, L.NOTES[s.note].midi);
});

test("CSV export stamps digest row and escapes every cell", () => {
  const s = L.clampState();
  const csv = L.toCsvExport(s);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 2 + L.NOTES.length);
  assert.ok(lines[0].startsWith("sha256,"));
  assert.ok(lines[0].includes(L.digestForState(s).sha256));
  assert.equal(lines[1], "note,prescaler,target_hz,cmp0_dec,cmp0_hex,quant_hz,abs_cents,fits_16bit,fw_cmp0");
  for (const line of lines.slice(2)) {
    assert.equal(line.split(",").length, 9);
    assert.ok(!/(^|,)(=[^']|\+[^']|@)/.test(line), `formula risk in ${line}`);
  }
});

test("CSV formula-injection escaping covers = + - @ tab CR", () => {
  assert.equal(L.csvEscape("=1+1"), "'=1+1");
  assert.equal(L.csvEscape("+5"), "'+5");
  assert.equal(L.csvEscape("-7"), "'-7");
  assert.equal(L.csvEscape("@sum"), "'@sum");
  assert.equal(L.csvEscape("\thit"), "'\thit");
  assert.equal(L.csvEscape("\rhit"), "\"'\rhit\"");
  assert.equal(L.csvEscape("safe"), "safe");
  assert.equal(L.csvEscape(42), "42");
  assert.equal(L.csvEscape('has"q'), '"has""q"');
  assert.equal(L.csvEscape("a,b"), '"a,b"');
});

test("Markdown brief stamps digest, backticks dollars, and is dash-clean", () => {
  const s = L.clampState();
  const md = L.toMarkdownBrief(s);
  assert.ok(md.includes(L.digestForState(s).sha256));
  assert.ok(md.includes("`$28.95`"));
  assert.ok(md.includes("`$35.00`"));
  assert.ok(!md.includes("\u2014") && !md.includes("\u2013"));
});

test("canonical JSON of payload is what sha256 hashes", () => {
  const rec = L.digestForState(L.clampState());
  assert.equal(rec.sha256, L.sha256Hex(rec.canonical));
});

/* ==================== attiny-lab.js: fail-closed #tplab= codec ==================== */

test("encodeHash emits canonical tplab token order", () => {
  const s = { note: 9, presc: 8, bpm: 168, oled: 70, led: 40, mode: 2, tdm: 500, held: 1 };
  assert.equal(L.encodeHash(s), "tplab=v1;n9;p8;b168;o70;d40;m2;t500;h1");
});

test("codec round-trips default state", () => {
  const d = L.decodeHash("#" + L.encodeHash(L.DEFAULT_STATE));
  assert.equal(d.ok, true);
  assert.deepEqual(d.state, L.clampState());
});

const CODEC_STATES = [
  { note: 0, presc: 1, bpm: 60, oled: 0, led: 0, mode: 0, tdm: 100, held: 0 },
  { note: 16, presc: 64, bpm: 240, oled: 100, led: 100, mode: 3, tdm: 10000, held: 2 },
  { note: 7, presc: 2, bpm: 133, oled: 33, led: 66, mode: 1, tdm: 500, held: 1 }
];

for (const s of CODEC_STATES) {
  test(`codec round-trip state ${JSON.stringify(s)}`, () => {
    const d = L.decodeHash("#" + L.encodeHash(s));
    assert.equal(d.ok, true);
    assert.deepEqual(d.state, L.clampState(s));
  });
}

const CODEC_HOSTILE = [
  "", "#", "tplab=", "no-marker", "#tplab=", "tplab=;", "tplab=n", "tplab=nn",
  "tplab=1n", "tplab=q1", "tplab=v0;n1", "tplab=v2;n1", "tplab=n1;n2",
  "tplab=n 1", "tplab=n1%3B", "tplab=__proto__", "tplab=n1;__proto__",
  "tplab=constructor1", "tplab=n9999999999", "tplab=n1&", "tplab=v1;n1;x9",
  "tplab==1", "tplab=v-1", "tplab=v1;n1#junk"
];

for (const h of CODEC_HOSTILE) {
  test(`codec rejects hostile input ${JSON.stringify(h)}`, () => {
    const d = L.decodeHash(h);
    assert.equal(d.ok, false, `expected rejection of ${h}`);
    assert.ok(d.error);
    assert.deepEqual(d.state, L.clampState());
  });
}

test("codec clamps out-of-range numeric values into bounds", () => {
  const d = L.decodeHash("tplab=v1;n99;p7;b999;o120;d300;m9;t999999;h5");
  assert.equal(d.ok, true);
  assert.equal(d.state.note, 16);
  assert.equal(d.state.presc, 8);
  assert.equal(d.state.bpm, 240);
  assert.equal(d.state.oled, 100);
  assert.equal(d.state.led, 100);
  assert.equal(d.state.mode, 3);
  assert.equal(d.state.tdm, 10000);
  assert.equal(d.state.held, 2);
});

test("codec clamps negative values to lower bounds", () => {
  const d = L.decodeHash("tplab=v1;n-4;b-60;o-1;d-2;m-1;t-5;h-1");
  assert.equal(d.ok, true);
  assert.equal(d.state.note, 0);
  assert.equal(d.state.bpm, 60);
  assert.equal(d.state.oled, 0);
  assert.equal(d.state.led, 0);
  assert.equal(d.state.mode, 0);
  assert.equal(d.state.tdm, 100);
  assert.equal(d.state.held, 0);
});

test("codec does not pollute Object.prototype", () => {
  L.decodeHash("tplab=v1;n3;p4");
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.note, undefined);
});

test("codec accepts bare payload and #hash forms", () => {
  const a = L.decodeHash("tplab=v1;n5");
  const b = L.decodeHash("#tplab=v1;n5");
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.state, b.state);
});

test("codec unknown prescaler clamps to nearest silicon divider", () => {
  const d = L.decodeHash("tplab=v1;p20");
  assert.equal(d.ok, true);
  assert.equal(d.state.presc, 16);
  const d2 = L.decodeHash("tplab=v1;p100");
  assert.equal(d2.state.presc, 64);
});

/* ==================== attiny-lab.js: in-page self-tests ==================== */

test("selfTests returns at least 18 checks", () => {
  assert.ok(L.selfTests().length >= 18);
});

test("selfTests ids are unique", () => {
  const ids = L.selfTests().map(t => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every in-page self-test passes in Node", () => {
  const results = L.selfTests();
  const failed = results.filter(r => !r.pass);
  assert.equal(failed.length, 0, `failing: ${failed.map(f => f.id + ":" + f.detail).join(", ")}`);
});

/* ==================== DOM wiring + static hygiene ==================== */

test("index.html loads attiny-lab.js before app.js and mounts #labRoot", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const iLab = html.indexOf('src="attiny-lab.js"');
  const iApp = html.indexOf('src="app.js"');
  assert.ok(iLab !== -1 && iApp !== -1);
  assert.ok(iLab < iApp, "attiny-lab.js must load before app.js");
  assert.match(html, /id="labRoot"/);
  assert.match(html, /id="labCard"/);
});

test("index.html has a graceful-degradation fallback inside #labRoot", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/id="labRoot"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(m && /did not load|requires|attiny-lab\.js/i.test(m[1]));
});

test("app.js mounts the lab with a graceful-absence guard", () => {
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  assert.match(app, /typeof ATTINY_LAB !== "undefined"/);
  assert.match(app, /ATTINY_LAB\.mount/);
  assert.match(app, /onNoteLoad/);
});

test("app.js keeps AudioContext strictly behind the user-gesture click", () => {
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const hits = [...app.matchAll(/new AudioCtx|new AudioContext|createOscillator/g)];
  assert.ok(hits.length >= 1);
  const clickIdx = app.indexOf('addEventListener("click"');
  const audioIdx = app.indexOf("new AudioCtx()");
  assert.ok(clickIdx !== -1 && audioIdx !== -1 && audioIdx > clickIdx,
    "AudioContext must be created inside the click handler, not at load");
});

test("attiny-lab.js never touches AudioContext, network, or timers at module level", () => {
  const lab = fs.readFileSync(path.join(ROOT, "attiny-lab.js"), "utf8");
  assert.ok(!/new\s+(AudioContext|webkitAudioContext)|\.createOscillator\s*\(|\.decodeAudioData/.test(lab),
    "attiny-lab.js must never construct an AudioContext");
  assert.ok(!/fetch\s*\(|XMLHttpRequest|WebSocket|import\s*\(|require\s*\(/.test(lab));
  assert.ok(!/setInterval|setTimeout\s*\([^)]*load/i.test(lab));
});

test("index.html references no external resources", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(!/src="https?:/.test(html), "no remote scripts/media");
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  for (const h of hrefs) {
    assert.ok(!/^https?:/.test(h) || /github\.com/.test(h), `external href ${h}`);
  }
});

test("lab UI exposes keyboard-focusable hit targets and ARIA labels", () => {
  const lab = fs.readFileSync(path.join(ROOT, "attiny-lab.js"), "utf8");
  assert.match(lab, /tabindex="0"/);
  assert.match(lab, /role="button"/);
  assert.match(lab, /aria-label=/);
  assert.match(lab, /keydown/);
});

test("mobile layout guard: minmax(0,1fr), min-width:0, overflow-x:auto wrappers", () => {
  const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
  assert.match(css, /minmax\(0,\s*1fr\)/);
  assert.match(css, /min-width:\s*0/);
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /table-responsive/);
  assert.match(css, /\.lab-table-scroll[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /\.lab-chart-wrap[\s\S]*?overflow-x:\s*auto/);
});

test("viewport meta is present for mobile audits", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /<meta name="viewport"/);
});
