# Tournament Report File Format Version 2016 (TRF16)

**Source:** https://www.fide.com/FIDE/handbook/C04Annex2_TRF16.pdf

_Format of Tournament Report File (TRF)_ _by Christian Krause (Torino, June
1st 2006) — Updated: Tromsø, August 13th 2014 — Approved: Elista, August 10th
2015_

Agreed general Data-Exchange Format for tournament results to be submitted to
FIDE.

---

**Remark 1** Each line shall have a "CR" (carriage return) as last character.

**Remark 2** The columns R and P in all the following tables tell the importance
of the field for Rating and Pairing respectively:

- ■ Mandatory
- □ Warning if wrong
- (blank) Not taken into account

---

## Player Section (`001` records)

| Position | Description                              | Contents                                                                                                                                                                                                                                    | R   | P   |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| 1–3      | Data Identification number               | `001` (for player-data)                                                                                                                                                                                                                     | ■   | ■   |
| 5–8      | Starting-rank number                     | 1 to 9999                                                                                                                                                                                                                                   | ■   | ■   |
| 10       | Sex                                      | `m` / `w`                                                                                                                                                                                                                                   | □   |     |
| 11–13    | Title                                    | `GM`, `IM`, `WGM`, `FM`, `WIM`, `CM`, `WFM`, `WCM`                                                                                                                                                                                          | □   |     |
| 15–47    | Name                                     | Lastname, Firstname                                                                                                                                                                                                                         | □   |     |
| 49–52    | FIDE Rating                              |                                                                                                                                                                                                                                             | □   |     |
| 54–56    | FIDE Federation                          |                                                                                                                                                                                                                                             | □   |     |
| 58–68    | FIDE Number (including 3 digits reserve) |                                                                                                                                                                                                                                             | ■   |     |
| 70–79    | Birth Date                               | Format: `YYYY/MM/DD`                                                                                                                                                                                                                        | □   |     |
| 81–84    | Points                                   | Format `11.5` — number of points in the tournament standings, depending on the scoring points system and the value of the pairing-allocated bye (usually same as a win). Example: in a 3/1/0 system with 5 wins, 2 draws, 2 losses → `17.0` |     | ■   |
| 86–89    | Rank                                     | Exact definition, especially for Team                                                                                                                                                                                                       | ■   |     |

### Round results (repeated per round)

For round 1 starting at position 92; round 2 at 102; round 3 at 112; and so on
(10 columns per round):

| Position (round 1) | Description                 | Contents                                                                                           | R   | P   |
| ------------------ | --------------------------- | -------------------------------------------------------------------------------------------------- | --- | --- |
| 92–95              | Player or forfeit id        | Starting-rank number of scheduled opponent; `0000` for bye/absent/not paired; four blanks ≡ `0000` | ■   | ■   |
| 97                 | Scheduled colour or forfeit | `w` / `b` scheduled colour; `-` bye or not paired; blank ≡ `-`                                     | ■   | ■   |
| 99                 | Result                      | See table below                                                                                    | ■   | ■   |

Result codes:

| Code    | Meaning                                        | Rated     |
| ------- | ---------------------------------------------- | --------- |
| `-`     | Forfeit loss                                   |           |
| `+`     | Forfeit win                                    |           |
| `W`     | Win (game lasted < 1 move)                     | Not rated |
| `D`     | Draw (game lasted < 1 move)                    | Not rated |
| `L`     | Loss (game lasted < 1 move)                    | Not rated |
| `1`     | Win                                            |           |
| `=`     | Draw                                           |           |
| `0`     | Loss                                           |           |
| `H`     | Half-point-bye                                 | Not rated |
| `F`     | Full-point-bye                                 | Not rated |
| `U`     | Pairing-allocated bye (at most once per round) | Not rated |
| `Z`     | Zero-point-bye (known absence from round)      | Not rated |
| (blank) | Equivalent to `Z`                              |           |

_Note: Letter codes are case-insensitive (i.e. `w`, `d`, `l`, `h`, `f`, `u`, `z`
can be used)._

---

## Tournament Section

Data-Identification-number (`??2` for tournament data):

| Tag   | Description                                                                     | R   | P   |
| ----- | ------------------------------------------------------------------------------- | --- | --- |
| `012` | Tournament Name                                                                 | ■   | ■   |
| `022` | City                                                                            | ■   |     |
| `032` | Federation                                                                      | ■   |     |
| `042` | Date of start                                                                   |     |     |
| `052` | Date of end                                                                     |     |     |
| `062` | Number of players                                                               |     |     |
| `072` | Number of rated players                                                         |     |     |
| `082` | Number of teams (in case of a team tournament)                                  |     |     |
| `092` | Type of tournament                                                              |     |     |
| `102` | Chief Arbiter                                                                   | ■   |     |
| `112` | Deputy Chief Arbiter (one line for each arbiter)                                |     |     |
| `122` | Allotted times per moves/game                                                   |     |     |
| `132` | Dates of the round (format: `YY/MM/DD`; pos. 92–99 round 1, 102–109 round 2, …) |     |     |

---

## Team Section (`013` records)

| Position              | Description             | Contents                                               | R   | P   |
| --------------------- | ----------------------- | ------------------------------------------------------ | --- | --- |
| 1–3                   | Team-Section-Identifier | `013` (for team data)                                  | ■   | ■   |
| 5–36                  | Team Name               |                                                        | ■   | ■   |
| 37–40                 | Team 1st player         | StartingRank Number from Player Section (position 5–8) | ■   | ■   |
| 42–45                 | Team 2nd player         |                                                        |     |     |
| 47–50                 | Team 3rd player         |                                                        |     |     |
| (continue, if needed) |                         |                                                        |     |     |
| 72–75                 | Team 8th player         |                                                        |     |     |
| (continue, if needed) |                         |                                                        |     |     |
| 102–105               | Team 14th player        |                                                        |     |     |
| (and so on)           |                         |                                                        |     |     |
