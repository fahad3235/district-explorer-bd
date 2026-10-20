# District Explorer BD

An offline, bilingual (English / Bangla) explorer of **Bangladesh's 64 districts** across its **8 divisions**. Zero network requests -- everything runs from static files in your browser.

## Problem

Remembering all 64 districts, which division each belongs to, and the official post-2018 English spellings (Chattogram, Cumilla, Jashore, Bogura, Barishal) is genuinely hard -- for students, job-exam (BCS/Bank) candidates, and anyone planning travel. This is a fast, honest reference tool for that.

## Features

- **All 64 districts**, grouped under the 8 divisions with per-division counts (6 / 11 / 13 / 10 / 4 / 8 / 8 / 4 = 64)
- **Bilingual EN/Bangla UI** with a persisted toggle; counts render in Bengali digits in Bangla mode
- **Search** across English names, Bangla names, and older English spellings (e.g. "Chittagong" still finds Chattogram)
- **Division filter chips** (All / Favorites / each division)
- **District detail view**: Bangla + English names, division, older spellings where applicable, and clickable division-mates for quick hopping
- **Favorites** saved to localStorage, with a typed-DELETE safety gate to clear them
- **Surprise me** button that opens a random district
- **100% offline**: zero HTTP requests; localStorage only
- Responsive down to 390px mobile; keyboard: `Esc` closes the dialog

## Stack

Plain HTML + CSS + vanilla JavaScript. No framework, no build step, no dependencies.

## Prerequisites

Any modern browser (or Node.js 18+ to run the tests).

## Install / run

```bash
# just open it
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Or serve statically (optional):

```bash
python3 -m http.server 8080
# open http://127.0.0.1:8080
```

## Dev commands

```bash
node tests/test-data.mjs        # 37 data/integrity unit checks
node tests/smoke.mjs            # 33 headless-Chrome desktop checks (raw CDP, no deps)
node tests/smoke.mjs mobile     # 35 headless-Chrome checks at 390px
```

The smoke tests spawn `/opt/meta-chromium/chrome` headless and drive the app over `file://`.

## Environment

None. No keys, no backend, no analytics.

## Testing

- `tests/test-data.mjs`: dataset integrity -- 8 divisions, 64 districts, exact per-division counts, name uniqueness (EN + Bangla), Bengali-script validation, official old-spelling pairs, i18n key parity, ASCII-source safety.
- `tests/smoke.mjs`: full UI flow -- rendering, search (English/Bangla/old spelling), empty state, division chips, modal, division-mate hopping, favorites + typed-DELETE guard, surprise, language toggle + persistence, zero network requests, zero console/page errors.

## Deployment

Any static host. For GitHub Pages: push to `main` and enable Pages (Deploy from a branch, `main` / root).

## Limitations

- Administrative data is a snapshot **as of October 2026** (sources: Wikipedia "Administrative geography of Bangladesh" and "Districts of Bangladesh", cross-checked 2026-10-20). Division/district boundaries and spellings can change by government decision; proposed divisions (e.g. Cumilla, Faridpur/Padma) are *not* included because they are not yet formed.
- Population, area, and upazila figures are intentionally omitted -- they change often and would go stale.
- Favorites live in the browser's localStorage; they do not sync across devices.

## Status

MVP complete and tested. Personal offline reference tool.
