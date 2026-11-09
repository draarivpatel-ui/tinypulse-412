// TinyPulse-412 Snap-Fit Pocket Enclosure
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
