const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SCALE_NOTES,
  BOM_ITEMS,
  PCB_TRACES,
  computeTca0FrequencyHz,
  computeTotalBudgetUsd
} = require("./app.js");

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
