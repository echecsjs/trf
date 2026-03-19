# Tournament Report File Format Version 2026 (TRF26)

**Source:** https://handbook.fide.com/files/handbook/TRF26.pdf

**Approved by FIDE Council on 12/05/2025 — Applied from 01/09/2025**

_Format of Tournament Report File (TRF) — Version 2026_ _by Christian Krause
(Torino, June 1st 2006)_

Agreed general Data-Exchange Format for tournament results to be submitted to
FIDE, for testing pairing and tie-break programs, and for in-tournament data
exchange.

---

**Remark 1** Each line shall have a "CR" (carriage return) as last character.
Comment lines are allowed as long as the first three characters of the line are
`###` (triple pound sign).

**Remark 2** The columns R and P in all the following tables tell the importance
of the field for Rating and Pairing (plus tie-breaks) respectively:

- ■ Mandatory
- ◙ (mandatory for title events)
- □ Warning if wrong
- (blank) Not taken into account

**Remark 3** In-tournament Data Exchange (ITDX) is the ability to use the TRF to
exchange tournament data among Tournament Handler Programs (THPs) and between
THPs and Pairing Engines during the tournament.

---

## Tournament Section

Data-Identification-number (`??2` for tournament data)

| Tag   | Description                                                                                                                                                                                 | R   | P   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| `012` | Tournament Name                                                                                                                                                                             | ■   | ■   |
| `022` | City                                                                                                                                                                                        | ■   |     |
| `032` | Federation                                                                                                                                                                                  | ■   |     |
| `042` | Date of start — format: `YYYY/MM/DD`                                                                                                                                                        | ■   |     |
| `052` | Date of end — format: `YYYY/MM/DD`                                                                                                                                                          | ■   |     |
| `062` | Number of players                                                                                                                                                                           |     |     |
| `072` | Number of rated players                                                                                                                                                                     |     |     |
| `082` | Number of teams (in case of a team tournament)                                                                                                                                              |     |     |
| `092` | Type of tournament                                                                                                                                                                          |     |     |
| `102` | Chief Arbiter                                                                                                                                                                               | ■   |     |
| `112` | Deputy Chief Arbiter (one line for each arbiter)                                                                                                                                            |     |     |
| `122` | Allotted times per moves/game                                                                                                                                                               |     |     |
| `132` | Dates of the round (format: `YY/MM/DD`; pos. 92–99 round 1, 102–109 round 2, … )                                                                                                            | ■   |     |
| `142` | Number of rounds — mandatory only for ITDX                                                                                                                                                  |     |     |
| `152` | Initial-colour (`W` or `B`; mandatory only if it differs from the colour of the highest ranked participant who was paired in the first round, or for ITDX before the first round is paired) |     |     |

### Tag 162 — Scoring point system for individuals

Defines the point distribution in individual games (valid also for game points
in team competitions). Mandatory only when the elements differ from the default
values.

| Position    | Description                            |
| ----------- | -------------------------------------- |
| 6           | One of `W`, `D`, `L`, `A`, `P`, `X`    |
| 7–10        | Points for that result (format `11.5`) |
| 15          | (optional) Another result code         |
| 16–19       | Points for position-15 result          |
| 24          | (optional) Another result code         |
| 25–28       | Points for position-24 result          |
| (and so on) |                                        |

Result codes and defaults:

| Symbol | Result                                   | Default   |
| ------ | ---------------------------------------- | --------- |
| `W`    | Win OTB or by forfeit, or full-point-bye | 1.0       |
| `D`    | Draw OTB or half-point-bye               | 0.5       |
| `L`    | Loss OTB                                 | 0.0       |
| `A`    | Absence (zero-point-bye or forfeit loss) | 0.0       |
| `P`    | Pairing-allocated-bye                    | same as W |
| `X`    | Unknown result (e.g. adjourned game)     | same as D |

### Tag 172 — Encoded Starting Rank Method

Mandatory only if there are National Rating Support (NRS) records.

| Position | Description                 |
| -------- | --------------------------- |
| 5–7      | FIDE code of the federation |
| 9–13     | Coded ranking method        |

Ranking method codes:

| Code    | Meaning                                           |
| ------- | ------------------------------------------------- |
| `FIDE`  | FIDE rating only                                  |
| `NRO`   | National Rating only                              |
| `FIDON` | FIDE rating if defined, otherwise National Rating |
| `NIDOF` | National rating if defined, otherwise FIDE rating |
| `HBFN`  | Highest between FIDE and National Rating          |
| `LBFN`  | Lowest between FIDE and National Rating           |
| `OTHER` | Any other uncodified ranking method               |

### Other tournament tags

| Tag   | Description                                                                                  | R   | P   |
| ----- | -------------------------------------------------------------------------------------------- | --- | --- |
| `182` | Pairing Controller Identifier — name/ID of the program or user making the pairings           | ◙   |     |
| `192` | Encoded Type Of Tournament — coded value from Tournament-Type Code Table                     | ◙   | ■   |
| `202` | FIDE Tie-Breaks used to break ties — comma-separated list of codes from Mandatory Tie-Breaks | ◙   | ■   |
| `212` | FIDE Tie-Breaks used to define standings — like 202 plus `PTS` code                          |     |     |

### Tag 222 — Encoded Time Control

```
d[:d]
Wd[:d]-Bd[:d]
```

Where `d` is a Time Period Descriptor:

- `(std)` → `M/S`
- `(full)` → `M/S+I`
- `(all)` → `S`
- `(inc)` → `S+I`

`S` = seconds allocated, `M` = moves in the period, `I` = seconds added per
move.

Examples:

- `90'+30"` → `5400+30`
- `100'×40+15'+30" from move 1` → `40/6000+30:900+30`
- Armageddon (White 5', Black 4') → `W300-B240`

### Team tournament tags

| Tag   | Description                                                                      | R   | P   |
| ----- | -------------------------------------------------------------------------------- | --- | --- |
| `352` | Colour sequence (`W` or `B`) for boards in team competitions (example: `WBWBWB`) |     | ■   |

### Tag 362 — Scoring point system for teams

Defines distribution of match points. Mandatory only when values differ from
defaults.

| Symbol | Result    | Default |
| ------ | --------- | ------- |
| `TW`   | Team Win  | 2.0     |
| `TD`   | Team Draw | 1.0     |
| `TL`   | Team Loss | 0.0     |

---

## Player Section (`001` records)

| Position | Description                              | Contents                                           | R   | P   |
| -------- | ---------------------------------------- | -------------------------------------------------- | --- | --- |
| 1–3      | Data Identification number               | `001`                                              | ■   | ■   |
| 5–8      | Starting-rank number                     | 1 to 9999                                          | ■   | ■   |
| 10       | Sex                                      | `m` / `w`                                          | □   |     |
| 11–13    | Title                                    | `GM`, `IM`, `WGM`, `FM`, `WIM`, `CM`, `WFM`, `WCM` | □   |     |
| 15–47    | Name                                     | Lastname, Firstname                                | □   |     |
| 49–52    | FIDE Rating                              |                                                    | □   |     |
| 54–56    | FIDE Federation                          |                                                    | □   |     |
| 58–68    | FIDE Number (including 3 digits reserve) |                                                    | ■   |     |
| 70–79    | Birth Date                               | `YYYY/MM/DD`                                       | □   |     |
| 81–84    | Points                                   | Format `11.5`                                      |     | ■   |
| 86–89    | Rank                                     | Exact definition — ties allowed                    | ■   | ■   |

### Round results (repeated per round)

For round 1 starting at position 92; round 2 at 102; round 3 at 112; and so on
(10 columns per round):

| Position (round 1) | Description                 | Contents                                                                                            | R   | P   |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------------------------- | --- | --- |
| 92–95              | Player or forfeit id        | Starting-rank number of scheduled opponent; `0000` for bye/absent; four blanks equivalent to `0000` | ■   | ■   |
| 97                 | Scheduled colour or forfeit | `w` / `b` / `-` (bye or not paired) / blank (≡ `-`)                                                 | ■   | ■   |
| 99                 | Result                      | See table below                                                                                     | ■   | ■   |

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
| `Z`     | Zero-point-bye (known absence)                 | Not rated |
| (blank) | Equivalent to `Z`                              |           |

_Note: Letter codes are case-insensitive._

---

## National Rating Support (NRS) records

Same column structure as `001` (static part), introduced by a 3-letter
federation code instead of `001`.

| Position | Description             | Contents                                        | R   | P   |
| -------- | ----------------------- | ----------------------------------------------- | --- | --- |
| 1–3      | Rating Federation       | 3-letter FIDE Code                              |     | ■   |
| 5–8      | Starting-rank number    | Links to the corresponding `001` record         |     | ■   |
| 10       | National Sex            | Optional if same as `001`                       |     |     |
| 11–13    | National Classification |                                                 |     |     |
| 15–47    | National Name           | Optional if same as `001`                       |     |     |
| 49–52    | National Rating         |                                                 |     | ■   |
| 54–56    | National Origin         | Federation, nation, state, region, county, etc. |     |     |
| 58–68    | National Number         |                                                 |     |     |
| 70–79    | Birth Date              | Optional if same as `001`                       |     |     |

---

## Team Section

### Record `013` (to be phased out)

Defines registration order and board order when board order is fixed.

| Position | Description             | Contents                                | R   | P   |
| -------- | ----------------------- | --------------------------------------- | --- | --- |
| 1–3      | Team-Section-Identifier | `013`                                   | ■   | ■   |
| 5–36     | Team Name               |                                         | ■   | ■   |
| 37–40    | Team 1st player         | StartingRank Number from Player Section | ■   | ■   |
| 42–45    | Team 2nd player         |                                         |     |     |
| 47–50    | Team 3rd player         |                                         |     |     |
| …        | …                       |                                         |     |     |
| 102–105  | Team 14th player        |                                         |     |     |

### Record `310` (new — replaces `013`)

| Position | Description             | Contents                  | R   | P   |
| -------- | ----------------------- | ------------------------- | --- | --- |
| 1–3      | Section Type Identifier | `310`                     | ■   | ■   |
| 5–7      | Team Pairing Number     | 1 to 999                  | ■   | ■   |
| 9–40     | Team Name               |                           | ■   | ■   |
| 42–46    | Team Nickname           | Format: `AAAAA`           |     |     |
| 48–53    | Strength Factor         | Format: `111111`          |     |     |
| 55–60    | Match Points            | Format: `1111.5`          |     | ■   |
| 62–67    | Game Points             | Format: `1111.5`          |     | ■   |
| 69–71    | Team Rank               | Not unique — ties allowed | ■   | ■   |
| 74–77    | Team 1st player         | StartingRank Number       | ■   | ■   |
| 79–82    | Team 2nd player         |                           |     |     |
| …        | …                       |                           |     |     |
| 139–142  | Team 14th player        |                           |     |     |

Example:

```
### SSS NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN FFFFF EEEEEE MMMMMM GGGGGG RRR  PPP1 PPP2 PPP3 PPP4 PPP5
310   1 India                            IND     2486   15.0   28.0  11     1    5   15   28   44
310   2 Ukraine                          UKR     2478   14.0   26.5  14     2    4   20   27   22
```

---

## Accelerated Rounds (`250` records)

For both individual and team tournaments. For ITDX, these records cause any
acceleration method in record `192` to be disregarded.

| Position | Description                        | Contents                                                          | R   | P   |
| -------- | ---------------------------------- | ----------------------------------------------------------------- | --- | --- |
| 1–3      | Record Identifier                  | `250`                                                             | ◙   | ■   |
| 5–8      | Number of fictitious match points  | Format: `11.5`; empty for individual competitions                 |     | ■   |
| 10–13    | Number of fictitious (game) points | Format: `11.5`; must differ from `0.0` in individual competitions |     | ◙   |
| 15–17    | First Round Number                 | First round in which fictitious points are assigned               | ◙   | ■   |
| 19–21    | Last Round Number                  | Last round (may coincide with first)                              | ◙   | ■   |
| 23–26    | First Player/Team ID               |                                                                   | ◙   | ■   |
| 28–31    | Last Player/Team ID                | (may coincide with first)                                         | ◙   | ■   |

Example (Baku Acceleration Method in an 11-round team Swiss with 178 teams):

```
### MMMM GGGG RRF RRL PPPF PPPL
250 00.0 02.0 001 003 0001 0090
250 00.0 01.0 004 006 0001 0090
```

---

## Prohibited Pairings (`260` records)

For both individual and team tournaments.

| Position   | Description        | Contents                                                  | R   | P   |
| ---------- | ------------------ | --------------------------------------------------------- | --- | --- |
| 1–3        | Record Identifier  | `260`                                                     | ◙   | ■   |
| 5–7        | First Round Number | First round in which the listed players/teams cannot meet | ◙   | ■   |
| 9–11       | Last Round Number  | Last round (may coincide with first)                      | ◙   | ■   |
| 13–16      | Player/Team ID     | 1st player/team                                           | ◙   | ■   |
| 18–21      | Player/Team ID     | 2nd player/team                                           | ◙   | ■   |
| 23–26      | Player/Team ID     | (optional) 3rd player/team                                |     |     |
| (continue) |                    |                                                           |     |     |

Example:

```
### RR1 RRL PPP1 PPP2 PPP3 PPP4 PPP5 ....
260 001 002  125  180  184  216
260 001 002  208  222  231
260 001 002  215  290  302  304  307
```

---

## Bye Section (`240` records)

Byes that bring points to those receiving them (FPB, HPB, ZPB for individuals
and teams; PAB for teams).

### Individual and Teams — Half/Full/Zero Point Bye (`240`)

| Position | Description       | Contents                                                     | R   | P   |
| -------- | ----------------- | ------------------------------------------------------------ | --- | --- |
| 1–3      | Record identifier | `240`                                                        |     | ■   |
| 5        | Type of bye       | `F` full-point-bye / `H` half-point-bye / `Z` zero-point-bye |     | ■   |
| 7–9      | Round Number      |                                                              |     | ■   |
| 11–14    | Player/Team ID    | 1st getting the bye                                          |     | ■   |
| 16–19    | Player/Team ID    | 2nd (if any)                                                 |     |     |
| 21–24    | Player/Team ID    | 3rd (if any)                                                 |     |     |

Example (two teams getting HPB in round 3):

```
### T RRR  111  222
240 H 003  026  047
```

### Teams — Pairing-Allocated Bye (`320`)

| Position   | Description         | Contents                            | R   | P   |
| ---------- | ------------------- | ----------------------------------- | --- | --- |
| 1–3        | Record Identifier   | `320`                               |     | ■   |
| 5–8        | PAB Match Points    | Format: `11.5`                      |     | ■   |
| 10–13      | PAB Game Points     | Format: `11.5`                      |     | ■   |
| 15–17      | Team Pairing Number | PAB Team in round 1 (`000` if none) |     | ■   |
| 19–21      | Team Pairing Number | PAB Team in round 2                 |     | ■   |
| (continue) |                     |                                     |     |     |

---

## Forfeited Matches (`330` records)

| Position | Description         | Contents                                                        | R   | P   |
| -------- | ------------------- | --------------------------------------------------------------- | --- | --- |
| 1–3      | Record Identifier   | `330`                                                           | ■   |     |
| 5–6      | Type of forfeit     | `+-` win with White / `-+` win with Black / `--` double forfeit |     | ■   |
| 8–10     | Round Number        |                                                                 |     | ■   |
| 12–14    | Team Pairing Number | White team                                                      |     | ■   |
| 16–18    | Team Pairing Number | Black team                                                      |     | ■   |

Example:

```
### TT RRR WWW BBB
330 +- 004 023 047
330 -+ 008 027 005
```

---

## Out-Of-(default)Order (`300` records)

Required when a team plays in a different board order than defined in record
`310`, or plays with an unoccupied board.

| Position   | Description               | Contents                          | R   | P   |
| ---------- | ------------------------- | --------------------------------- | --- | --- |
| 1–3        | Record Identifier         | `300`                             |     | ■   |
| 5–7        | Round Number              | Format: `111`                     |     | ■   |
| 9–11       | Team Pairing Number       | Team playing out of default order |     |     |
| 13–15      | Team Pairing Number       | Scheduled opponent                |     | ■   |
| 17–20      | 1st Player ID (or `0000`) | From Player Section position 5–8  |     | ■   |
| 22–25      | 2nd Player ID (or `0000`) |                                   |     | ■   |
| 27–30      | 3rd Player ID (or `0000`) |                                   |     | ■   |
| 32–35      | 4th Player ID (or `0000`) |                                   |     | ■   |
| (continue) |                           |                                   |     |     |

---

## Abnormal Assignment Points (`299` records)

Special record for non-standard point assignments.

| Position   | Description                                 | Contents                                                                                                                 | R   | P   |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| 1–3        | Record Identifier                           | `299`                                                                                                                    | ■   |     |
| 5          | Type of abnormal assignment (AAT)           | `W` win / `D` draw / `L` loss / `F` FPB / `H` HPB / `Z` ZPB / `+` forfeit win / `-` forfeit loss / (blank) penalty/bonus |     | ■   |
| 8–11       | Match Points (teams only)                   | Format: `[-]11.5`                                                                                                        |     | ■   |
| 14–17      | Game Points (teams) or points (individuals) | Format: `[-]11.5`                                                                                                        |     | ■   |
| 20–22      | Round Number                                | `000` or empty means all rounds                                                                                          |     |     |
| 24–27      | (Team) Pairing Number                       | 1st team/individual                                                                                                      |     |     |
| 29–32      | (Team) Pairing Number                       | 2nd team/individual                                                                                                      |     |     |
| (continue) |                                             |                                                                                                                          |     |     |

---

## Informative Records for Teams (`801` / `802`)

Not required but recommended for human readability.

### Record `802` (fixed-length, shorter version of `801`)

| Position                 | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| 1–3                      | `802`                                                       |
| 5–7                      | Team Pairing Number                                         |
| 9–13                     | Team Nickname                                               |
| 15–20                    | Total match points                                          |
| 22–27                    | Total game points                                           |
| 29–31                    | 1st round opponent or bye type (`PAB`, `FPB`, `HPB`, `ZPB`) |
| 33                       | 1st round colour (`w`/`b` or empty for bye)                 |
| 35–38                    | Game points round 1                                         |
| 39                       | Forfeit indicator (`f`/`F` or empty)                        |
| 42–44                    | 2nd round opponent or bye type                              |
| (continue, same pattern) |                                                             |

Example:

```
### TTT NNNNN MMMMMM GGGGGG  T01 C GGGGf  T02 C GGGGf  T03 C GGGGf
802   3 GEO     19.0   32.5  FPB    4.0    16 w  2.5    11 b  2.5
802  15 BUL     12.0   24.0    2 b  2.0   ZPB    0.0    29 w  2.5
```
