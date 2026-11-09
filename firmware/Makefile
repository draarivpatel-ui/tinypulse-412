# TinyPulse-412 Bare-Metal ATtiny412 Makefile
MCU       = attiny412
F_CPU     = 5000000UL
CC        = avr-gcc
OBJCOPY   = avr-objcopy
SIZE      = avr-size
UPDI_PORT = /dev/ttyUSB0

CFLAGS    = -mmcu=$(MCU) -DF_CPU=$(F_CPU) -Os -Wall -Wextra -std=c11 -ffunction-sections -fdata-sections
LDFLAGS   = -mmcu=$(MCU) -Wl,--gc-sections

TARGET    = tinypulse-412

all: $(TARGET).hex size

$(TARGET).elf: main.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)

$(TARGET).hex: $(TARGET).elf
	$(OBJCOPY) -O ihex -R .eeprom $< $@

size: $(TARGET).elf
	$(SIZE) --format=avr --mcu=$(MCU) $(TARGET).elf

flash: $(TARGET).hex
	pymcuprog write -d $(MCU) -t uart -u $(UPDI_PORT) -f $(TARGET).hex --erase --verify

clean:
	rm -f $(TARGET).elf $(TARGET).hex
