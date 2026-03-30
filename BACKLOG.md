# Backlog

Last updated: 2026-03-30

## Low

- [ ] Tag 222 — Encoded time control. Machine-parseable alternative to tag 122
      (free-form). Not used by any pairing engine yet.
- [ ] Tag 172 — Encoded starting rank method. Required when NRS records are
      present. Not used by any pairing engine yet.
- [ ] Tag 352 — Colour sequence for team tournaments (`WBWBWB` pattern). Not
      used by any pairing engine yet.
- [ ] Tag 362 — Scoring point system for teams (TW/TD/TL match points). Not used
      by any pairing engine yet.
- [ ] Records 801/802 — Informative team round-by-round results. Considered
      redundant with 310 records. Not used by any pairing engine.
- [ ] TRFx extensions — JaVaFo XX-prefixed tags (`XXS`, `XXA`, `XXP`, `XXZ`).
      The library already supports their TRF26 equivalents (162, 250, 260, 240).
      `XXC` is recognised but its value is not used. Adding full TRFx support
      would improve backward compatibility with older JaVaFo-generated files.
