# JaVaFo Pairing Engine Advanced User Manual (AUM)

**Source:** https://www.rrweb.org/javafo/aum/JaVaFo2_AUM.htm

Supplementary extensions to the TRF16/TRF26 format used by JaVaFo and other
pairing engines for in-tournament data exchange. These extensions are de facto
community standards not defined in the FIDE TRF spec itself.

---

# Introduction

JaVaFo is both a stand-alone program (provided that a Java virtual machine
exists to execute it) and an archive (`.jar`) that can be used by a program
written in Java.

The most practical way to input data to JaVaFo is using the TRF(x), where
**TRF** _(also called TRF16 to distinguish it from the TRF06 used in the past)_
is the official FIDE Tournament Report File, and the **(x)** stands for
extensions that have to be introduced in such format to make it useful for
exchanging data between different programs. It is recommended that such file is
written using UTF-8 encoding.

The extensions to the TRF16 are partly made by adding new alphabetic codes
(completely different from the current numeric codes defined for the
format[^1]), partly by allowing writing in the TRF something not normally found
in a TRF, partly by interpreting some data contained in it.

---

# Extensions

## Interpretation Extensions

A TRF is normally used only to generate data at the end of the tournament. The
first extension is to allow the TRF to be generated also _during_ the
tournament. This partial TRF is fed to JaVaFo as its input.

The field **Points** _(position 81–84)_ must contain the correct number of
points each player has scored, because that number is used to infer the scoring
point system. With version 2.2, this methodology has been deprecated — such
parameters must now be explicitly defined using the `XXS` option (see below).

## Unusual Info Extensions

The partial TRF contains information regarding rounds already played but says
nothing about the current round (the one that should be paired). Two
non-contrasting ways exist to pass this information:

1. Insert `0000 - Z` into the proper columns for the current round for absent
   players. Also valid: `0000 - H` (half-point-bye) or `0000 - F` (deprecated
   full-point-bye) — in these cases the **Points** field must be updated.

2. Use the `XXZ` extension code (preferred, see below).

Blank codes are ignored — each present player is identified by the absence of a
result code.

## Extra Codes Extensions

Some alphabetic codes were added to transmit additional information to the
pairing engine.

### `XXR` — Number of rounds

```
XXR number
```

The most essential extension: the pairing engine must know the total number of
rounds. `number` is the number of rounds in the competition.

### TRF(x) Sample

An example of TRF(x) used to pair the fifth round of the _XX Open Internacional
de Gros_ is available at: https://www.rrweb.org/javafo/aum/TRFXSample2.txt

---

# Extensions and Other Options

## `XXZ` — Absent Players

```
XXZ list-of-pairing-id(s)
```

Lists the pairing-ids of players that will miss the round to be paired. There
can be multiple `XXZ` records.

## `XXS` — Scoring Point System

```
XXS CODE=VALUE
```

`VALUE` is a floating-point number (e.g. `1.5`). `CODE` is one of:

| Code  | Default | Description                                   |
| ----- | ------- | --------------------------------------------- |
| `WW`  | 1.0     | Points for win with White                     |
| `BW`  | 1.0     | Points for win with Black                     |
| `WD`  | 0.5     | Points for draw with White                    |
| `BD`  | 0.5     | Points for draw with Black                    |
| `WL`  | 0.0     | Points for loss with White                    |
| `BL`  | 0.0     | Points for loss with Black                    |
| `ZPB` | 0.0     | Points for zero-point-bye                     |
| `HPB` | 0.5     | Points for half-point-bye                     |
| `FPB` | 1.0     | Points for full-point-bye                     |
| `PAB` | 1.0     | Points for pairing-allocated-bye              |
| `FW`  | 1.0     | Points for forfeit win                        |
| `FL`  | 0.0     | Points for forfeit loss                       |
| `W`   | 1.0     | Shortcut encompassing `WW`, `BW`, `FW`, `FPB` |
| `D`   | 0.5     | Shortcut encompassing `WD`, `BD`, `HPB`       |

The sequence `CODE=VALUE` can be repeated multiple times in a `XXS` record, or
there may be multiple `XXS` records. Codes not mentioned are assumed to have
standard values. When a shortcut and an encompassed code are both used, the last
one (left-to-right, top-to-bottom) wins.

Note: when `XXS` is used, JaVaFo strictly checks that **Points** _(characters
81–84 in the `001` record)_ matches the results exactly. If the check fails, the
program may crash.

**Examples**

Standard scoring system:

```
XXS WW=1 WD=.5 WL=0 BW=1 BD=0.5 BL=0
XXS FL=0 FW=1
XXS PAB=1 FPB=1 HPB=.5 ZPB=0
```

3/1/0 scoring system (PAB = win):

```
XXS PAB=3 D=1 W=3
```

3/1/0 scoring system (PAB = draw):

```
XXS W=3
XXS D=1
```

Half-point PAB only:

```
XXS PAB=.5
```

3/2/1/0 system:

```
XXS FL=0 W=3 D=2 PAB=2 WL=1 BL=1 ZPB=1
```

## `XXC` — Configuration (Ranking ID and First Round Colour)

### Ranking ID

```
XXC rank
```

Tells JaVaFo to use positional-ids (ranking-ids) instead of pairing-ids to
produce the pairings. The output file still contains the pairing-ids.

### First Round Colour

To force White first:

```
XXC white1
```

To force Black first:

```
XXC black1
```

The `XXC` code is cumulative:

```
XXC rank black1
```

combines both settings in a valid single line. The default (no `XXC`) lets
JaVaFo make a semi-random choice based on a hash of the TRF(x) data —
deterministic for the same input.

## `XXA` — Accelerated Rounds

```
XXA NNNN pp.p pp.p ...
```

Where:

- `XXA` starts at column 1
- `NNNN` (player's id, same as in `001`) starts at column 5
- `pp.p` (fictitious points) starts at column `10+5*(r-1)` where `r` is the
  round

The full history of fictitious points assigned round by round must be
maintained, as it is used to determine the floaters history of each player.

An acceleration sample is available at:
https://www.rrweb.org/javafo/aum/AcceleratedTRFXSample2.txt

### Baku Acceleration Method

JaVaFo applies the Baku Acceleration Method (old FIDE Handbook, works only for
tournaments longer than eight rounds) when invoked with the `-b` option. JaVaFo
applies this only to the current round.

## `XXP` — Forbidden Pairs

```
XXP list-of-pairing-id(s)
```

All players mentioned in the list will not be paired against each other. There
is no limit on how many times a player can appear in a `XXP` list.

Example: preventing matches between members of groups `<13, 78, 102>` and
`<68, 111>`:

```
XXP 13 68
XXP 13 111
XXP 78 68
XXP 78 111
XXP 102 68
XXP 102 111
```

---

# Check-list

JaVaFo can generate a check-list summarising the situation after pairing using
the `-l` option:

```
javafo TRF_DIR\trn.trfx -p OUT_DIR\outfile.txt -l
javafo TRF_DIR\trn.trfx -p OUT_DIR\outfile.txt -l ANY_DIR\outfile.list
```

**Pref** column symbols:

| Symbol        | Meaning                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `WWW` / `BBB` | Double absolute preference — twice-same-colour and colour-difference > \|1\| |
| `WW` / `BB`   | Absolute preference — colour-difference > \|1\|                              |
| `W1` / `B1`   | Absolute preference — twice-same-colour and colour-difference = 1            |
| `W` / `B`     | Absolute preference — twice-same-colour and colour-difference = 0            |
| `(W)` / `(B)` | Strong colour preference                                                     |
| `(w)` / `(b)` | Mild colour preference                                                       |
| `A`           | No preference                                                                |

**-1R** and **-2R**: floating history (up or down) in the last and penultimate
round.

**G-r, ..., G-1**: opponents in the last g-th games played (unplayed rounds not
counted). `[X]` in the first column means the player cannot receive the
pairing-allocated-bye.

---

# Quick Recap

Standard invocations:

```
javafo [-r]
javafo [-r] input-file -c [round-number]
javafo [-r] input-file [-b] -p [output-file] [-l [check-list-file]]
javafo [-r] [model-file] -g [-b] -o trf-file
javafo [-r] -g config-file [-b] -o trf-file
```

| Option                 | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `-r`                   | Show JaVaFo release and build numbers                                    |
| `input-file`           | In TRF(x) format                                                         |
| `model-file`           | In TRF(x) format, model file for the random-tournament-generator         |
| `config-file`          | RTG configuration file; if a long integer, used as seed                  |
| `-c [round-number]`    | Use JaVaFo as a checker; if round-number missing, all rounds are checked |
| `-g`                   | Use JaVaFo as a random-tournament-generator                              |
| `-b`                   | Apply, if feasible, the Baku Acceleration Method                         |
| `-p [output-file]`     | Output file for pairings; defaults to stdout if missing                  |
| `-l [check-list-file]` | Output file for check-list; defaults to input-file directory             |
| `-o trf-file`          | Output file for (auto)generated TRF                                      |

---

[^1]:
    The idea of alphabetic codes comes from Christian Krause, chairman of the
    Systems of Pairings and Programs (SPP) FIDE Commission.
