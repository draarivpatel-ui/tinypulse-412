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

test("3. DigiKey BOM CSV has required Part Number column and totals $24.15 (< $35.00 grant cap)", () => {
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
  assert.equal(totalUsd, 24.15);
  assert.ok(totalUsd < 35.0, "Total hardware cost must be under the $35.00 Hack Club 8-Pin Grant limit");
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
  assert.equal(SCALE_NOTES.length, 8);
  for (const tr of PCB_TRACES) {
    assert.ok(tr.width >= 0.25, "All PCB traces must be >= 0.25 mm (9.8 mil)");
  }
});

test("6. Zero em-dashes or en-dashes in project source files", () => {
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
