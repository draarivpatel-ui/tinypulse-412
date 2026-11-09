# TinyPulse-412: ATtiny412 8-Pin Pocket Chiptune Synth & Precision Metronome

**Live Interactive PCB Layout & ATtiny412 Hardware Simulator:** [https://aariv.me/tinypulse-412/](https://aariv.me/tinypulse-412/)  
**MCU:** Microchip `ATtiny412-SSNR` (SOIC-8, 20 MHz, 4 KB Flash, 256 B SRAM, Single-Wire UPDI)  
**Board Size:** `38.0 mm x 25.0 mm` (`1.50 in x 0.98 in` = `1.47 sq in`)  
**Total Cost (3 Complete Boards):** **$24.15 USD** (`$7.35` OSH Park 2-Layer / After Dark PCB + `$16.80` DigiKey Components, under the `$35.00` Hack Club 8-Pin Grant limit)

---

## Project Overview

**TinyPulse-412** is a pocket-sized chiptune square-wave synthesizer, musician's visual/audio BPM metronome, and hardware I2C OLED status engine built around the 8-pin **Microchip `ATtiny412-SSNR`** microcontroller.

Designed in **KiCad 8** to satisfy both the **Hack Club 8-Pin Grant** and **PCBWay Student Sponsorship**, the board demonstrates how to drive an entire human-machine interface from a single 8-pin SOIC package without external GPIO expanders:
- **Hardware I2C (`TWI0`) on `PA1` (`SDA`) & `PA2` (`SCL`):** Streams a zero-RAM tile display directly to a `128x64` `SSD1306` OLED header (`J2`) at 100 kHz with `4.7k Ohm` 0805 pull-up resistors (`R1`, `R2`).
- **Hardware Frequency Waveform Generator (`TCA0`) on `PA3`:** Toggles a 9mm magnetic/piezo transducer (`BZ1`) directly in silicon (`TCA_SINGLE_WGMODE_FRQ_gc`) for jitter-free pentatonic chiptune synthesis (`261.6 Hz` to `659.3 Hz`) and crisp downbeat metronome clicks.
- **Time-Division Multiplexed (TDM) GPIO on `PA6` & `PA7`:** Shares two tactile pushbuttons (`SW1` for pitch/scale, `SW2` for BPM tempo) and two high-efficiency 0805 status LEDs (`D1` beat sync, `D2` synth gate) on the same two pins using a 1 kHz input-pullup / push-pull output scan cycle.
- **Dual UPDI Programming Access (`PA0`):** Includes both a 3-pin `2.54mm` through-hole UPDI header (`J1`: `PA0/UPDI`, `VDD`, `GND`) and a dedicated **`9.0 mm x 6.6 mm` SOIC-8 test clip keepout zone** around `U1` so the chip can be flashed either with header pins or directly with a Pomona SOIC-8 clip.

---

## Repository Structure

```text
tinypulse-412/
├── hardware/
│   ├── tinypulse-412.kicad_pro          # KiCad 8 Project & OSH Park 6-mil DRC Rules
│   ├── tinypulse-412.kicad_sch          # KiCad 8 S-Expression Schematic
│   ├── tinypulse-412.kicad_pcb          # KiCad 8 2-Layer PCB Layout (38.0 x 25.0 mm)
│   ├── bom.csv                          # Verified DigiKey & OSH Park BOM ($24.15 total for 3x)
│   ├── tinypulse-412-oshpark.zip        # Ready-to-upload OSH Park 2-Layer / After Dark Archive
│   ├── tinypulse-412-pcbway.zip         # Ready-to-upload PCBWay Sponsorship Gerber Archive
│   └── gerbers/                         # Individual RS-274X Gerbers (.gtl/.gbl/.gts/.gbs/.gto/.gbo/.gm1) & .drl
├── firmware/
│   ├── main.c                           # Bare-Metal AVR-GCC C11 Firmware (TCA0 PWM, TWI0 OLED, TDM GPIO)
│   └── Makefile                         # AVR-GCC build + pymcuprog SerialUPDI flashing targets
├── cad/
│   ├── enclosure.scad                   # Parametric OpenSCAD Snap-Fit Pocket Case
│   └── enclosure.stl                    # 3D-Printable Watertight Mesh (42.8 x 29.8 x 8.5 mm)
├── scripts/
│   └── generate_hardware.py             # Reproducible KiCad / Gerber / STL build script
├── JOURNAL.md                           # 9.5-Hour Chronological Engineering Journal (6 Sessions)
├── index.html                           # Interactive Web PCB Layer Viewer & ATtiny412 Register Simulator
├── style.css                            # Dark Engineering Workbench UI Styles
├── app.js                               # Canvas Gerber/PCB Renderer + WebAudio TCA0 Synth Engine
└── test.js                              # Automated Node.js Verification Suite (KiCad, Gerbers, BOM, Math)
```

---

## Bill of Materials (`hardware/bom.csv`)

All components are in stock at DigiKey and priced for **3 complete boards**:

| RefDes | Qty (1 Board) | Qty (3 Boards) | Description | Manufacturer Part Number | Supplier | Package | Unit Price | Ext Price (3 Boards) |
| :--- | :---: | :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| `U1` | 1 | 3 | 8-Bit AVR tinyAVR-1 MCU 20MHz 4KB Flash 256B SRAM UPDI | `ATTINY412-SSNR` | DigiKey | SOIC-8 | $0.68 | $2.04 |
| `C1` | 1 | 3 | 100nF 50V X7R Ceramic Decoupling Capacitor | `CL21B104KBCNNNC` | DigiKey | 0805 | $0.10 | $0.30 |
| `R1;R2` | 2 | 6 | 4.7k Ohm 1% 1/8W Thick Film I2C Pull-Up Resistor | `RC0805FR-074K7L` | DigiKey | 0805 | $0.10 | $0.60 |
| `R3;R4` | 2 | 6 | 330 Ohm 1% 1/8W Thick Film LED Current-Limiting Resistor | `RC0805FR-07330RL` | DigiKey | 0805 | $0.10 | $0.60 |
| `D1;D2` | 2 | 6 | Super Red 631nm Indicator LED 20mA | `LTST-C170KRKT` | DigiKey | 0805 | $0.18 | $1.08 |
| `SW1;SW2` | 2 | 6 | 6.0mm x 6.0mm SMD Tactile Pushbutton Switch 160gf | `PTS645SM43SMTR92LFS` | DigiKey | SMD-4 | $0.28 | $1.68 |
| `BZ1` | 1 | 3 | 9.0mm Magnetic Piezo Audio Transducer 4kHz PWM | `ABI-009-RC` | DigiKey | TH-9mm | $1.35 | $4.05 |
| `BT1` | 1 | 3 | CR2032 20mm Coin Cell Battery Retainer Holder | `BS-7` | DigiKey | TH-CR2032 | $0.75 | $2.25 |
| `J1` | 1 | 3 | 3-Pin 2.54mm Pitch Vertical UPDI Programming Header | `PRPC003SAAN-RC` | DigiKey | 1x03-2.54mm | $0.25 | $0.75 |
| `J2` | 1 | 3 | 4-Pin 2.54mm Pitch I2C OLED Socket Header | `PRPC004SAAN-RC` | DigiKey | 1x04-2.54mm | $0.35 | $1.05 |
| `MOD1` | 1 | 1 | 0.96 inch 128x64 SSD1306 I2C OLED Display Module | `SSD1306-128X64-I2C` | DigiKey | Module-4Pin | $2.40 | $2.40 |
| `PCB1` | 1 | 3 | OSH Park 2-Layer Purple / After Dark PCB (38x25mm = 1.47 sq in) | `TINYPULSE-412-PCB` | OSH Park | 38x25mm | $2.45 | $7.35 |
| **Total** | | | **Complete 3-Board Hardware + PCB Fabrication Total** | | | | | **$24.15** |

---

## Building Firmware & Running Hardware Verification Tests

```bash
# Run the automated KiCad / Gerber / BOM / Register verification test suite
node --test test.js

# Compile bare-metal ATtiny412 firmware (requires avr-gcc)
make -C firmware all

# Flash over SerialUPDI (USB-UART adapter + 4.7k resistor on J1)
make -C firmware flash UPDI_PORT=/dev/ttyUSB0
```

## License

Released under the [MIT License](LICENSE) by Aariv Patel (`draarivpatel-ui`).
