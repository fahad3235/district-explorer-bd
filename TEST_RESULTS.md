# TEST_RESULTS.md -- district-explorer-bd (run #95, 11:00 slot, 2026-10-20)

## Unit tests -- 37/37 PASS (`node tests/test-data.mjs`)

- ASCII-source safety (5 files): js/data.js, js/app.js, js/i18n.js, css/style.css, index.html -- all pure ASCII
- 8 divisions; per-division counts 6/11/13/10/4/8/8/4; 64 districts total
- EN names unique (64/64); Bangla names unique (64/64), all in Bengali script range
- Official 2018 old-spelling pairs verified: Chattogram=Chittagong, Cumilla=Comilla,
  Jashore=Jessore, Bogura=Bogra, Barishal=Barisal; division old spellings Barisal, Chittagong
- i18n key parity EN<->BN; all BN strings non-empty and localized

Repairs: 2 test-side only -- (1) vm sandbox `const` exposure via globalThis (harness);
(2) BN runtime strings are real Bengali by design, so the "escaped ascii at runtime" check
was wrong and replaced with non-empty/localization checks.

## Headless-Chrome smoke (raw CDP, file://) -- 33/33 desktop, 35/35 mobile PASS

Hand-verified behaviors: search 'sylhet' -> exactly 1 card; Bengali search for Dhaka ->
1 card; old spelling 'chittagong' -> 1 card; no-match -> empty state; Dhaka chip ->
13 flat cards; modal shows district + old division spelling (Barisal) + 5 division mates;
mate click switches district; Escape closes; star -> fav count 1 + localStorage persisted;
wrong word does NOT clear favorites; 'DELETE' does; surprise opens modal with a real name;
BN toggle switches h1 to Bengali title + Bengali digits in stats + persists across toggle;
mobile 390px: no horizontal overflow, modal works.

Repairs: 1 test-side -- double-escaped `\\u` sequences in test-side comparisons (they never
traveled through Runtime.evaluate, so they needed single `\u`). 0 app-logic bugs found.

Console errors: 0. Page exceptions: 0. Network requests: 0.

## Publish

(pending at record time)
