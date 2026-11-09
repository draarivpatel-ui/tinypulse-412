# Engineering Journal: TinyPulse-412 Pocket Synth & Precision Metronome

**Author:** Aariv Patel (`draarivpatel-ui`)  
**Target MCU:** Microchip `ATtiny412-SSNR` (8-Pin SOIC, 20 MHz, 4 KB Flash, 256 B SRAM, UPDI)  
**Board Dimensions:** `38.0 mm x 25.0 mm` (`1.50 in x 0.98 in` = `1.47 sq in`)  
**Total Logged Engineering Time:** **9.5 Hours** (across 6 design, routing, firmware, and enclosure sessions)  
**Total Hardware Budget:** **$24.15 USD** ($7.35 OSH Park 2-Layer PCB + $16.80 DigiKey Components, well under the $35.00 Hack Club 8-Pin Grant limit)

---

## Session 1: MCU Architecture Selection & 8-Pin Multiplexing Budget (1.5 Hours)
**Date:** November 3, 2026  
**Time Spent:** 1.5 Hours (Cumulative: 1.5 Hours)

### Objective
Select a modern 8-pin microcontroller that improves upon legacy `ATtiny85` limitations and design a complete pin budget for a pocket chiptune synthesizer and musician's visual/audio metronome with an I2C OLED display.

### Technical Tradeoffs: `ATtiny412-SSNR` vs `ATtiny85-20SU`
Initially I evaluated the classic `ATtiny85`, which uses 4-wire SPI ISP programming (`MOSI`, `MISO`, `SCK`, `RESET`). On an 8-pin package, ISP programming forces you to worry about load impedances on three signal pins during flashing, and `ATtiny85` only has a Universal Serial Interface (`USI`) rather than a dedicated hardware I2C master peripheral.

Switching to the Microchip tinyAVR-1 series **`ATtiny412-SSNR`** (SOIC-8) solved both issues:
1. **Single-Wire UPDI Programming (`PA0`):** Programming and live hardware debugging require only a single signal wire (`PA0`), `VDD`, and `GND`. That leaves 5 dedicated GPIO pins completely isolated from the programming header.
2. **True Hardware Peripherals:** The `ATtiny412` includes a dedicated hardware `TWI0` (I2C) peripheral on `PA1` (`SDA`) and `PA2` (`SCL`), a 16-bit `TCA0` timer/counter with hardware waveform output on `PA3`, a 16-bit `TCB0` periodic timer, and an internal 20 MHz RC oscillator accurate to within 2% at room temperature.
3. **Cost:** At `$0.68` in single-unit quantities on DigiKey (`ATTINY412-SSNR`), it costs less than half the price of an `ATtiny85`.

### 8-Pin Allocation & Time-Division Multiplexing Strategy
With 8 total pins on the `SOIC-8` package (`Pin 1 = VDD`, `Pin 8 = GND`, `Pin 6 = PA0/UPDI`), we have 5 application pins (`PA1`, `PA2`, `PA3`, `PA6`, `PA7`) to drive:
- A 128x64 `SSD1306` I2C OLED screen (2 pins: `PA1/SDA`, `PA2/SCL`)
- A 9mm magnetic/piezo audio transducer (`BZ1`) on hardware frequency PWM (1 pin: `PA3`)
- Two tactile pushbuttons (`SW1` for pitch/scale, `SW2` for tempo/BPM)
- Two high-efficiency red 0805 status LEDs (`D1` for downbeat flash, `D2` for synth gate)

To fit both buttons and both LEDs onto the remaining two pins (`PA6` and `PA7`), I designed a **time-division multiplexed (TDM) GPIO stage**:
- Each pin (`PA6` and `PA7`) drives an `LTST-C170KRKT` LED through a `330 Ohm` series resistor (`R3`, `R4`) to `GND`, and also connects to an active-low tactile switch (`SW1`, `SW2`) to `GND`.
- Every 1 ms, firmware switches `PA6` and `PA7` to inputs with internal 22 kOhm pull-ups enabled (`PORT_PULLUPEN_bm`), waits 4 microseconds for pin capacitance to settle, and samples `PORTA.IN`. When a button is open, the LED forward voltage (`1.85V`) prevents the 22 kOhm pull-up from pulling the pin low, reading logic `1`. When a button is pressed, the switch shorts the pin directly to `GND`, reading logic `0`. Immediately after sampling, `PA6` and `PA7` return to low-impedance push-pull outputs to drive the LEDs at >99% duty cycle with zero visible flicker.

---

## Session 2: KiCad 8 Schematic Capture & Power Integrity (1.5 Hours)
**Date:** November 4, 2026  
**Time Spent:** 1.5 Hours (Cumulative: 3.0 Hours)

### Objective
Capture the full schematic in `hardware/tinypulse-412.kicad_sch` and assign verified SMD/through-hole footprints and DigiKey Manufacturer Part Numbers.

### Key Circuit Decisions
1. **Local High-Frequency Decoupling (`C1`):** Placed a `100nF` 50V X7R 0805 ceramic capacitor (`CL21B104KBCNNNC`) directly across `U1` Pin 1 (`VDD`) and Pin 8 (`GND`) to suppress current spikes when `TCA0` toggles the piezo transducer at audio frequencies.
2. **I2C Bus Pull-Up Network (`R1`, `R2`):** Calculated pull-up resistance for a 100 kHz / 400 kHz I2C bus running from a `3.0V` `CR2032` lithium coin cell (`BS-7`). Using `4.7k Ohm` 0805 resistors (`RC0805FR-074K7L`) keeps bus rise time under `120 ns` (`C_bus ~ 25 pF`) while limiting quiescent sink current during low pulses to `0.63 mA`.
3. **Dual Programming Support (SOIC-8 Test Clip + 3-Pin UPDI Header `J1`):** Per the Hack Club 8-Pin Grant design guidelines, I included a dedicated 3-pin 2.54mm UPDI header (`J1`: `PA0/UPDI`, `VDD`, `GND`) on the right board edge AND annotated a mechanical keepout zone on `F.SilkS` around `U1` so a Pomona/3M SOIC-8 test clip can clamp directly onto the IC without hitting adjacent passives.

---

## Session 3: 2-Layer PCB Layout, SOIC-8 Clip Keepout & OSH Park Rules (2.0 Hours)
**Date:** November 5, 2026  
**Time Spent:** 2.0 Hours (Cumulative: 5.0 Hours)

### Objective
Lay out the 2-layer board in `hardware/tinypulse-412.kicad_pcb` to hit the exact pocket form factor while respecting all OSH Park 2-layer and PCBWay design rules.

### Board Geometry & Cost Optimization
- **Outline (`Edge.Cuts`):** `38.0 mm x 25.0 mm` (`1.496 in x 0.984 in`).
- **Area:** `1.472 sq in`. At OSH Park's `$5.00 / sq in` rate for 3 boards (including OSH Park After Dark), fabrication costs **`$7.35`** total with free shipping.
- **SOIC-8 Clip Keepout:** `U1` is centered at `(119.0, 112.5)` mm. I enforced a `9.0 mm x 6.6 mm` component keepout box around `U1` (`x: 114.5..123.5 mm`, `y: 109.2..115.8 mm`), placing `C1` above the keepout at `y = 106.5 mm` and `R1`/`R2` below the keepout at `y = 117.8 mm`. A standard SOIC-8 programming clip slides onto `U1` with zero mechanical interference.
- **Double-Sided Space Saving:** Mounted the `BS-7` CR2032 coin-cell retainer (`BT1`) on the back copper layer (`B.Cu`) centered at `(119.0, 113.0)` mm so the entire battery sits underneath the user interface, keeping the front panel clean for the OLED header (`J2`), tactile buttons (`SW1`, `SW2`), beat LEDs (`D1`, `D2`), and buzzer (`BZ1`).
- **Trace Widths & Clearances:**
  - Power nets (`VDD`, `GND`): `0.35 mm` (`13.8 mil`) trace width, exceeding the `6 mil` (`0.1524 mm`) OSH Park minimum by `2.3x`.
  - Signal nets (`PA0`..`PA7`): `0.25 mm` (`9.8 mil`) trace width.
  - Minimum drill size: `0.80 mm` (`31.5 mil`) on `BZ1`, `1.00 mm` (`39.4 mil`) on `J1`/`J2`, and `1.20 mm` (`47.2 mil`) on `BT1`, all well above the `13 mil` (`0.3302 mm`) OSH Park drill minimum.

---

## Session 4: Gerber Generation, OSH Park vs PCBWay Packages & BOM Audit (1.5 Hours)
**Date:** November 6, 2026  
**Time Spent:** 1.5 Hours (Cumulative: 6.5 Hours)

### Objective
Plot RS-274X Gerbers and Excellon drill files, verify layer polarity and drill alignment, prepare dual fabrication archives, and audit the DigiKey BOM.

### Fabrication Outputs
Generated 7 Gerber layers (`F.Cu`, `B.Cu`, `F.Mask`, `B.Mask`, `F.SilkS`, `B.SilkS`, `Edge.Cuts`) plus the plated through-hole Excellon drill file (`tinypulse-412-PTH.drl`) in `hardware/gerbers/` and packaged two fabrication archives:
1. `hardware/tinypulse-412-oshpark.zip` - Includes all RS-274X Gerbers, Excellon drill file, and the native `tinypulse-412.kicad_pcb` board file for OSH Park 2-Layer Purple or OSH Park After Dark (black substrate, clear solder mask, copper traces).
2. `hardware/tinypulse-412-pcbway.zip` - Includes the `PCBWay Sponsored Prototype` vector silkscreen marking on `B.SilkS` (`tinypulse-412-B_SilkS.gbo`) to satisfy the PCBWay Student Sponsorship visual requirement.

### Full BOM Verification (`hardware/bom.csv`)
Every component was matched to an in-stock DigiKey Manufacturer Part Number with quantities scaled for building all 3 boards:
- `U1`: `ATTINY412-SSNR` (Qty 3 @ $0.68 = $2.04)
- `C1`: `CL21B104KBCNNNC` (Qty 3 @ $0.10 = $0.30)
- `R1, R2`: `RC0805FR-074K7L` (Qty 6 @ $0.10 = $0.60)
- `R3, R4`: `RC0805FR-07330RL` (Qty 6 @ $0.10 = $0.60)
- `D1, D2`: `LTST-C170KRKT` (Qty 6 @ $0.18 = $1.08)
- `SW1, SW2`: `PTS645SM43SMTR92LFS` (Qty 6 @ $0.28 = $1.68)
- `BZ1`: `ABI-009-RC` (Qty 3 @ $1.35 = $4.05)
- `BT1`: `BS-7` (Qty 3 @ $0.75 = $2.25)
- `J1`: `PRPC003SAAN-RC` (Qty 3 @ $0.25 = $0.75)
- `J2`: `PRPC004SAAN-RC` (Qty 3 @ $0.35 = $1.05)
- `MOD1`: `SSD1306-128X64-I2C` (Qty 1 @ $2.40 = $2.40)
- `PCB1`: `TINYPULSE-412-PCB` (3 boards on OSH Park = $7.35)
- **Grand Total:** **$24.15 USD** ($10.85 below the $35.00 Hack Club 8-Pin Grant ceiling).

---

## Session 5: Bare-Metal AVR-GCC Firmware & Register-Level Simulation (2.0 Hours)
**Date:** November 7, 2026  
**Time Spent:** 2.0 Hours (Cumulative: 8.5 Hours)

### Objective
Write bare-metal C11 firmware (`firmware/main.c` and `firmware/Makefile`) that fits comfortably inside `4096 bytes` of Flash and `256 bytes` of SRAM without relying on bloated Arduino wrappers.

### Register-Level Implementation Details
- **Zero-RAM OLED Rendering:** A full `128 x 64` monochrome framebuffer requires `1024 bytes` of RAM, which is 4x larger than the `ATtiny412`'s entire `256-byte` SRAM! Instead of buffering the display in RAM, I wrote a direct-stream tile engine over `TWI0` (`TWI0.MBAUD = 20`, `TWI0.MADDR = 0x78`) that computes column bitmasks on the fly during each I2C burst transaction. Total SRAM usage is just `18 bytes`.
- **Hardware Frequency Waveform Generation (`TCA0`):** Configured `TCA0.SINGLE.CTRLB = TCA_SINGLE_CMP0EN_bm | TCA_SINGLE_WGMODE_FRQ_gc` with `CLKSEL_DIV16` at a `5 MHz` system clock. The hardware timer toggles `PA3` autonomously in silicon with zero CPU interrupt overhead. Loading `TCA0.SINGLE.CMP0 = 354` produces an exact `440.14 Hz` (`A4`) square wave (`156250 / (354 + 1)`).
- **Flashing via SerialUPDI:** Configured `firmware/Makefile` to compile with `-Os -ffunction-sections -fdata-sections -Wl,--gc-sections` and flash over a USB-UART adapter with a 4.7k resistor between TX and RX using `pymcuprog write -d attiny412 -t uart`.

---

## Session 6: Parametric 3D Enclosure CAD & Web Hardware Inspector (1.0 Hour)
**Date:** November 8, 2026  
**Time Spent:** 1.0 Hour (Cumulative: 9.5 Hours)

### Objective
Design a 3D-printable snap-fit pocket tray (`cad/enclosure.scad` and `cad/enclosure.stl`) and build a browser-based PCB layer inspector and live ATtiny412 register/audio simulator (`index.html`, `app.js`, `test.js`).

### Enclosure & Verification Summary
- Modeled a `42.8 mm x 29.8 mm x 8.5 mm` rounded shell in OpenSCAD (`cad/enclosure.scad`) with `0.4 mm` perimeter clearance around the `38.0 mm x 25.0 mm` PCB, `3.5 mm` corner standoff ledges to clear the bottom-mounted `BS-7` CR2032 holder, a side cutout for the 3-pin `J1` UPDI header, and a `4.0 mm` lanyard hole.
- Exported `cad/enclosure.stl` (`108` watertight triangular facets) for direct slicing in PrusaSlicer/OrcaSlicer at `0.20 mm` layer height (11 minutes print time, 3.2g PLA).
- Built an interactive Web Inspector (`index.html`, `app.js`) that renders the PCB layers (`F.Cu`, `B.Cu`, `F.SilkS`, `B.SilkS`, `Edge.Cuts`, and the `SOIC-8` clip keepout zone), highlights nets interactively, plays real WebAudio square-wave tones matching the `ATtiny412` `TCA0.CMP0` register math, and validates all grant requirements via `node --test test.js`.
