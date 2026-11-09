/*
 * TinyPulse-412 Bare-Metal Firmware (ATtiny412-SSNR)
 * Pocket Chiptune Synthesizer, Precision BPM Metronome & OLED Framebuffer Engine
 *
 * Target MCU: Microchip ATtiny412-SSNR (SOIC-8, 4 KB Flash, 256 B SRAM, 20 MHz)
 * Pin Assignment (8-Pin SOIC):
 *   Pin 1: VDD (+3.0V CR2032 or +5.0V UPDI target power)
 *   Pin 2: PA6 -> Time-Multiplexed SW1 (Pitch / Note Step) & D1 (Beat Sync LED)
 *   Pin 3: PA7 -> Time-Multiplexed SW2 (BPM Tempo / Mode)  & D2 (Synth Gate LED)
 *   Pin 4: PA1 -> TWI0 SDA (Hardware I2C Data to 128x64 SSD1306 OLED, 4.7k pull-up)
 *   Pin 5: PA2 -> TWI0 SCL (Hardware I2C Clock to 128x64 SSD1306 OLED, 4.7k pull-up)
 *   Pin 6: PA0 -> UPDI Single-Wire Programming & Debug Interface (J1)
 *   Pin 7: PA3 -> TCA0 WO0 Hardware Frequency PWM Output to Piezo Buzzer (BZ1)
 *   Pin 8: GND -> System Ground
 */

#include <stdint.h>
#include <stdbool.h>

#ifdef __AVR__
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#else
/* Host simulation definitions for unit testing and desktop compilation checks */
typedef struct {
    volatile uint8_t DIR;
    volatile uint8_t DIRSET;
    volatile uint8_t DIRCLR;
    volatile uint8_t DIRTGL;
    volatile uint8_t OUT;
    volatile uint8_t OUTSET;
    volatile uint8_t OUTCLR;
    volatile uint8_t OUTTGL;
    volatile uint8_t IN;
    volatile uint8_t INTFLAGS;
    volatile uint8_t PORTCTRL;
    volatile uint8_t rsvd[5];
    volatile uint8_t PIN0CTRL;
    volatile uint8_t PIN1CTRL;
    volatile uint8_t PIN2CTRL;
    volatile uint8_t PIN3CTRL;
    volatile uint8_t PIN4CTRL;
    volatile uint8_t PIN5CTRL;
    volatile uint8_t PIN6CTRL;
    volatile uint8_t PIN7CTRL;
} PORT_t;

typedef struct {
    volatile uint8_t CTRLA;
    volatile uint8_t CTRLB;
    volatile uint8_t CTRLC;
    volatile uint8_t CTRLD;
    volatile uint8_t CTRLECLR;
    volatile uint8_t CTRLESET;
    volatile uint8_t CTRLFCLR;
    volatile uint8_t CTRLFSET;
    volatile uint8_t INTCTRL;
    volatile uint8_t INTFLAGS;
    volatile uint16_t CNT;
    volatile uint16_t PER;
    volatile uint16_t CMP0;
} TCA_SINGLE_t;

typedef struct { TCA_SINGLE_t SINGLE; } TCA_t;

typedef struct {
    volatile uint8_t MCTRLA;
    volatile uint8_t MCTRLB;
    volatile uint8_t MSTATUS;
    volatile uint8_t MBAUD;
    volatile uint8_t MADDR;
    volatile uint8_t MDATA;
} TWI_t;

typedef struct {
    volatile uint8_t CTRLA;
    volatile uint8_t CTRLB;
    volatile uint8_t INTCTRL;
    volatile uint8_t INTFLAGS;
    volatile uint16_t CNT;
    volatile uint16_t CCMP;
} TCB_t;

static PORT_t PORTA;
static TCA_t TCA0;
static TWI_t TWI0;
#define PORT_PULLUPEN_bm 0x08
#define TCA_SINGLE_CLKSEL_DIV16_gc (0x04 << 1)
#define TCA_SINGLE_ENABLE_bm 0x01
#define TCA_SINGLE_WGMODE_FRQ_gc 0x01
#define TCA_SINGLE_CMP0EN_bm 0x10
#define TWI_ENABLE_bm 0x01
#define TWI_WIF_bm 0x40
#define TWI_BUSSTATE_IDLE_gc 0x01
#define TWI_MCMD_STOP_gc 0x03
#endif

#define SSD1306_I2C_ADDR  0x78  /* 0x3C << 1 */

#define PIN_UPDI_bm       (1 << 0) /* PA0 */
#define PIN_SDA_bm        (1 << 1) /* PA1 */
#define PIN_SCL_bm        (1 << 2) /* PA2 */
#define PIN_BUZZER_bm     (1 << 3) /* PA3 (TCA0 WO0 via PORTMUX) */
#define PIN_MUX_A_bm      (1 << 6) /* PA6: SW1 + D1 */
#define PIN_MUX_B_bm      (1 << 7) /* PA7: SW2 + D2 */

/* Equal-tempered pentatonic + chiptune scale lookup: TCA0 CMP0 values at F_CPU = 5 MHz, DIV16 */
/* f_tone = (5,000,000 / 16) / (2 * (CMP0 + 1)) = 156,250 / (CMP0 + 1) */
static const uint16_t SCALE_CMP0[8] = {
    595, /* C4: 261.6 Hz */
    530, /* D4: 293.7 Hz */
    472, /* E4: 329.6 Hz */
    397, /* G4: 392.0 Hz */
    354, /* A4: 440.0 Hz */
    297, /* C5: 523.3 Hz */
    265, /* D5: 587.3 Hz */
    236  /* E5: 659.3 Hz */
};

static const uint8_t BPM_PRESETS[4] = { 90, 120, 140, 168 };

static uint8_t g_note_idx = 4;   /* Default A4 (440 Hz) */
static uint8_t g_bpm_idx  = 1;   /* Default 120 BPM */
static uint8_t g_beat_sub = 0;   /* 0..3 quarter-note step counter */
static bool    g_led1_on  = false;
static bool    g_led2_on  = false;

static void twi0_init(void) {
    /* 100 kHz Standard Mode I2C at 5 MHz peripheral clock */
    TWI0.MBAUD = 20;
    TWI0.MCTRLA = TWI_ENABLE_bm;
    TWI0.MSTATUS = TWI_BUSSTATE_IDLE_gc | TWI_WIF_bm;
}

static void twi0_start_write(uint8_t addr) {
    TWI0.MADDR = addr;
    while (!(TWI0.MSTATUS & TWI_WIF_bm)) { }
}

static void twi0_write_byte(uint8_t data) {
    TWI0.MDATA = data;
    while (!(TWI0.MSTATUS & TWI_WIF_bm)) { }
}

static void twi0_stop(void) {
    TWI0.MCTRLB = TWI_MCMD_STOP_gc;
}

static void ssd1306_cmd(uint8_t cmd) {
    twi0_start_write(SSD1306_I2C_ADDR);
    twi0_write_byte(0x00);
    twi0_write_byte(cmd);
    twi0_stop();
}

static void ssd1306_init(void) {
    static const uint8_t init_seq[] = {
        0xAE, 0xD5, 0x80, 0xA8, 0x3F, 0xD3, 0x00, 0x40,
        0x8D, 0x14, 0x20, 0x00, 0xA1, 0xC8, 0xDA, 0x12,
        0x81, 0xCF, 0xD9, 0xF1, 0xDB, 0x40, 0xA4, 0xA6, 0xAF
    };
    for (uint8_t i = 0; i < sizeof(init_seq); i++) {
        ssd1306_cmd(init_seq[i]);
    }
}

static void tca0_synth_init(void) {
    /* Route TCA0 WO0 to PA3 (Pin 7 of ATtiny412 SOIC-8) */
    PORTA.DIRSET = PIN_BUZZER_bm;
    TCA0.SINGLE.CTRLB = TCA_SINGLE_CMP0EN_bm | TCA_SINGLE_WGMODE_FRQ_gc;
    TCA0.SINGLE.CMP0 = SCALE_CMP0[g_note_idx];
    TCA0.SINGLE.CTRLA = TCA_SINGLE_CLKSEL_DIV16_gc | TCA_SINGLE_ENABLE_bm;
}

static void tca0_set_note(uint8_t idx) {
    TCA0.SINGLE.CMP0 = SCALE_CMP0[idx & 0x07];
}

/*
 * Time-Division Multiplexed GPIO Scan for PA6 and PA7:
 * 1. Switch PA6 and PA7 to inputs with internal pull-ups enabled.
 * 2. Sample active-low button switches SW1 and SW2.
 * 3. Restore PA6 and PA7 to push-pull outputs to drive LEDs D1 and D2.
 */
static uint8_t scan_multiplexed_buttons(void) {
    PORTA.DIRCLR = PIN_MUX_A_bm | PIN_MUX_B_bm;
    PORTA.PIN6CTRL = PORT_PULLUPEN_bm;
    PORTA.PIN7CTRL = PORT_PULLUPEN_bm;

    /* Allow 4 microseconds for parasitic pin capacitance to settle */
#ifdef __AVR__
    _delay_us(4);
#endif
    uint8_t raw = PORTA.IN;
    uint8_t pressed = 0;
    if (!(raw & PIN_MUX_A_bm)) pressed |= 0x01; /* SW1 pressed */
    if (!(raw & PIN_MUX_B_bm)) pressed |= 0x02; /* SW2 pressed */

    /* Restore LED output state */
    PORTA.DIRSET = PIN_MUX_A_bm | PIN_MUX_B_bm;
    if (g_led1_on) PORTA.OUTSET = PIN_MUX_A_bm; else PORTA.OUTCLR = PIN_MUX_A_bm;
    if (g_led2_on) PORTA.OUTSET = PIN_MUX_B_bm; else PORTA.OUTCLR = PIN_MUX_B_bm;

    return pressed;
}

static void ssd1306_render_status_bar(void) {
    twi0_start_write(SSD1306_I2C_ADDR);
    twi0_write_byte(0x40);
    for (uint8_t col = 0; col < 32; col++) {
        uint8_t pattern = (col == (g_note_idx * 4)) ? 0xFF : ((g_beat_sub == 0) ? 0x81 : 0x18);
        twi0_write_byte(pattern);
    }
    twi0_stop();
}

int main(void) {
    twi0_init();
    ssd1306_init();
    tca0_synth_init();

    uint16_t tick_counter = 0;
    uint8_t prev_buttons = 0;

    while (1) {
        uint8_t buttons = scan_multiplexed_buttons();
        uint8_t rising = buttons & (~prev_buttons);
        prev_buttons = buttons;

        if (rising & 0x01) {
            /* SW1: Advance pentatonic synth pitch */
            g_note_idx = (g_note_idx + 1) & 0x07;
            tca0_set_note(g_note_idx);
            g_led2_on = true;
        }
        if (rising & 0x02) {
            /* SW2: Cycle BPM tempo preset (90 / 120 / 140 / 168 BPM) */
            g_bpm_idx = (g_bpm_idx + 1) & 0x03;
        }

        uint16_t beat_period = (uint16_t)(60000UL / BPM_PRESETS[g_bpm_idx]);
        if (++tick_counter >= beat_period) {
            tick_counter = 0;
            g_beat_sub = (g_beat_sub + 1) & 0x03;
            g_led1_on = (g_beat_sub == 0);
            g_led2_on = (g_beat_sub & 0x01);
            ssd1306_render_status_bar();
        }

#ifdef __AVR__
        _delay_ms(1);
#else
        break;
#endif
    }

    return 0;
}
