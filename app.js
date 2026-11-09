/**
 * TinyPulse-412 Interactive KiCad 8 PCB Layer Viewer, BOM Cost Calculator,
 * and Cycle-Accurate ATtiny412 Register / TCA0 Audio Simulator.
 */

const SCALE_NOTES = [
  { name: "C4", cmp0: 595, freqHz: 261.6 },
  { name: "D4", cmp0: 530, freqHz: 293.7 },
  { name: "E4", cmp0: 472, freqHz: 329.6 },
  { name: "G4", cmp0: 397, freqHz: 392.0 },
  { name: "A4", cmp0: 354, freqHz: 440.1 },
  { name: "C5", cmp0: 297, freqHz: 524.3 },
  { name: "D5", cmp0: 265, freqHz: 587.4 },
  { name: "E5", cmp0: 236, freqHz: 659.3 }
];

const BPM_PRESETS = [90, 120, 140, 168];

const BOM_ITEMS = [
  { ref: "U1", qty1: 1, qty3: 3, desc: "8-Bit AVR tinyAVR-1 MCU 20MHz 4KB Flash 256B SRAM UPDI", mpn: "ATTINY412-SSNR", supplier: "DigiKey", pkg: "SOIC-8", unit: 0.68, ext3: 2.04 },
  { ref: "C1", qty1: 1, qty3: 3, desc: "100nF 50V X7R Ceramic Decoupling Capacitor", mpn: "CL21B104KBCNNNC", supplier: "DigiKey", pkg: "0805", unit: 0.10, ext3: 0.30 },
  { ref: "R1;R2", qty1: 2, qty3: 6, desc: "4.7k Ohm 1% 1/8W Thick Film I2C Pull-Up Resistor", mpn: "RC0805FR-074K7L", supplier: "DigiKey", pkg: "0805", unit: 0.10, ext3: 0.60 },
  { ref: "R3;R4", qty1: 2, qty3: 6, desc: "330 Ohm 1% 1/8W Thick Film LED Current-Limiting Resistor", mpn: "RC0805FR-07330RL", supplier: "DigiKey", pkg: "0805", unit: 0.10, ext3: 0.60 },
  { ref: "D1;D2", qty1: 2, qty3: 6, desc: "Super Red 631nm Indicator LED 20mA", mpn: "LTST-C170KRKT", supplier: "DigiKey", pkg: "0805", unit: 0.18, ext3: 1.08 },
  { ref: "SW1;SW2", qty1: 2, qty3: 6, desc: "6.0mm x 6.0mm SMD Tactile Pushbutton Switch 160gf", mpn: "PTS645SM43SMTR92LFS", supplier: "DigiKey", pkg: "SMD-4", unit: 0.28, ext3: 1.68 },
  { ref: "BZ1", qty1: 1, qty3: 3, desc: "9.0mm Magnetic Piezo Audio Transducer 4kHz PWM", mpn: "ABI-009-RC", supplier: "DigiKey", pkg: "TH-9mm", unit: 1.35, ext3: 4.05 },
  { ref: "BT1", qty1: 1, qty3: 3, desc: "CR2032 20mm Coin Cell Battery Retainer Holder", mpn: "BS-7", supplier: "DigiKey", pkg: "TH-CR2032", unit: 0.75, ext3: 2.25 },
  { ref: "J1", qty1: 1, qty3: 3, desc: "3-Pin 2.54mm Pitch Vertical UPDI Programming Header", mpn: "PRPC003SAAN-RC", supplier: "DigiKey", pkg: "1x03-2.54mm", unit: 0.25, ext3: 0.75 },
  { ref: "J2", qty1: 1, qty3: 3, desc: "4-Pin 2.54mm Pitch I2C OLED Socket Header", mpn: "PRPC004SAAN-RC", supplier: "DigiKey", pkg: "1x04-2.54mm", unit: 0.35, ext3: 1.05 },
  { ref: "MOD1", qty1: 1, qty3: 1, desc: "0.96 inch 128x64 SSD1306 I2C OLED Display Module", mpn: "SSD1306-128X64-I2C", supplier: "DigiKey", pkg: "Module-4Pin", unit: 2.40, ext3: 2.40 },
  { ref: "PCB1", qty1: 1, qty3: 3, desc: "OSH Park 2-Layer Purple / After Dark PCB (38.0x25.0mm = 1.47 sq in)", mpn: "TINYPULSE-412-PCB", supplier: "OSH Park", pkg: "38x25mm", unit: 2.45, ext3: 7.35 }
];

/* Exact KiCad PCB Geometry in millimeters (Origin 100.0, 100.0 to 138.0, 125.0) */
const PCB_TRACES = [
  { x1: 116.3, y1: 110.595, x2: 118.05, y2: 106.5, width: 0.35, layer: "F.Cu", net: "VDD" },
  { x1: 118.05, y1: 106.5, x2: 117.73, y2: 103.5, width: 0.35, layer: "F.Cu", net: "VDD" },
  { x1: 121.7, y1: 110.595, x2: 119.95, y2: 106.5, width: 0.35, layer: "F.Cu", net: "GND" },
  { x1: 121.7, y1: 113.135, x2: 134.5, y2: 110.0, width: 0.25, layer: "F.Cu", net: "PA0_UPDI" },
  { x1: 116.3, y1: 114.405, x2: 115.45, y2: 117.8, width: 0.25, layer: "F.Cu", net: "PA1_SDA" },
  { x1: 115.45, y1: 117.8, x2: 122.81, y2: 103.5, width: 0.25, layer: "B.Cu", net: "PA1_SDA" },
  { x1: 121.7, y1: 114.405, x2: 122.55, y2: 117.8, width: 0.25, layer: "F.Cu", net: "PA2_SCL" },
  { x1: 122.55, y1: 117.8, x2: 120.27, y2: 103.5, width: 0.25, layer: "F.Cu", net: "PA2_SCL" },
  { x1: 121.7, y1: 111.865, x2: 126.0, y2: 107.0, width: 0.25, layer: "F.Cu", net: "PA3_BUZZER" },
  { x1: 116.3, y1: 111.865, x2: 107.55, y2: 107.0, width: 0.25, layer: "F.Cu", net: "PA6_BTN1" },
  { x1: 107.55, y1: 107.0, x2: 109.25, y2: 117.25, width: 0.25, layer: "F.Cu", net: "PA6_BTN1" },
  { x1: 116.3, y1: 113.135, x2: 107.55, y2: 111.0, width: 0.25, layer: "F.Cu", net: "PA7_BTN2" },
  { x1: 107.55, y1: 111.0, x2: 128.75, y2: 117.25, width: 0.25, layer: "B.Cu", net: "PA7_BTN2" },
  { x1: 109.45, y1: 107.0, x2: 104.45, y2: 107.0, width: 0.25, layer: "F.Cu", net: "PA6_BTN1" },
  { x1: 109.45, y1: 111.0, x2: 104.45, y2: 111.0, width: 0.25, layer: "F.Cu", net: "PA7_BTN2" }
];

const PCB_PADS = [
  /* U1 ATtiny412-SSNR SOIC-8 */
  { x: 116.3, y: 110.595, w: 1.55, h: 0.6, layer: "F.Cu", net: "VDD", label: "1" },
  { x: 116.3, y: 111.865, w: 1.55, h: 0.6, layer: "F.Cu", net: "PA6_BTN1", label: "2" },
  { x: 116.3, y: 113.135, w: 1.55, h: 0.6, layer: "F.Cu", net: "PA7_BTN2", label: "3" },
  { x: 116.3, y: 114.405, w: 1.55, h: 0.6, layer: "F.Cu", net: "PA1_SDA", label: "4" },
  { x: 121.7, y: 114.405, w: 1.55, h: 0.6, layer: "F.Cu", net: "PA2_SCL", label: "5" },
  { x: 121.7, y: 113.135, w: 1.55, h: 0.6, layer: "F.Cu", net: "PA0_UPDI", label: "6" },
  { x: 121.7, y: 111.865, w: 1.55, h: 0.6, layer: "F.Cu", net: "PA3_BUZZER", label: "7" },
  { x: 121.7, y: 110.595, w: 1.55, h: 0.6, layer: "F.Cu", net: "GND", label: "8" },
  /* C1 Decoupling Cap */
  { x: 118.05, y: 106.5, w: 1.0, h: 1.3, layer: "F.Cu", net: "VDD" },
  { x: 119.95, y: 106.5, w: 1.0, h: 1.3, layer: "F.Cu", net: "GND" },
  /* J1 3-Pin UPDI Header */
  { x: 134.5, y: 110.0, w: 1.7, h: 1.7, layer: "TH", net: "PA0_UPDI" },
  { x: 134.5, y: 112.54, w: 1.7, h: 1.7, layer: "TH", net: "VDD" },
  { x: 134.5, y: 115.08, w: 1.7, h: 1.7, layer: "TH", net: "GND" },
  /* J2 4-Pin OLED Header */
  { x: 115.19, y: 103.5, w: 1.7, h: 1.7, layer: "TH", net: "GND" },
  { x: 117.73, y: 103.5, w: 1.7, h: 1.7, layer: "TH", net: "VDD" },
  { x: 120.27, y: 103.5, w: 1.7, h: 1.7, layer: "TH", net: "PA2_SCL" },
  { x: 122.81, y: 103.5, w: 1.7, h: 1.7, layer: "TH", net: "PA1_SDA" },
  /* R1 & R2 I2C Pull-Ups */
  { x: 113.55, y: 117.8, w: 1.0, h: 1.3, layer: "F.Cu", net: "VDD" },
  { x: 115.45, y: 117.8, w: 1.0, h: 1.3, layer: "F.Cu", net: "PA1_SDA" },
  { x: 122.55, y: 117.8, w: 1.0, h: 1.3, layer: "F.Cu", net: "PA2_SCL" },
  { x: 124.45, y: 117.8, w: 1.0, h: 1.3, layer: "F.Cu", net: "VDD" },
  /* R3, R4, D1, D2 */
  { x: 107.55, y: 107.0, w: 1.0, h: 1.3, layer: "F.Cu", net: "PA6_BTN1" },
  { x: 109.45, y: 107.0, w: 1.0, h: 1.3, layer: "F.Cu", net: "PA6_BTN1" },
  { x: 107.55, y: 111.0, w: 1.0, h: 1.3, layer: "F.Cu", net: "PA7_BTN2" },
  { x: 109.45, y: 111.0, w: 1.0, h: 1.3, layer: "F.Cu", net: "PA7_BTN2" },
  { x: 102.55, y: 107.0, w: 1.0, h: 1.3, layer: "F.Cu", net: "GND" },
  { x: 104.45, y: 107.0, w: 1.0, h: 1.3, layer: "F.Cu", net: "PA6_BTN1" },
  { x: 102.55, y: 111.0, w: 1.0, h: 1.3, layer: "F.Cu", net: "GND" },
  { x: 104.45, y: 111.0, w: 1.0, h: 1.3, layer: "F.Cu", net: "PA7_BTN2" },
  /* SW1 & SW2 Tactile Switches */
  { x: 102.75, y: 117.25, w: 1.5, h: 1.3, layer: "F.Cu", net: "PA6_BTN1" },
  { x: 109.25, y: 117.25, w: 1.5, h: 1.3, layer: "F.Cu", net: "PA6_BTN1" },
  { x: 102.75, y: 121.75, w: 1.5, h: 1.3, layer: "F.Cu", net: "GND" },
  { x: 109.25, y: 121.75, w: 1.5, h: 1.3, layer: "F.Cu", net: "GND" },
  { x: 128.75, y: 117.25, w: 1.5, h: 1.3, layer: "F.Cu", net: "PA7_BTN2" },
  { x: 135.25, y: 117.25, w: 1.5, h: 1.3, layer: "F.Cu", net: "PA7_BTN2" },
  { x: 128.75, y: 121.75, w: 1.5, h: 1.3, layer: "F.Cu", net: "GND" },
  { x: 135.25, y: 121.75, w: 1.5, h: 1.3, layer: "F.Cu", net: "GND" },
  /* BZ1 Piezo Buzzer & BT1 CR2032 Holder */
  { x: 126.0, y: 107.0, w: 1.6, h: 1.6, layer: "TH", net: "PA3_BUZZER" },
  { x: 131.0, y: 107.0, w: 1.6, h: 1.6, layer: "TH", net: "GND" },
  { x: 108.8, y: 113.0, w: 2.2, h: 2.2, layer: "TH", net: "VDD" },
  { x: 129.2, y: 113.0, w: 2.2, h: 2.2, layer: "TH", net: "GND" }
];

function computeTca0FrequencyHz(cmp0) {
  return Number((156250 / (cmp0 + 1)).toFixed(2));
}

function computeTotalBudgetUsd(bomList = BOM_ITEMS) {
  return Number(bomList.reduce((acc, item) => acc + item.ext3, 0).toFixed(2));
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const state = {
    theme: "afterdark",
    layers: { "F.Cu": true, "B.Cu": true, "F.SilkS": true, "B.SilkS": true, "Edge.Cuts": true },
    activeNet: "ALL",
    noteIdx: 4,
    bpmIdx: 1,
    beatStep: 0,
    audioEnabled: false,
    audioCtx: null,
    osc: null,
    gain: null
  };

  const pcbCanvas = document.getElementById("pcbCanvas");
  const pcbCtx = pcbCanvas.getContext("2d");
  const oledCanvas = document.getElementById("oledCanvas");
  const oledCtx = oledCanvas.getContext("2d");

  function mmToPxX(mm) {
    return 40 + (mm - 100.0) * 18.0;
  }
  function mmToPxY(mm) {
    return 25 + (mm - 100.0) * 18.0;
  }

  function renderPcb() {
    pcbCtx.clearRect(0, 0, pcbCanvas.width, pcbCanvas.height);

    const palettes = {
      afterdark: { bg: "#090b10", board: "#101218", fcu: "#d97706", bcu: "#2563eb", silk: "#f8fafc" },
      purple:    { bg: "#090b10", board: "#2e1065", fcu: "#e11d48", bcu: "#38bdf8", silk: "#f8fafc" },
      pcbway:    { bg: "#090b10", board: "#14171f", fcu: "#ef4444", bcu: "#3b82f6", silk: "#ffffff" }
    };
    const pal = palettes[state.theme] || palettes.afterdark;

    pcbCtx.fillStyle = pal.bg;
    pcbCtx.fillRect(0, 0, pcbCanvas.width, pcbCanvas.height);

    /* Board substrate fill */
    const bx = mmToPxX(100.0), by = mmToPxY(100.0);
    const bw = 38.0 * 18.0, bh = 25.0 * 18.0;
    pcbCtx.fillStyle = pal.board;
    pcbCtx.fillRect(bx, by, bw, bh);

    /* Back SilkS (CR2032 outline + PCBWay Sponsorship mark) */
    if (state.layers["B.SilkS"]) {
      pcbCtx.save();
      pcbCtx.strokeStyle = "rgba(168, 85, 247, 0.55)";
      pcbCtx.lineWidth = 1.5;
      pcbCtx.beginPath();
      pcbCtx.arc(mmToPxX(119.0), mmToPxY(113.0), 10.0 * 18.0, 0, Math.PI * 2);
      pcbCtx.stroke();

      pcbCtx.fillStyle = "rgba(168, 85, 247, 0.75)";
      pcbCtx.font = "bold 12px ui-monospace, monospace";
      pcbCtx.textAlign = "center";
      pcbCtx.fillText("B.SilkS: HACK CLUB 8-PIN GRANT | PCBWay Sponsored Prototype", mmToPxX(119.0), mmToPxY(122.4));
      pcbCtx.restore();
    }

    /* Back Copper Traces */
    if (state.layers["B.Cu"]) {
      for (const tr of PCB_TRACES.filter(t => t.layer === "B.Cu")) {
        const isHi = state.activeNet === "ALL" || state.activeNet === tr.net;
        pcbCtx.strokeStyle = isHi ? pal.bcu : "rgba(59, 130, 246, 0.18)";
        pcbCtx.lineWidth = tr.width * 18.0 * (isHi && state.activeNet !== "ALL" ? 1.5 : 1.0);
        pcbCtx.lineCap = "round";
        pcbCtx.beginPath();
        pcbCtx.moveTo(mmToPxX(tr.x1), mmToPxY(tr.y1));
        pcbCtx.lineTo(mmToPxX(tr.x2), mmToPxY(tr.y2));
        pcbCtx.stroke();
      }
    }

    /* Top Copper Traces */
    if (state.layers["F.Cu"]) {
      for (const tr of PCB_TRACES.filter(t => t.layer === "F.Cu")) {
        const isHi = state.activeNet === "ALL" || state.activeNet === tr.net;
        pcbCtx.strokeStyle = isHi ? pal.fcu : "rgba(224, 82, 82, 0.18)";
        pcbCtx.lineWidth = tr.width * 18.0 * (isHi && state.activeNet !== "ALL" ? 1.5 : 1.0);
        pcbCtx.lineCap = "round";
        pcbCtx.beginPath();
        pcbCtx.moveTo(mmToPxX(tr.x1), mmToPxY(tr.y1));
        pcbCtx.lineTo(mmToPxX(tr.x2), mmToPxY(tr.y2));
        pcbCtx.stroke();
      }
    }

    /* SMD & Through-Hole Pads */
    if (state.layers["F.Cu"] || state.layers["B.Cu"]) {
      for (const pad of PCB_PADS) {
        const isHi = state.activeNet === "ALL" || state.activeNet === pad.net;
        const px = mmToPxX(pad.x - pad.w / 2);
        const py = mmToPxY(pad.y - pad.h / 2);
        const pw = pad.w * 18.0;
        const ph = pad.h * 18.0;

        if (pad.layer === "TH") {
          pcbCtx.fillStyle = isHi ? "#eab308" : "rgba(234, 179, 8, 0.25)";
          pcbCtx.fillRect(px, py, pw, ph);
          pcbCtx.fillStyle = "#090b10";
          pcbCtx.beginPath();
          pcbCtx.arc(mmToPxX(pad.x), mmToPxY(pad.y), 0.45 * 18.0, 0, Math.PI * 2);
          pcbCtx.fill();
        } else if (state.layers["F.Cu"]) {
          pcbCtx.fillStyle = isHi ? "#f59e0b" : "rgba(245, 158, 11, 0.22)";
          pcbCtx.fillRect(px, py, pw, ph);
        }
      }
    }

    /* Front Silkscreen & SOIC-8 Test Clip Keepout Box */
    if (state.layers["F.SilkS"]) {
      pcbCtx.save();
      pcbCtx.strokeStyle = pal.silk;
      pcbCtx.fillStyle = pal.silk;
      pcbCtx.font = "bold 12px ui-monospace, monospace";
      pcbCtx.textAlign = "center";

      pcbCtx.fillText("TINYPULSE-412 v1.0 (ATtiny412-SSNR 20MHz)", mmToPxX(119.0), mmToPxY(101.6));

      /* Dashed SOIC-8 Clip Keepout Zone around U1 */
      pcbCtx.setLineDash([5, 4]);
      pcbCtx.strokeStyle = "#38bdf8";
      pcbCtx.lineWidth = 1.5;
      pcbCtx.strokeRect(
        mmToPxX(114.5),
        mmToPxY(109.2),
        (123.5 - 114.5) * 18.0,
        (115.8 - 109.2) * 18.0
      );
      pcbCtx.setLineDash([]);
      pcbCtx.fillStyle = "#38bdf8";
      pcbCtx.font = "11px ui-monospace, monospace";
      pcbCtx.fillText("SOIC-8 CLIP KEEPOUT ZONE", mmToPxX(119.0), mmToPxY(108.7));

      /* U1 Body Outline */
      pcbCtx.strokeStyle = pal.silk;
      pcbCtx.strokeRect(mmToPxX(117.05), mmToPxY(110.05), 3.9 * 18.0, 4.9 * 18.0);
      pcbCtx.fillStyle = pal.silk;
      pcbCtx.fillText("U1", mmToPxX(119.0), mmToPxY(112.8));
      pcbCtx.fillText("C1 (100nF)", mmToPxX(119.0), mmToPxY(105.4));
      pcbCtx.fillText("J2 (OLED I2C)", mmToPxX(119.0), mmToPxY(102.5));
      pcbCtx.fillText("J1 (UPDI)", mmToPxX(134.5), mmToPxY(108.6));
      pcbCtx.fillText("BZ1 (PWM)", mmToPxX(128.5), mmToPxY(104.8));
      pcbCtx.fillText("SW1 (PA6)", mmToPxX(106.0), mmToPxY(124.0));
      pcbCtx.fillText("SW2 (PA7)", mmToPxX(132.0), mmToPxY(124.0));
      pcbCtx.fillText("D1", mmToPxX(103.5), mmToPxY(105.6));
      pcbCtx.fillText("D2", mmToPxX(103.5), mmToPxY(109.6));
      pcbCtx.restore();
    }

    /* Edge.Cuts 38.0 x 25.0 mm */
    if (state.layers["Edge.Cuts"]) {
      pcbCtx.strokeStyle = "#facc15";
      pcbCtx.lineWidth = 2.5;
      pcbCtx.strokeRect(bx, by, bw, bh);
    }
  }

  function renderOledAndRegisters() {
    const note = SCALE_NOTES[state.noteIdx];
    const bpm = BPM_PRESETS[state.bpmIdx];

    oledCtx.fillStyle = "#000000";
    oledCtx.fillRect(0, 0, oledCanvas.width, oledCanvas.height);

    /* Top Yellow Band of 0.96" Dual-Color SSD1306 OLED */
    oledCtx.fillStyle = "#facc15";
    oledCtx.font = "bold 13px ui-monospace, monospace";
    oledCtx.fillText(`TINYPULSE-412   BPM:${bpm}`, 10, 18);
    oledCtx.fillRect(8, 24, 240, 1);

    /* Main Cyan Waveform & Note Readout */
    oledCtx.fillStyle = "#38bdf8";
    oledCtx.font = "bold 18px ui-monospace, monospace";
    oledCtx.fillText(`NOTE: ${note.name} (${note.freqHz} Hz)`, 10, 50);

    oledCtx.font = "12px ui-monospace, monospace";
    oledCtx.fillText(`TCA0.CMP0 = ${note.cmp0} | BEAT ${state.beatStep + 1}/4`, 10, 70);

    /* Draw live square wave matching note frequency */
    oledCtx.strokeStyle = "#38bdf8";
    oledCtx.lineWidth = 2;
    oledCtx.beginPath();
    const halfPeriodPx = Math.max(8, Math.round(9000 / note.freqHz));
    let high = state.beatStep % 2 === 0;
    for (let x = 10; x < 246; x += halfPeriodPx) {
      const y = high ? 84 : 112;
      const nextX = Math.min(246, x + halfPeriodPx);
      oledCtx.lineTo(x, y);
      oledCtx.lineTo(nextX, y);
      high = !high;
    }
    oledCtx.stroke();

    /* Update Register DOM */
    document.getElementById("regCmp0").textContent =
      `0x${note.cmp0.toString(16).toUpperCase().padStart(4, "0")} (${note.cmp0})`;
    document.getElementById("regFreqDesc").textContent =
      `Output: ${computeTca0FrequencyHz(note.cmp0)} Hz (${note.name})`;

    const led1On = state.beatStep === 0;
    const led2On = state.beatStep % 2 === 0;
    document.getElementById("led1Bulb").classList.toggle("on", led1On);
    document.getElementById("led2Bulb").classList.toggle("on", led2On);

    const outMask = (led1On ? 0x40 : 0x00) | (led2On ? 0x80 : 0x00);
    document.getElementById("regPorta").textContent =
      `DIR=0xC8 OUT=0x${outMask.toString(16).toUpperCase().padStart(2, "0")}`;

    if (state.audioEnabled && state.osc) {
      state.osc.frequency.setValueAtTime(note.freqHz, state.audioCtx.currentTime);
    }
  }

  function populateBomTable() {
    const tbody = document.getElementById("bomTableBody");
    tbody.innerHTML = BOM_ITEMS.map(item => `
      <tr>
        <td><strong>${item.ref}</strong></td>
        <td>${item.qty1}</td>
        <td>${item.qty3}</td>
        <td>${item.desc}</td>
        <td><code>${item.mpn}</code></td>
        <td>${item.supplier}</td>
        <td>${item.pkg}</td>
        <td>$${item.unit.toFixed(2)}</td>
        <td><strong>$${item.ext3.toFixed(2)}</strong></td>
      </tr>
    `).join("");
    document.getElementById("totalCostDisplay").textContent =
      `$${computeTotalBudgetUsd().toFixed(2)} / $35.00`;
  }

  /* Bind UI Events */
  document.getElementById("themeSelect").addEventListener("change", (e) => {
    state.theme = e.target.value;
    renderPcb();
  });

  document.querySelectorAll(".layer-controls input[type='checkbox']").forEach(cb => {
    cb.addEventListener("change", () => {
      state.layers[cb.dataset.layer] = cb.checked;
      renderPcb();
    });
  });

  document.querySelectorAll(".net-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".net-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeNet = btn.dataset.net;
      renderPcb();
    });
  });

  document.getElementById("sw1Btn").addEventListener("click", () => {
    state.noteIdx = (state.noteIdx + 1) % SCALE_NOTES.length;
    renderOledAndRegisters();
  });

  document.getElementById("sw2Btn").addEventListener("click", () => {
    state.bpmIdx = (state.bpmIdx + 1) % BPM_PRESETS.length;
    renderOledAndRegisters();
  });

  document.getElementById("audioToggleBtn").addEventListener("click", (e) => {
    if (!state.audioEnabled) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioCtx();
      state.osc = state.audioCtx.createOscillator();
      state.gain = state.audioCtx.createGain();
      state.osc.type = "square";
      state.osc.frequency.value = SCALE_NOTES[state.noteIdx].freqHz;
      state.gain.gain.value = 0.06;
      state.osc.connect(state.gain);
      state.gain.connect(state.audioCtx.destination);
      state.osc.start();
      state.audioEnabled = true;
      e.target.textContent = "Mute WebAudio Synth";
      e.target.classList.add("active");
    } else {
      if (state.osc) state.osc.stop();
      if (state.audioCtx) state.audioCtx.close();
      state.osc = null;
      state.audioCtx = null;
      state.audioEnabled = false;
      e.target.textContent = "Enable WebAudio Synth";
      e.target.classList.remove("active");
    }
  });

  /* Metronome Beat Timer */
  function stepMetronome() {
    state.beatStep = (state.beatStep + 1) % 4;
    renderOledAndRegisters();
    const delayMs = Math.round(60000 / BPM_PRESETS[state.bpmIdx]);
    setTimeout(stepMetronome, delayMs);
  }

  populateBomTable();
  renderPcb();
  renderOledAndRegisters();
  setTimeout(stepMetronome, 500);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SCALE_NOTES,
    BPM_PRESETS,
    BOM_ITEMS,
    PCB_TRACES,
    PCB_PADS,
    computeTca0FrequencyHz,
    computeTotalBudgetUsd
  };
}
