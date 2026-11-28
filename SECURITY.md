# Security policy

## Reporting a vulnerability

Use the private GitHub Security Advisory form at [Report a vulnerability](https://github.com/draarivpatel-ui/tinypulse-412/security/advisories/new). Do not open a public issue, pull request or discussion with exploit details.

Never include a live secret, token, cookie, private key, victim hostname, customer data or personal data in a report. Use synthetic values and redacted transcripts.

## Supported versions

| Version | Status |
| --- | --- |
| latest `main` | Supported |

Security fixes are applied to the latest state of the default branch.

## Scope

This policy covers the static TinyPulse browser workbench, ATtiny412 firmware source, generated hardware artifacts, fabrication archives, test harnesses and project documentation.

In scope:

- A cross-site scripting or HTML injection path through board data, bill of materials data, firmware metadata, bookmarked state or generated output.
- A download or file-path handling flaw that turns a fabrication archive or repository artifact link into a script execution or cross-origin navigation vector.
- A validation flaw that makes corrupted firmware, PCB, schematic, Gerber, drill, BOM or CAD data appear verified when it is not.
- A generator, test harness or export flaw that executes attacker-controlled code outside the documented build and test boundary.
- A browser persistence or state decoding flaw that corrupts another user's workbench state or executes attacker-controlled code.

Out of scope:

- Physical attacks, modified probes, electromagnetic fault injection or laboratory equipment misuse.
- Fabrication defects introduced by a board house after the repository artifacts leave this project.
- Browser vulnerabilities, operating system compromise or physical access to the machine.
- Vulnerabilities in external KiCad, Arduino, browser, CAD or fabrication software that are not caused by this repository.
- The documented fact that the board and browser workbench are educational design artifacts rather than certified electrical safety equipment.

## Coordinated disclosure

- Acknowledgment: within 3 business days.
- Initial triage: within 14 calendar days.
- Fix or mitigation target: within 90 calendar days for confirmed reports.
- Coordinated public disclosure: up to 90 days by default, adjusted by mutual agreement when exploitation or user risk requires a different date.
