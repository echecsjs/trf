# Specification: FIDE Tournament Report File (TRF16)

Implements the TRF16 format as documented in the
[JaVaFo 2 AUM](https://www.rrweb.org/javafo/aum/JaVaFo2_AUM.htm).

---

## File Structure

One record per line. Records are identified by a 3-character tag at the start
of each line.

---

## Header Tags

| Tag | Field |
|-----|-------|
| `012` | Tournament name |
| `022` | City |
| `032` | Federation |
| `042` | Start date |
| `052` | End date |
| `062` | Number of players |
| `072` | Number of rated players |
| `082` | Number of teams |
| `092` | Chief arbiter |
| `102` | Deputy chief arbiter(s) |
| `112` | Time control |
| `122` | Round dates |
| `XXR` | Number of rounds (integer after tag) |
| `XXC` | Initial color for player 1 (`white1` or `black1`) |

---

## Player Record (`001`)

Column layout (0-indexed):

| Columns | Field |
|---------|-------|
| 0–2 | Record type (`001`) |
| 4–7 | Pairing number (right-justified) |
| 9 | Sex (`m` = male, `w` = female) |
| 10–13 | FIDE title |
| 14–46 | Player name (left-justified) |
| 48–51 | FIDE rating |
| 53–55 | Federation (3-letter code) |
| 57–68 | FIDE player ID |
| 70–79 | Date of birth |
| 80–83 | Points |
| 84–88 | Rank |
| 91+ | Round results (10 chars each) |

### Round Result Entry (10 characters)

Format: `   O c r  ` where:
- `O` = opponent pairing number (4 chars, right-justified; `0000` = bye)
- `c` = color (`w` = white, `b` = black, `-` = no game)
- `r` = result code

---

## Result Codes

| Code | Meaning |
|------|---------|
| `1` | Win |
| `0` | Loss |
| `=` | Draw |
| `+` | Forfeit win |
| `-` | Forfeit loss |
| `F` | Full-point bye |
| `H` | Half-point bye |
| `U` | Unplayed (not yet paired) |
| `Z` | Zero-point bye |

---

## FIDE Titles

Standard values: `GM`, `WGM`, `IM`, `WIM`, `FM`, `WFM`, `CM`, `WCM`.

JaVaFo legacy single-letter codes (pre-TRF16): `g` = GM, `m` = IM, `f` = FM,
`w` = WIM — mapped automatically by this implementation.

---

## Version

This implementation targets **TRF16** (2016). A future TRF26 extension is
acknowledged but the spec has not been published; all files are treated as
TRF16 (`version: 'TRF16'`).

---

## Implementation Notes

- `parse(input, options?)` — default export, never throws, returns
  `Tournament | null`
- Rating `0` is treated as unrated (`undefined`) per JaVaFo convention
- Unknown tag codes emit `onWarning` but do not abort parsing
- `stringify()` not yet implemented (deferred to v2)

## Sources

- [JaVaFo 2 AUM — TRF Format](https://www.rrweb.org/javafo/aum/JaVaFo2_AUM.htm)
- [bbpPairings test fixtures](https://github.com/BieremaBoyzProgramming/bbpPairings) (Apache 2.0)
