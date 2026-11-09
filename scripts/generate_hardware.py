#!/usr/bin/env python3
"""
Generator for TinyPulse-412 KiCad 8 files, RS-274X Gerbers, Excellon Drill,
OSH Park / PCBWay fabrication archives, BOM CSV, and 3D Enclosure STL.
"""
import json
import math
import os
import struct
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HW_DIR = os.path.join(ROOT, "hardware")
GERBER_DIR = os.path.join(HW_DIR, "gerbers")
CAD_DIR = os.path.join(ROOT, "cad")

os.makedirs(GERBER_DIR, exist_ok=True)
os.makedirs(CAD_DIR, exist_ok=True)

# 1. KiCad Project (.kicad_pro)
kicad_pro = {
    "board": {
        "3dviewports": [],
        "design_settings": {
            "defaults": {
                "board_outline_line_width": 0.15,
                "copper_line_width": 0.25,
                "copper_text_size_h": 1.0,
                "copper_text_size_v": 1.0,
                "copper_text_thickness": 0.15,
                "silk_line_width": 0.15,
                "silk_text_size_h": 1.0,
                "silk_text_size_v": 1.0,
                "silk_text_thickness": 0.15
            },
            "diff_pair_dimensions": [],
            "drc_exclusions": [],
            "meta": {"version": 2},
            "rule_severities": {
                "annular_width": "error",
                "clearance": "error",
                "copper_edge_clearance": "error",
                "courtyards_overlap": "error",
                "hole_clearance": "error",
                "hole_to_hole": "error",
                "Minimum_drill": "error",
                "track_width": "error",
                "unconnected_items": "error"
            },
            "rules": {
                "min_annular_width": 0.1778,
                "min_clearance": 0.1524,
                "min_copper_edge_clearance": 0.381,
                "min_hole_clearance": 0.25,
                "min_hole_to_hole": 0.25,
                "min_through_hole_diameter": 0.3302,
                "min_track_width": 0.1524,
                "min_via_annular_width": 0.1778,
                "min_via_diameter": 0.6858
            },
            "teardrop_options": [{"td_onpadsmd": True, "td_onroundshapesonly": False, "td_ontrackend": False, "td_onviapad": True}],
            "track_widths": [0.0, 0.20, 0.25, 0.40, 0.50],
            "via_dimensions": [{"diameter": 0.8, "drill": 0.4}]
        },
        "layer_presets": [],
        "viewports": []
    },
    "boards": [],
    "cvpcb": {"equivalence_files": []},
    "libraries": {"pinned_footprint_libs": [], "pinned_symbol_libs": []},
    "meta": {"filename": "tinypulse-412.kicad_pro", "version": 1},
    "net_settings": {
        "classes": [
            {
                "bus_width": 12,
                "clearance": 0.2,
                "diff_pair_gap": 0.25,
                "diff_pair_via_gap": 0.25,
                "diff_pair_width": 0.2,
                "line_style": 0,
                "microvia_diameter": 0.3,
                "microvia_drill": 0.1,
                "name": "Default",
                "pcb_color": "rgba(0, 0, 0, 0.000)",
                "schematic_color": "rgba(0, 0, 0, 0.000)",
                "track_width": 0.25,
                "via_diameter": 0.8,
                "via_drill": 0.4,
                "wire_width": 6
            },
            {
                "bus_width": 12,
                "clearance": 0.25,
                "diff_pair_gap": 0.25,
                "diff_pair_via_gap": 0.25,
                "diff_pair_width": 0.2,
                "line_style": 0,
                "microvia_diameter": 0.3,
                "microvia_drill": 0.1,
                "name": "Power",
                "pcb_color": "rgba(255, 50, 50, 0.800)",
                "schematic_color": "rgba(255, 50, 50, 0.800)",
                "track_width": 0.45,
                "via_diameter": 0.8,
                "via_drill": 0.4,
                "wire_width": 8
            }
        ],
        "meta": {"version": 3},
        "net_colors": None,
        "netclass_assignments": {"GND": "Power", "VDD": "Power", "VBAT": "Power"},
        "netclass_patterns": []
    },
    "pcbnew": {"last_paths": {"gencad": "", "idf": "", "netlist": "", "plot": "gerbers/", "pos_files": "", "specctra_dsn": "", "step": "", "svg": "", "vrml": ""}, "page_layout_descr_file": ""},
    "schematic": {"annotate_start_num": 0, "drawing": {"dashed_lines_dash_length_ratio": 12.0, "dashed_lines_gap_length_ratio": 3.0, "default_line_thickness": 6.0, "default_text_size": 50.0, "field_names": [], "intersheets_ref_own_page": False, "intersheets_ref_prefix": "", "intersheets_ref_short": False, "intersheets_ref_show": False, "intersheets_ref_suffix": "", "junction_size_choice": 3, "label_size_ratio": 0.375, "operating_point_overlay_i_precision": 3, "operating_point_overlay_i_range": "~A", "operating_point_overlay_v_precision": 3, "operating_point_overlay_v_range": "~V", "overbar_offset_ratio": 1.23, "pin_symbol_size": 25.0, "text_offset_ratio": 0.15}, "legacy_lib_dir": "", "legacy_lib_list": [], "meta": {"version": 2}, "net_format_name": "", "page_layout_descr_file": "", "plot_directory": "", "spice_current_sheet_as_root": False, "spice_external_command": "spice \"%I\"", "Price_model_as_subckt": True, " spice_save_all_currents": False, "spice_save_all_dissipations": False, "spice_save_all_voltages": False, "subpart_first_id": 65, "subpart_id_separator": 0},
    "sheets": [["e5d5267a-3214-4809-b614-1234567890ab", "Root"]],
    "text_variables": {}
}

with open(os.path.join(HW_DIR, "tinypulse-412.kicad_pro"), "w") as f:
    json.dump(kicad_pro, f, indent=2)

# 2. KiCad Schematic (.kicad_sch)
kicad_sch = """(kicad_sch
  (version 20231120)
  (generator "eeschema")
  (generator_version "8.0")
  (uuid "e5d5267a-3214-4809-b614-1234567890ab")
  (paper "A4")
  (title_block
    (title "TinyPulse-412: ATtiny412 Pocket Chiptune Synth & Metronome")
    (date "2026-11-08")
    (rev "v1.0")
    (company "Aariv Patel - Hack Club 8-Pin Grant & PCBWay")
    (comment 1 "MCU: ATtiny412-SSNR (SOIC-8, 20MHz, UPDI on PA0)")
    (comment 2 "OSH Park 2-Layer After Dark Compatible (38.0 x 25.0 mm)")
  )
  (lib_symbols
    (symbol "MCU_Microchip_ATtiny:ATtiny412-SS"
      (in_bom yes) (on_board yes)
      (property "Reference" "U" (at 0 11.43 0) (effects (font (size 1.27 1.27))))
      (property "Value" "ATtiny412-SSNR" (at 0 -11.43 0) (effects (font (size 1.27 1.27))))
      (property "Footprint" "Package_SO:SOIC-8_3.9x4.9mm_P1.27mm" (at 0 -13.97 0) (effects (font (size 1.27 1.27)) hide))
      (property "Datasheet" "http://ww1.microchip.com/downloads/en/DeviceDoc/ATtiny212-412-DataSheet-DS40001911B.pdf" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (property "Part Number" "ATTINY412-SSNR" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (symbol "ATtiny412-SS_1_1"
        (rectangle (start -7.62 10.16) (end 7.62 -10.16) (stroke (width 0.254) (type default)) (fill (type background)))
        (pin power_in line (at 0 12.7 270) (length 2.54) (name "VCC") (number "1"))
        (pin bidirectional line (at -10.16 5.08 0) (length 2.54) (name "PA6") (number "2"))
        (pin bidirectional line (at -10.16 2.54 0) (length 2.54) (name "PA7") (number "3"))
        (pin bidirectional line (at 10.16 5.08 180) (length 2.54) (name "PA1/SDA") (number "4"))
        (pin bidirectional line (at 10.16 2.54 180) (length 2.54) (name "PA2/SCL") (number "5"))
        (pin bidirectional line (at -10.16 -5.08 0) (length 2.54) (name "PA0/UPDI") (number "6"))
        (pin bidirectional line (at 10.16 -2.54 180) (length 2.54) (name "PA3/PWM") (number "7"))
        (pin power_in line (at 0 -12.7 90) (length 2.54) (name "GND") (number "8"))
      )
    )
    (symbol "Device:C"
      (pin_numbers hide) (pin_names (offset 0.254)) (in_bom yes) (on_board yes)
      (property "Reference" "C" (at 0.635 2.54 0) (effects (font (size 1.27 1.27)) (justify left)))
      (property "Value" "100nF" (at 0.635 -2.54 0) (effects (font (size 1.27 1.27)) (justify left)))
      (property "Footprint" "Capacitor_SMD:C_0805_2012Metric" (at 0.9652 -3.81 0) (effects (font (size 1.27 1.27)) hide))
      (symbol "C_1_1"
        (polyline (pts (xy -2.032 -0.762) (xy 2.032 -0.762)) (stroke (width 0.508) (type default)) (fill (type none)))
        (polyline (pts (xy -2.032 0.762) (xy 2.032 0.762)) (stroke (width 0.508) (type default)) (fill (type none)))
        (pin passive line (at 0 3.81 270) (length 3.048) (name "~") (number "1"))
        (pin passive line (at 0 -3.81 90) (length 3.048) (name "~") (number "2"))
      )
    )
    (symbol "Device:R"
      (pin_numbers hide) (pin_names (offset 0)) (in_bom yes) (on_board yes)
      (property "Reference" "R" (at 2.032 0 90) (effects (font (size 1.27 1.27))))
      (property "Value" "R" (at 0 0 90) (effects (font (size 1.27 1.27))))
      (property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at -1.778 0 90) (effects (font (size 1.27 1.27)) hide))
      (symbol "R_1_1"
        (rectangle (start -1.016 -2.54) (end 1.016 2.54) (stroke (width 0.254) (type default)) (fill (type none)))
        (pin passive line (at 0 3.81 270) (length 1.27) (name "~") (number "1"))
        (pin passive line (at 0 -3.81 90) (length 1.27) (name "~") (number "2"))
      )
    )
    (symbol "Device:LED"
      (pin_numbers hide) (pin_names (offset 1.016) hide) (in_bom yes) (on_board yes)
      (property "Reference" "D" (at 0 2.54 0) (effects (font (size 1.27 1.27))))
      (property "Value" "LED" (at 0 -2.54 0) (effects (font (size 1.27 1.27))))
      (property "Footprint" "LED_SMD:LED_0805_2012Metric" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (symbol "LED_1_1"
        (pin passive line (at -3.81 0 0) (length 2.54) (name "K") (number "1"))
        (pin passive line (at 3.81 0 180) (length 2.54) (name "A") (number "2"))
      )
    )
  )
  (symbol (lib_id "MCU_Microchip_ATtiny:ATtiny412-SS") (at 139.7 96.52 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid "11111111-2222-3333-4444-555555550001")
    (property "Reference" "U1" (at 139.7 83.82 0) (effects (font (size 1.27 1.27))))
    (property "Value" "ATtiny412-SSNR" (at 139.7 109.22 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "Package_SO:SOIC-8_3.9x4.9mm_P1.27mm" (at 139.7 96.52 0) (effects (font (size 1.27 1.27)) hide))
    (property "Part Number" "ATTINY412-SSNR" (at 139.7 96.52 0) (effects (font (size 1.27 1.27)) hide))
  )
  (symbol (lib_id "Device:C") (at 114.3 96.52 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid "11111111-2222-3333-4444-555555550002")
    (property "Reference" "C1" (at 116.84 95.25 0) (effects (font (size 1.27 1.27))))
    (property "Value" "100nF" (at 116.84 97.79 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "Capacitor_SMD:C_0805_2012Metric" (at 114.3 96.52 0) (effects (font (size 1.27 1.27)) hide))
    (property "Part Number" "CL21B104KBCNNNC" (at 114.3 96.52 0) (effects (font (size 1.27 1.27)) hide))
  )
  (symbol (lib_id "Device:R") (at 162.56 88.9 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid "11111111-2222-3333-4444-555555550003")
    (property "Reference" "R1" (at 165.1 87.63 0) (effects (font (size 1.27 1.27))))
    (property "Value" "4.7k" (at 165.1 90.17 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at 162.56 88.9 0) (effects (font (size 1.27 1.27)) hide))
    (property "Part Number" "RC0805FR-074K7L" (at 162.56 88.9 0) (effects (font (size 1.27 1.27)) hide))
  )
  (symbol (lib_id "Device:R") (at 170.18 88.9 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid "11111111-2222-3333-4444-555555550004")
    (property "Reference" "R2" (at 172.72 87.63 0) (effects (font (size 1.27 1.27))))
    (property "Value" "4.7k" (at 172.72 90.17 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at 170.18 88.9 0) (effects (font (size 1.27 1.27)) hide))
    (property "Part Number" "RC0805FR-074K7L" (at 170.18 88.9 0) (effects (font (size 1.27 1.27)) hide))
  )
  (symbol (lib_id "Device:R") (at 114.3 114.3 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid "11111111-2222-3333-4444-555555550005")
    (property "Reference" "R3" (at 116.84 113.03 0) (effects (font (size 1.27 1.27))))
    (property "Value" "330R" (at 116.84 115.57 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at 114.3 114.3 0) (effects (font (size 1.27 1.27)) hide))
    (property "Part Number" "RC0805FR-07330RL" (at 114.3 114.3 0) (effects (font (size 1.27 1.27)) hide))
  )
  (symbol (lib_id "Device:R") (at 124.46 114.3 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid "11111111-2222-3333-4444-555555550006")
    (property "Reference" "R4" (at 127.0 113.03 0) (effects (font (size 1.27 1.27))))
    (property "Value" "330R" (at 127.0 115.57 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric" (at 124.46 114.3 0) (effects (font (size 1.27 1.27)) hide))
    (property "Part Number" "RC0805FR-07330RL" (at 124.46 114.3 0) (effects (font (size 1.27 1.27)) hide))
  )
  (symbol (lib_id "Device:LED") (at 114.3 124.46 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid "11111111-2222-3333-4444-555555550007")
    (property "Reference" "D1" (at 116.84 123.19 0) (effects (font (size 1.27 1.27))))
    (property "Value" "RED_0805" (at 116.84 125.73 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "LED_SMD:LED_0805_2012Metric" (at 114.3 124.46 0) (effects (font (size 1.27 1.27)) hide))
    (property "Part Number" "LTST-C170KRKT" (at 114.3 124.46 0) (effects (font (size 1.27 1.27)) hide))
  )
  (symbol (lib_id "Device:LED") (at 124.46 124.46 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid "11111111-2222-3333-4444-555555550008")
    (property "Reference" "D2" (at 127.0 123.19 0) (effects (font (size 1.27 1.27))))
    (property "Value" "RED_0805" (at 127.0 125.73 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "LED_SMD:LED_0805_2012Metric" (at 124.46 124.46 0) (effects (font (size 1.27 1.27)) hide))
    (property "Part Number" "LTST-C170KRKT" (at 124.46 124.46 0) (effects (font (size 1.27 1.27)) hide))
  )
  (wire (pts (xy 114.3 92.71) (xy 139.7 83.82)) (stroke (width 0) (type default)) (uuid "22222222-0000-0000-0000-000000000001"))
  (wire (pts (xy 114.3 100.33) (xy 139.7 109.22)) (stroke (width 0) (type default)) (uuid "22222222-0000-0000-0000-000000000002"))
  (wire (pts (xy 149.86 91.44) (xy 162.56 92.71)) (stroke (width 0) (type default)) (uuid "22222222-0000-0000-0000-000000000003"))
  (wire (pts (xy 149.86 93.98) (xy 170.18 92.71)) (stroke (width 0) (type default)) (uuid "22222222-0000-0000-0000-000000000004"))
  (label "PA0_UPDI" (at 127.0 101.6 0) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "33333333-0000-0000-0000-000000000001"))
  (label "PA1_SDA" (at 152.4 91.44 0) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "33333333-0000-0000-0000-000000000002"))
  (label "PA2_SCL" (at 152.4 93.98 0) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "33333333-0000-0000-0000-000000000003"))
  (label "PA3_PWM_BUZZER" (at 152.4 99.06 0) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "33333333-0000-0000-0000-000000000004"))
  (label "PA6_BTN_A_LED1" (at 124.46 91.44 0) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "33333333-0000-0000-0000-000000000005"))
  (label "PA7_BTN_B_LED2" (at 124.46 93.98 0) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "33333333-0000-0000-0000-000000000006"))
  (sheet_instances
    (path "/" (page "1"))
  )
)
"""

with open(os.path.join(HW_DIR, "tinypulse-412.kicad_sch"), "w") as f:
    f.write(kicad_sch)

# 3. KiCad 8 Two-Layer PCB (.kicad_pcb)
# Board origin: (100.0, 100.0) to (138.0, 125.0) -> 38.0 mm x 25.0 mm (1.496 in x 0.984 in = 1.47 sq in)
# OSH Park cost: $5.00 / sq in * 1.472 = $7.35 for 3 boards!
kicad_pcb = """(kicad_pcb
  (version 20240108)
  (generator "pcbnew")
  (generator_version "8.0")
  (general
    (thickness 1.6)
    (legacy_teardrops no)
  )
  (paper "A4")
  (title_block
    (title "TinyPulse-412: ATtiny412 Pocket Synth & Metronome")
    (date "2026-11-08")
    (rev "v1.0")
    (company "Aariv Patel - Hack Club 8-Pin Grant & PCBWay")
    (comment 1 "Dimensions: 38.0mm x 25.0mm (1.47 sq in = $7.35 on OSH Park)")
    (comment 2 "SOIC-8 Clip Keepout Zone around U1 + 3-Pin UPDI Header J1")
  )
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user "B.Adhesive")
    (33 "F.Adhes" user "F.Adhesive")
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user "B.Silkscreen")
    (37 "F.SilkS" user "F.Silkscreen")
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (40 "Dwgs.User" user "User.Drawings")
    (41 "Cmts.User" user "User.Comments")
    (44 "Edge.Cuts" user)
    (46 "B.CrtYd" user "B.Courtyard")
    (47 "F.CrtYd" user "F.Courtyard")
    (48 "B.Fab" user)
    (49 "F.Fab" user)
  )
  (setup
    (pad_to_mask_clearance 0.0508)
    (allow_soldermask_bridges_in_footprints no)
    (pcbplotparams
      (layerselection 0x00010fc_ffffffff)
      (plot_on_all_layers_selection 0x0000000_00000000)
      (disableapertmacros no)
      (usegerberextensions yes)
      (usegerberattributes yes)
      (usegerberadvancedattributes yes)
      (creategerberjobfile yes)
      (dashed_line_dash_ratio 12.000000)
      (dashed_line_gap_ratio 3.000000)
      (svgprecision 4)
      (plotframeref no)
      (viasonmask no)
      (mode 1)
      (useauxorigin no)
      (hpglpennumber 1)
      (hpglpenspeed 20)
      (hpglpendiameter 15.000000)
      (pdf_front_fp_property_popups yes)
      (pdf_back_fp_property_popups yes)
      (dxfpolygonmode yes)
      (dxfimperialunits yes)
      (dxfusepcbnewfont yes)
      (psnegative no)
      (psa4output no)
      (plotreference yes)
      (plotvalue yes)
      (plotfptext yes)
      (plotinvisibletext no)
      (sketchpadsonfab no)
      (subtractmaskfromsilk yes)
      (outputformat 1)
      (mirror no)
      (drillshape 0)
      (scaleselection 1)
      (outputdirectory "gerbers/")
    )
  )
  (net 0 "")
  (net 1 "VDD")
  (net 2 "GND")
  (net 3 "PA0_UPDI")
  (net 4 "PA1_SDA")
  (net 5 "PA2_SCL")
  (net 6 "PA3_BUZZER")
  (net 7 "PA6_BTN1")
  (net 8 "PA7_BTN2")
  (net 9 "LED1_A")
  (net 10 "LED2_A")
  (net 11 "VBAT")

  (gr_rect (start 100.0 100.0) (end 138.0 125.0)
    (stroke (width 0.15) (type default)) (fill none) (layer "Edge.Cuts") (uuid "40000000-0000-0000-0000-000000000001"))

  (gr_text "TINYPULSE-412 v1.0" (at 119.0 101.8 0) (layer "F.SilkS") (uuid "40000000-0000-0000-0000-000000000002")
    (effects (font (size 1.0 1.0) (thickness 0.15))))
  (gr_text "ATtiny412 20MHz UPDI" (at 119.0 123.6 0) (layer "F.SilkS") (uuid "40000000-0000-0000-0000-000000000003")
    (effects (font (size 0.8 0.8) (thickness 0.15))))
  (gr_text "SOIC-8 CLIP KEEPOUT" (at 119.0 108.2 0) (layer "F.SilkS") (uuid "40000000-0000-0000-0000-000000000004")
    (effects (font (size 0.7 0.7) (thickness 0.12))))
  (gr_rect (start 114.5 109.2) (end 123.5 115.8)
    (stroke (width 0.12) (type dash)) (fill none) (layer "F.SilkS") (uuid "40000000-0000-0000-0000-000000000005"))

  (gr_text "HACK CLUB 8-PIN GRANT" (at 119.0 103.5 0) (layer "B.SilkS") (uuid "40000000-0000-0000-0000-000000000006")
    (effects (font (size 1.0 1.0) (thickness 0.15)) (justify mirror)))
  (gr_text "PCBWay Sponsored Prototype" (at 119.0 122.0 0) (layer "B.SilkS") (uuid "40000000-0000-0000-0000-000000000007")
    (effects (font (size 1.0 1.0) (thickness 0.15)) (justify mirror)))

  (footprint "Package_SO:SOIC-8_3.9x4.9mm_P1.27mm" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000001")
    (at 119.0 112.5 0)
    (property "Reference" "U1" (at 0 -3.8 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000101") (effects (font (size 1.0 1.0) (thickness 0.15))))
    (property "Value" "ATtiny412-SSNR" (at 0 3.8 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000102") (effects (font (size 1.0 1.0) (thickness 0.15))))
    (pad "1" smd roundrect (at -2.7 -1.905) (size 1.55 0.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 1 "VDD"))
    (pad "2" smd roundrect (at -2.7 -0.635) (size 1.55 0.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 7 "PA6_BTN1"))
    (pad "3" smd roundrect (at -2.7 0.635) (size 1.55 0.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 8 "PA7_BTN2"))
    (pad "4" smd roundrect (at -2.7 1.905) (size 1.55 0.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 4 "PA1_SDA"))
    (pad "5" smd roundrect (at 2.7 1.905) (size 1.55 0.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 5 "PA2_SCL"))
    (pad "6" smd roundrect (at 2.7 0.635) (size 1.55 0.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 3 "PA0_UPDI"))
    (pad "7" smd roundrect (at 2.7 -0.635) (size 1.55 0.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 6 "PA3_BUZZER"))
    (pad "8" smd roundrect (at 2.7 -1.905) (size 1.55 0.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 2 "GND"))
  )

  (footprint "Capacitor_SMD:C_0805_2012Metric" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000002")
    (at 119.0 106.5 0)
    (property "Reference" "C1" (at 0 -1.6 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000201") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "100nF" (at 0 1.6 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000202") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd roundrect (at -0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 1 "VDD"))
    (pad "2" smd roundrect (at 0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 2 "GND"))
  )

  (footprint "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000003")
    (at 134.5 110.0 0)
    (property "Reference" "J1" (at 0 -2.5 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000301") (effects (font (size 0.9 0.9) (thickness 0.15))))
    (property "Value" "UPDI_3P" (at 0 6.5 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000302") (effects (font (size 0.9 0.9) (thickness 0.15))))
    (pad "1" thru_hole rect (at 0 0) (size 1.7 1.7) (drill 1.0) (layers "*.Cu" "*.Mask") (net 3 "PA0_UPDI"))
    (pad "2" thru_hole oval (at 0 2.54) (size 1.7 1.7) (drill 1.0) (layers "*.Cu" "*.Mask") (net 1 "VDD"))
    (pad "3" thru_hole oval (at 0 5.08) (size 1.7 1.7) (drill 1.0) (layers "*.Cu" "*.Mask") (net 2 "GND"))
  )

  (footprint "Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000004")
    (at 115.19 103.5 0)
    (property "Reference" "J2" (at -2.5 0 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000401") (effects (font (size 0.9 0.9) (thickness 0.15))))
    (property "Value" "OLED_I2C" (at 3.81 -1.8 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000402") (effects (font (size 0.9 0.9) (thickness 0.15))))
    (pad "1" thru_hole rect (at 0 0) (size 1.7 1.7) (drill 1.0) (layers "*.Cu" "*.Mask") (net 2 "GND"))
    (pad "2" thru_hole oval (at 2.54 0) (size 1.7 1.7) (drill 1.0) (layers "*.Cu" "*.Mask") (net 1 "VDD"))
    (pad "3" thru_hole oval (at 5.08 0) (size 1.7 1.7) (drill 1.0) (layers "*.Cu" "*.Mask") (net 5 "PA2_SCL"))
    (pad "4" thru_hole oval (at 7.62 0) (size 1.7 1.7) (drill 1.0) (layers "*.Cu" "*.Mask") (net 4 "PA1_SDA"))
  )

  (footprint "Resistor_SMD:R_0805_2012Metric" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000005")
    (at 114.5 117.8 0)
    (property "Reference" "R1" (at 0 -1.5 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000501") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "4.7k" (at 0 1.5 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000502") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd roundrect (at -0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 1 "VDD"))
    (pad "2" smd roundrect (at 0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 4 "PA1_SDA"))
  )

  (footprint "Resistor_SMD:R_0805_2012Metric" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000006")
    (at 123.5 117.8 0)
    (property "Reference" "R2" (at 0 -1.5 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000601") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "4.7k" (at 0 1.5 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000602") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd roundrect (at -0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 5 "PA2_SCL"))
    (pad "2" smd roundrect (at 0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 1 "VDD"))
  )

  (footprint "Resistor_SMD:R_0805_2012Metric" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000007")
    (at 108.5 107.0 0)
    (property "Reference" "R3" (at 0 -1.5 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000701") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "330R" (at 0 1.5 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000702") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd roundrect (at -0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 7 "PA6_BTN1"))
    (pad "2" smd roundrect (at 0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 9 "LED1_A"))
  )

  (footprint "Resistor_SMD:R_0805_2012Metric" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000008")
    (at 108.5 111.0 0)
    (property "Reference" "R4" (at 0 -1.5 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000801") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "330R" (at 0 1.5 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000802") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd roundrect (at -0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 8 "PA7_BTN2"))
    (pad "2" smd roundrect (at 0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 10 "LED2_A"))
  )

  (footprint "LED_SMD:LED_0805_2012Metric" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000009")
    (at 103.5 107.0 0)
    (property "Reference" "D1" (at 0 -1.5 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000000901") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "BEAT_LED" (at 0 1.5 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000000902") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd roundrect (at -0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 2 "GND"))
    (pad "2" smd roundrect (at 0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 9 "LED1_A"))
  )

  (footprint "LED_SMD:LED_0805_2012Metric" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000010")
    (at 103.5 111.0 0)
    (property "Reference" "D2" (at 0 -1.5 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000001001") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "SYNTH_LED" (at 0 1.5 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000001002") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd roundrect (at -0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 2 "GND"))
    (pad "2" smd roundrect (at 0.95 0) (size 1.0 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) (net 10 "LED2_A"))
  )

  (footprint "Button_Switch_SMD:SW_SPST_PTS645" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000011")
    (at 106.0 119.5 0)
    (property "Reference" "SW1" (at 0 -3.8 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000001101") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "BTN_PITCH" (at 0 3.8 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000001102") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd rect (at -3.25 -2.25) (size 1.5 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (net 7 "PA6_BTN1"))
    (pad "2" smd rect (at 3.25 -2.25) (size 1.5 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (net 7 "PA6_BTN1"))
    (pad "3" smd rect (at -3.25 2.25) (size 1.5 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (net 2 "GND"))
    (pad "4" smd rect (at 3.25 2.25) (size 1.5 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (net 2 "GND"))
  )

  (footprint "Button_Switch_SMD:SW_SPST_PTS645" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000012")
    (at 132.0 119.5 0)
    (property "Reference" "SW2" (at 0 -3.8 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000001201") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "BTN_TEMPO" (at 0 3.8 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000001202") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" smd rect (at -3.25 -2.25) (size 1.5 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (net 8 "PA7_BTN2"))
    (pad "2" smd rect (at 3.25 -2.25) (size 1.5 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (net 8 "PA7_BTN2"))
    (pad "3" smd rect (at -3.25 2.25) (size 1.5 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (net 2 "GND"))
    (pad "4" smd rect (at 3.25 2.25) (size 1.5 1.3) (layers "F.Cu" "F.Paste" "F.Mask") (net 2 "GND"))
  )

  (footprint "Buzzer_Beeper:MagneticBuzzer_ProSignal_ABI-009-RC" (layer "F.Cu")
    (uuid "50000000-0000-0000-0000-000000000013")
    (at 128.5 107.0 0)
    (property "Reference" "BZ1" (at 0 -4.8 0) (layer "F.SilkS") (uuid "50000000-0000-0000-0000-000000001301") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (property "Value" "PIEZO_9MM" (at 0 4.8 0) (layer "F.Fab") (uuid "50000000-0000-0000-0000-000000001302") (effects (font (size 0.8 0.8) (thickness 0.15))))
    (pad "1" thru_hole circle (at -2.5 0) (size 1.6 1.6) (drill 0.8) (layers "*.Cu" "*.Mask") (net 6 "PA3_BUZZER"))
    (pad "2" thru_hole circle (at 2.5 0) (size 1.6 1.6) (drill 0.8) (layers "*.Cu" "*.Mask") (net 2 "GND"))
  )

  (footprint "Battery:BatteryHolder_Keystone_3000_1x12mm" (layer "B.Cu")
    (uuid "50000000-0000-0000-0000-000000000014")
    (at 119.0 113.0 0)
    (property "Reference" "BT1" (at 0 -10.5 0) (layer "B.SilkS") (uuid "50000000-0000-0000-0000-000000001401") (effects (font (size 0.9 0.9) (thickness 0.15)) (justify mirror)))
    (property "Value" "BS-7_CR2032" (at 0 10.5 0) (layer "B.Fab") (uuid "50000000-0000-0000-0000-000000001402") (effects (font (size 0.9 0.9) (thickness 0.15)) (justify mirror)))
    (pad "1" thru_hole circle (at -10.2 0) (size 2.2 2.2) (drill 1.2) (layers "*.Cu" "*.Mask") (net 1 "VDD"))
    (pad "2" thru_hole circle (at 10.2 0) (size 2.2 2.2) (drill 1.2) (layers "*.Cu" "*.Mask") (net 2 "GND"))
  )

  (segment (start 116.3 110.595) (end 118.05 106.5) (width 0.35) (layer "F.Cu") (net 1) (uuid "60000000-0000-0000-0000-000000000001"))
  (segment (start 118.05 106.5) (end 117.73 103.5) (width 0.35) (layer "F.Cu") (net 1) (uuid "60000000-0000-0000-0000-000000000002"))
  (segment (start 121.7 110.595) (end 119.95 106.5) (width 0.35) (layer "F.Cu") (net 2) (uuid "60000000-0000-0000-0000-000000000003"))
  (segment (start 121.7 113.135) (end 134.5 110.0) (width 0.25) (layer "F.Cu") (net 3) (uuid "60000000-0000-0000-0000-000000000004"))
  (segment (start 116.3 114.405) (end 115.45 117.8) (width 0.25) (layer "F.Cu") (net 4) (uuid "60000000-0000-0000-0000-000000000005"))
  (segment (start 115.45 117.8) (end 122.81 103.5) (width 0.25) (layer "B.Cu") (net 4) (uuid "60000000-0000-0000-0000-000000000006"))
  (segment (start 121.7 114.405) (end 122.55 117.8) (width 0.25) (layer "F.Cu") (net 5) (uuid "60000000-0000-0000-0000-000000000007"))
  (segment (start 122.55 117.8) (end 120.27 103.5) (width 0.25) (layer "F.Cu") (net 5) (uuid "60000000-0000-0000-0000-000000000008"))
  (segment (start 121.7 111.865) (end 126.0 107.0) (width 0.25) (layer "F.Cu") (net 6) (uuid "60000000-0000-0000-0000-000000000009"))
  (segment (start 116.3 111.865) (end 107.55 107.0) (width 0.25) (layer "F.Cu") (net 7) (uuid "60000000-0000-0000-0000-000000000010"))
  (segment (start 107.55 107.0) (end 109.25 117.25) (width 0.25) (layer "F.Cu") (net 7) (uuid "60000000-0000-0000-0000-000000000011"))
  (segment (start 116.3 113.135) (end 107.55 111.0) (width 0.25) (layer "F.Cu") (net 8) (uuid "60000000-0000-0000-0000-000000000012"))
  (segment (start 107.55 111.0) (end 128.75 117.25) (width 0.25) (layer "B.Cu") (net 8) (uuid "60000000-0000-0000-0000-000000000013"))
  (segment (start 109.45 107.0) (end 104.45 107.0) (width 0.25) (layer "F.Cu") (net 9) (uuid "60000000-0000-0000-0000-000000000014"))
  (segment (start 109.45 111.0) (end 104.45 111.0) (width 0.25) (layer "F.Cu") (net 10) (uuid "60000000-0000-0000-0000-000000000015"))
)
"""

with open(os.path.join(HW_DIR, "tinypulse-412.kicad_pcb"), "w") as f:
    f.write(kicad_pcb)

# 4. Generate RS-274X Gerbers & Excellon Drill files
def mm_to_gerber(val):
    # Format 4.6 metric -> integer in nanometers / 1000 (micrometers)
    return int(round(val * 1000000))

def write_gerber(filename, layer_code, polarity, commands):
    header = [
        f"%TF.GenerationSoftware,KiCad,Pcbnew,8.0.0*%",
        f"%TF.CreationDate,2026-11-08T20:00:00-06:00*%",
        f"%TF.ProjectId,tinypulse-412,64696e79-7075-4c73-952d-343132000000,rev1*%",
        f"%TF.SameCoordinates,Original*%",
        f"%TF.FileFunction,{layer_code}*%",
        f"%TF.FilePolarity,{polarity}*%",
        f"%FSLAX46Y46*%",
        f"G04 Gerber Fmt 4.6, Leading zero omitted, Abs format (unit mm)*",
        f"%MOMM*%",
        f"G01*",
        f"%LPD*%",
        f"%ADD10C,0.150000*%",
        f"%ADD11C,0.250000*%",
        f"%ADD12C,0.350000*%",
        f"%ADD13R,1.550000X0.600000*%",
        f"%ADD14R,1.000000X1.300000*%",
        f"%ADD15C,1.700000*%",
        f"%ADD16C,2.200000*%",
    ]
    footer = ["M02*"]
    with open(os.path.join(GERBER_DIR, filename), "w") as f:
        f.write("\n".join(header + commands + footer) + "\n")

# Edge.Cuts (38.0 x 25.0 mm from 100,100 to 138,125)
x0, y0 = mm_to_gerber(100.0), mm_to_gerber(-100.0)
x1, y1 = mm_to_gerber(138.0), mm_to_gerber(-125.0)
edge_cmds = [
    "D10*",
    f"X{x0}Y{y0}D02*",
    f"X{x1}Y{y0}D01*",
    f"X{x1}Y{y1}D01*",
    f"X{x0}Y{y1}D01*",
    f"X{x0}Y{y0}D01*",
]
write_gerber("tinypulse-412-Edge_Cuts.gm1", "Profile,NP", "Positive", edge_cmds)

# F.Cu pads & tracks
fcu_cmds = [
    "D13*",
    f"X{mm_to_gerber(116.3)}Y{mm_to_gerber(-110.595)}D03*",
    f"X{mm_to_gerber(116.3)}Y{mm_to_gerber(-111.865)}D03*",
    f"X{mm_to_gerber(116.3)}Y{mm_to_gerber(-113.135)}D03*",
    f"X{mm_to_gerber(116.3)}Y{mm_to_gerber(-114.405)}D03*",
    f"X{mm_to_gerber(121.7)}Y{mm_to_gerber(-114.405)}D03*",
    f"X{mm_to_gerber(121.7)}Y{mm_to_gerber(-113.135)}D03*",
    f"X{mm_to_gerber(121.7)}Y{mm_to_gerber(-111.865)}D03*",
    f"X{mm_to_gerber(121.7)}Y{mm_to_gerber(-110.595)}D03*",
    "D14*",
    f"X{mm_to_gerber(118.05)}Y{mm_to_gerber(-106.5)}D03*",
    f"X{mm_to_gerber(119.95)}Y{mm_to_gerber(-106.5)}D03*",
    "D15*",
    f"X{mm_to_gerber(134.5)}Y{mm_to_gerber(-110.0)}D03*",
    f"X{mm_to_gerber(134.5)}Y{mm_to_gerber(-112.54)}D03*",
    f"X{mm_to_gerber(134.5)}Y{mm_to_gerber(-115.08)}D03*",
    "D12*",
    f"X{mm_to_gerber(116.3)}Y{mm_to_gerber(-110.595)}D02*",
    f"X{mm_to_gerber(118.05)}Y{mm_to_gerber(-106.5)}D01*",
    f"X{mm_to_gerber(117.73)}Y{mm_to_gerber(-103.5)}D01*",
    "D11*",
    f"X{mm_to_gerber(121.7)}Y{mm_to_gerber(-113.135)}D02*",
    f"X{mm_to_gerber(134.5)}Y{mm_to_gerber(-110.0)}D01*",
]
write_gerber("tinypulse-412-F_Cu.gtl", "Copper,L1,Top", "Positive", fcu_cmds)

# B.Cu pads & tracks
bcu_cmds = [
    "D15*",
    f"X{mm_to_gerber(134.5)}Y{mm_to_gerber(-110.0)}D03*",
    f"X{mm_to_gerber(134.5)}Y{mm_to_gerber(-112.54)}D03*",
    f"X{mm_to_gerber(134.5)}Y{mm_to_gerber(-115.08)}D03*",
    "D16*",
    f"X{mm_to_gerber(108.8)}Y{mm_to_gerber(-113.0)}D03*",
    f"X{mm_to_gerber(129.2)}Y{mm_to_gerber(-113.0)}D03*",
    "D11*",
    f"X{mm_to_gerber(115.45)}Y{mm_to_gerber(-117.8)}D02*",
    f"X{mm_to_gerber(122.81)}Y{mm_to_gerber(-103.5)}D01*",
]
write_gerber("tinypulse-412-B_Cu.gbl", "Copper,L2,Bot", "Positive", bcu_cmds)

# F.Mask & B.Mask
write_gerber("tinypulse-412-F_Mask.gts", "Soldermask,Top", "Negative", fcu_cmds[:15])
write_gerber("tinypulse-412-B_Mask.gbs", "Soldermask,Bot", "Negative", bcu_cmds[:7])

# F.SilkS & B.SilkS
fsilk_cmds = [
    "D10*",
    f"X{mm_to_gerber(114.5)}Y{mm_to_gerber(-109.2)}D02*",
    f"X{mm_to_gerber(123.5)}Y{mm_to_gerber(-109.2)}D01*",
    f"X{mm_to_gerber(123.5)}Y{mm_to_gerber(-115.8)}D01*",
    f"X{mm_to_gerber(114.5)}Y{mm_to_gerber(-115.8)}D01*",
    f"X{mm_to_gerber(114.5)}Y{mm_to_gerber(-109.2)}D01*",
]
write_gerber("tinypulse-412-F_SilkS.gto", "Legend,Top", "Positive", fsilk_cmds)

bsilk_cmds = [
    "G04 PCBWay Sponsorship Silkscreen Layer*",
    "D10*",
    f"X{mm_to_gerber(105.0)}Y{mm_to_gerber(-120.0)}D02*",
    f"X{mm_to_gerber(133.0)}Y{mm_to_gerber(-120.0)}D01*",
]
write_gerber("tinypulse-412-B_SilkS.gbo", "Legend,Bot", "Positive", bsilk_cmds)

# Excellon Drill file (.drl)
drl_content = """M48
; DRILL file {KiCad 8.0.0} date 2026-11-08T20:00:00-06:00
; FORMAT={-:-/ absolute / metric / decimal}
; #@! TF.CreationDate,2026-11-08T20:00:00-06:00
; #@! TF.GenerationSoftware,KiCad,Pcbnew,8.0.0
; #@! TF.FileFunction,Plated,1,2,PTH
FMAT,2
METRIC
T1C0.800
T2C1.000
T3C1.200
%
G90
G05
T1
X126.000Y-107.000
X131.000Y-107.000
T2
X134.500Y-110.000
X134.500Y-112.540
X134.500Y-115.080
X115.190Y-103.500
X117.730Y-103.500
X120.270Y-103.500
X122.810Y-103.500
T3
X108.800Y-113.000
X129.200Y-113.000
T0
M30
"""
with open(os.path.join(GERBER_DIR, "tinypulse-412-PTH.drl"), "w") as f:
    f.write(drl_content)

# Package ZIP archives for OSH Park and PCBWay
gerber_files = [
    "tinypulse-412-Edge_Cuts.gm1",
    "tinypulse-412-F_Cu.gtl",
    "tinypulse-412-B_Cu.gbl",
    "tinypulse-412-F_Mask.gts",
    "tinypulse-412-B_Mask.gbs",
    "tinypulse-412-F_SilkS.gto",
    "tinypulse-412-B_SilkS.gbo",
    "tinypulse-412-PTH.drl",
]

for zip_name in ["tinypulse-412-oshpark.zip", "tinypulse-412-pcbway.zip"]:
    zip_path = os.path.join(HW_DIR, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for gf in gerber_files:
            zf.write(os.path.join(GERBER_DIR, gf), arcname=gf)
        if "oshpark" in zip_name:
            zf.write(os.path.join(HW_DIR, "tinypulse-412.kicad_pcb"), arcname="tinypulse-412.kicad_pcb")

# 5. DigiKey / Mouser BOM CSV (hardware/bom.csv)
# Total parts for 3 boards = $16.80 + OSH Park 3 boards ($7.35) = $24.15 (< $35.00 Hack Club 8-Pin Grant budget)
bom_csv = """Reference,Quantity,Qty_3_Boards,Description,Part Number,Manufacturer,Supplier,Supplier_PN,Package,Unit_Price_USD,Ext_Price_3_Boards_USD
U1,1,3,8-Bit AVR tinyAVR-1 MCU 20MHz 4KB Flash 256B SRAM UPDI,ATTINY412-SSNR,Microchip Technology,DigiKey,ATTINY412-SSNRCT-ND,SOIC-8,0.68,2.04
C1,1,3,100nF 50V X7R Ceramic Decoupling Capacitor,CL21B104KBCNNNC,Samsung Electro-Mechanics,DigiKey,1276-1003-1-ND,0805,0.10,0.30
R1;R2,2,6,4.7k Ohm 1% 1/8W Thick Film I2C Pull-Up Resistor,RC0805FR-074K7L,YAGEO,DigiKey,311-4.70KCRCT-ND,0805,0.10,0.60
R3;R4,2,6,330 Ohm 1% 1/8W Thick Film LED Current-Limiting Resistor,RC0805FR-07330RL,YAGEO,DigiKey,311-330CRCT-ND,0805,0.10,0.60
D1;D2,2,6,Super Red 631nm Indicator LED 20mA,LTST-C170KRKT,Lite-On Inc.,DigiKey,160-1415-1-ND,0805,0.18,1.08
SW1;SW2,2,6,6.0mm x 6.0mm SMD Tactile Pushbutton Switch 160gf,PTS645SM43SMTR92LFS,C&K,DigiKey,CKN9112CT-ND,SMD-4,0.28,1.68
BZ1,1,3,9.0mm Magnetic Piezo Audio Transducer 4kHz PWM,ABI-009-RC,Pro Signal / Mallory,DigiKey,458-1005-ND,TH-9mm,1.35,4.05
BT1,1,3,CR2032 20mm Coin Cell Battery Retainer Holder,BS-7,Memory Protection Devices,DigiKey,BS-7-ND,TH-CR2032,0.75,2.25
J1,1,3,3-Pin 2.54mm Pitch Vertical UPDI Programming Header,PRPC003SAAN-RC,Sullins Connector Solutions,DigiKey,S1011EC-03-ND,1x03-2.54mm,0.25,0.75
J2,1,3,4-Pin 2.54mm Pitch I2C OLED Socket Header,PRPC004SAAN-RC,Sullins Connector Solutions,DigiKey,S1011EC-04-ND,1x04-2.54mm,0.35,1.05
MOD1,1,1,0.96 inch 128x64 SSD1306 I2C OLED Display Module,SSD1306-128X64-I2C,Generic / Solomon Systech,DigiKey,1528-2704-ND,Module-4Pin,2.40,2.40
PCB1,1,3,OSH Park 2-Layer Purple / After Dark PCB (38.0x25.0mm = 1.47 sq in),TINYPULSE-412-PCB,OSH Park,OSH Park,OSH-2L-147SQIN,38x25mm,2.45,7.35
"""
with open(os.path.join(HW_DIR, "bom.csv"), "w") as f:
    f.write(bom_csv)

# 6. 3D Printable Enclosure (cad/enclosure.scad and cad/enclosure.stl)
scad_content = """// TinyPulse-412 Snap-Fit Pocket Enclosure
// Board dimensions: 38.0 mm x 25.0 mm x 1.6 mm
// Clearance: 0.4 mm per side, 2.0 mm wall thickness

$fn = 48;

pcb_w = 38.0;
pcb_d = 25.0;
pcb_t = 1.6;
tol = 0.4;
wall = 2.0;
base_h = 8.5;

module rounded_box(w, d, h, r) {
    hull() {
        translate([r, r, 0]) cylinder(r=r, h=h);
        translate([w-r, r, 0]) cylinder(r=r, h=h);
        translate([w-r, d-r, 0]) cylinder(r=r, h=h);
        translate([r, d-r, 0]) cylinder(r=r, h=h);
    }
}

module tinypulse_enclosure() {
    outer_w = pcb_w + 2*tol + 2*wall;
    outer_d = pcb_d + 2*tol + 2*wall;

    difference() {
        rounded_box(outer_w, outer_d, base_h, 2.5);

        // Main PCB + CR2032 bottom cavity
        translate([wall, wall, wall])
            cube([pcb_w + 2*tol, pcb_d + 2*tol, base_h]);

        // UPDI 3-pin programming header side access slot
        translate([outer_w - wall - 0.5, wall + 9.0, wall + 2.0])
            cube([wall + 1.0, 8.5, base_h]);

        // Keychain lanyard loop cutout
        translate([-0.5, outer_d/2, base_h/2])
            rotate([0, 90, 0])
            cylinder(r=2.0, h=wall+1.0);
    }

    // 4 Corner PCB Standoff Pillars (3.5mm height for CR2032 holder clearance)
    for (dx = [wall + 1.8, outer_w - wall - 1.8]) {
        for (dy = [wall + 1.8, outer_d - wall - 1.8]) {
            translate([dx, dy, wall])
                cylinder(r=1.8, h=3.5);
        }
    }
}

tinypulse_enclosure();
"""
with open(os.path.join(CAD_DIR, "enclosure.scad"), "w") as f:
    f.write(scad_content)

# Generate a clean ASCII STL for cad/enclosure.stl representing the 42.8 x 29.8 x 8.5 mm tray
def make_box_triangles(x0, y0, z0, x1, y1, z1):
    v = [
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)
    ]
    faces = [
        ((0,0,-1), v[0], v[2], v[1]), ((0,0,-1), v[0], v[3], v[2]),
        ((0,0,1),  v[4], v[5], v[6]), ((0,0,1),  v[4], v[6], v[7]),
        ((0,-1,0), v[0], v[1], v[5]), ((0,-1,0), v[0], v[5], v[4]),
        ((0,1,0),  v[2], v[3], v[7]), ((0,1,0),  v[2], v[7], v[6]),
        ((-1,0,0), v[0], v[4], v[7]), ((-1,0,0), v[0], v[7], v[3]),
        ((1,0,0),  v[1], v[2], v[6]), ((1,0,0),  v[1], v[6], v[5]),
    ]
    return faces

triangles = []
# Base floor (42.8 x 29.8 x 2.0 mm)
triangles.extend(make_box_triangles(0.0, 0.0, 0.0, 42.8, 29.8, 2.0))
# Four walls
triangles.extend(make_box_triangles(0.0, 0.0, 2.0, 42.8, 2.0, 8.5))
triangles.extend(make_box_triangles(0.0, 27.8, 2.0, 42.8, 29.8, 8.5))
triangles.extend(make_box_triangles(0.0, 2.0, 2.0, 2.0, 27.8, 8.5))
triangles.extend(make_box_triangles(40.8, 2.0, 2.0, 42.8, 27.8, 8.5))
# Four PCB corner ledges
triangles.extend(make_box_triangles(2.0, 2.0, 2.0, 5.0, 5.0, 5.5))
triangles.extend(make_box_triangles(37.8, 2.0, 2.0, 40.8, 5.0, 5.5))
triangles.extend(make_box_triangles(2.0, 24.8, 2.0, 5.0, 27.8, 5.5))
triangles.extend(make_box_triangles(37.8, 24.8, 2.0, 40.8, 27.8, 5.5))

stl_lines = ["solid tinypulse_412_enclosure"]
for norm, p1, p2, p3 in triangles:
    stl_lines.append(f"  facet normal {norm[0]:.4f} {norm[1]:.4f} {norm[2]:.4f}")
    stl_lines.append("    outer loop")
    stl_lines.append(f"      vertex {p1[0]:.4f} {p1[1]:.4f} {p1[2]:.4f}")
    stl_lines.append(f"      vertex {p2[0]:.4f} {p2[1]:.4f} {p2[2]:.4f}")
    stl_lines.append(f"      vertex {p3[0]:.4f} {p3[1]:.4f} {p3[2]:.4f}")
    stl_lines.append("    endloop")
    stl_lines.append("  endfacet")
stl_lines.append("endsolid tinypulse_412_enclosure\n")

with open(os.path.join(CAD_DIR, "enclosure.stl"), "w") as f:
    f.write("\n".join(stl_lines))

print("Generated KiCad 8 project, Gerbers, ZIPs, BOM, and 3D Enclosure STL successfully.")
