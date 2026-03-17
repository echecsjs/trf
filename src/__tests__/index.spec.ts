import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import parse from "../index.js";

import type { ParseError } from "../types.js";

function fixture(name: string): string {
  return readFileSync(
    path.join(import.meta.dirname, "fixtures", `${name}.trf`),
    "utf8",
  );
}

// ---------------------------------------------------------------------------
// Null / failure cases
// ---------------------------------------------------------------------------
describe("parse — failure cases", () => {
  it("returns null for empty input", () => {
    expect(parse("")).toBeNull();
  });

  it("calls onError for empty input", () => {
    const onError = vi.fn<(error: ParseError) => void>();
    parse("", { onError });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("returns null for whitespace-only input", () => {
    expect(parse("   \n  ")).toBeNull();
  });

  it("strips BOM before parsing", () => {
    const result = parse("\uFEFF012 My Tournament\nXXR 5\n");
    expect(result).not.toBeNull();
    expect(result?.name).toBe("My Tournament");
  });
});

// ---------------------------------------------------------------------------
// Header tag parsing
// ---------------------------------------------------------------------------
describe("parse — header tags", () => {
  it("parses tournament name from 012 tag", () => {
    expect(parse("012 My Tournament\nXXR 3\n")?.name).toBe("My Tournament");
  });

  it("parses city from 022 tag", () => {
    expect(parse("012 T\n022 Paris\nXXR 1\n")?.city).toBe("Paris");
  });

  it("parses federation from 032 tag", () => {
    expect(parse("012 T\n032 FRA\nXXR 1\n")?.federation).toBe("FRA");
  });

  it("parses start date from 042 tag", () => {
    expect(parse("012 T\n042 2026-01-01\nXXR 1\n")?.startDate).toBe(
      "2026-01-01",
    );
  });

  it("parses end date from 052 tag", () => {
    expect(parse("012 T\n052 2026-01-07\nXXR 1\n")?.endDate).toBe("2026-01-07");
  });

  it("parses chief arbiter from 092 tag", () => {
    expect(parse("012 T\n092 Smith John\nXXR 1\n")?.chiefArbiter).toBe(
      "Smith John",
    );
  });

  it("parses time control from 112 tag", () => {
    expect(parse("012 T\n112 90+30\nXXR 1\n")?.timeControl).toBe("90+30");
  });

  it("parses rounds from XXR tag", () => {
    expect(parse("012 T\nXXR 9\n")?.rounds).toBe(9);
  });

  it("emits onWarning for unknown tag codes", () => {
    const onWarning = vi.fn();
    const result = parse("012 T\nXXR 1\nZZZ unknown tag\n", { onWarning });
    expect(result).not.toBeNull();
    expect(onWarning).toHaveBeenCalledOnce();
  });

  it("returns version TRF16 for standard input", () => {
    expect(parse("012 T\nXXR 1\n")?.version).toBe("TRF16");
  });

  it("returns tournament with empty players when no 001 lines", () => {
    const result = parse("012 Empty\nXXR 5\n");
    expect(result?.players).toHaveLength(0);
    expect(result?.rounds).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Player parsing
// ---------------------------------------------------------------------------
describe("parse — player fields", () => {
  it("parses pairing number", () => {
    expect(parse(fixture("dutch_2025_C5"))?.players[0]?.pairingNumber).toBe(1);
  });

  it("parses player name", () => {
    expect(parse(fixture("dutch_2025_C5"))?.players[0]?.name).toBe(
      "Test0001 Player0001",
    );
  });

  it("parses rating", () => {
    expect(parse(fixture("dutch_2025_C5"))?.players[0]?.rating).toBe(2720);
  });

  it("parses points", () => {
    expect(parse(fixture("dutch_2025_C5"))?.players[0]?.points).toBe(2);
  });

  it("parses rank", () => {
    expect(parse(fixture("dutch_2025_C5"))?.players[0]?.rank).toBe(1);
  });

  it("emits onWarning and sets rating undefined for malformed rating", () => {
    const onWarning = vi.fn();
    const line =
      "001    1      Test Name                        XXXX                             1.0    1";
    const result = parse(`012 T\nXXR 1\n${line}\n`, { onWarning });
    expect(result?.players[0]?.rating).toBeUndefined();
    expect(onWarning).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Round result parsing
// ---------------------------------------------------------------------------
describe("parse — round results", () => {
  it("parses win result", () => {
    const result = parse(fixture("dutch_2025_C5"));
    const p1 = result?.players[0];
    const r1 = p1?.results[0];
    expect(r1?.result).toBe("1");
    expect(r1?.color).toBe("w");
    expect(r1?.opponentId).toBe(4);
    expect(r1?.round).toBe(1);
  });

  it("parses loss result", () => {
    const result = parse(fixture("dutch_2025_C5"));
    const p2 = result?.players[1];
    const r2 = p2?.results.find((r) => r.result === "0");
    expect(r2?.color).toBe("w");
  });

  it("parses draw result", () => {
    const result = parse(fixture("issue_7"));
    const p1 = result?.players[0];
    const drawResult = p1?.results.find((r) => r.result === "=");
    expect(drawResult).toBeDefined();
  });

  it("parses Z-bye with opponentId null", () => {
    const result = parse(fixture("dutch_2025_C5"));
    const p4 = result?.players[3];
    const zBye = p4?.results.find((r) => r.result === "Z");
    expect(zBye).toBeDefined();
    expect(zBye?.opponentId).toBeNull();
  });

  it("parses forfeit win (+) present in issue_7", () => {
    const result = parse(fixture("issue_7"));
    const allResults = result?.players.flatMap((p) =>
      p.results.map((r) => r.result),
    );
    expect(allResults).toContain("+");
  });
});

// ---------------------------------------------------------------------------
// Fixture integration tests
// ---------------------------------------------------------------------------
describe("parse — dutch_2025_C5 fixture", () => {
  it("parses 6 players", () => {
    expect(parse(fixture("dutch_2025_C5"))?.players).toHaveLength(6);
  });

  it("parses rounds as 3", () => {
    expect(parse(fixture("dutch_2025_C5"))?.rounds).toBe(3);
  });

  it("parses correct ratings for all players", () => {
    const players = parse(fixture("dutch_2025_C5"))?.players ?? [];
    expect(players.map((p) => p.rating)).toEqual([
      2720, 2701, 2697, 2689, 2673, 2664,
    ]);
  });
});

describe("parse — dutch_2025_C9 fixture", () => {
  it("parses 5 players", () => {
    expect(parse(fixture("dutch_2025_C9"))?.players).toHaveLength(5);
  });

  it("parses rounds as 3", () => {
    expect(parse(fixture("dutch_2025_C9"))?.rounds).toBe(3);
  });
});

describe("parse — issue_7 fixture", () => {
  it("parses 60 players", () => {
    expect(parse(fixture("issue_7"))?.players).toHaveLength(60);
  });

  it("parses rounds as 15", () => {
    expect(parse(fixture("issue_7"))?.rounds).toBe(15);
  });

  it("parses P1 score as 10.5", () => {
    expect(parse(fixture("issue_7"))?.players[0]?.points).toBe(10.5);
  });
});

// ---------------------------------------------------------------------------
// Sex and title parsing
// ---------------------------------------------------------------------------
describe("parse — sex and title fields", () => {
  it("parses sex field", () => {
    const line =
      "001    1 m    Test Name                        2000                             1.0    1";
    const result = parse(`012 T\nXXR 1\n${line}\n`);
    expect(result?.players[0]?.sex).toBe("m");
  });

  it("parses title field", () => {
    const line =
      "001    1  GM  Test Name                        2000                             1.0    1";
    const result = parse(`012 T\nXXR 1\n${line}\n`);
    expect(result?.players[0]?.title).toBe("GM");
  });

  it("ignores unknown title", () => {
    const line =
      "001    1  XX  Test Name                        2000                             1.0    1";
    const result = parse(`012 T\nXXR 1\n${line}\n`);
    expect(result?.players[0]?.title).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// XXR missing
// ---------------------------------------------------------------------------
describe("parse — XXR tag", () => {
  it("returns rounds 0 when XXR tag is absent", () => {
    expect(parse("012 T\n")?.rounds).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// issue_15 fixture
// ---------------------------------------------------------------------------
describe("parse — issue_15 fixture", () => {
  it("parses 180 players", () => {
    expect(parse(fixture("issue_15"))?.players).toHaveLength(180);
  });

  it("parses rounds as 12", () => {
    expect(parse(fixture("issue_15"))?.rounds).toBe(12);
  });

  it("parses P1 score as 8.0", () => {
    expect(parse(fixture("issue_15"))?.players[0]?.points).toBe(8);
  });

  it("parses P1 rating as 2761", () => {
    expect(parse(fixture("issue_15"))?.players[0]?.rating).toBe(2761);
  });

  it("parses 11 round results for P1", () => {
    const p1 = parse(fixture("issue_15"))?.players[0];
    expect(p1?.results).toHaveLength(11);
  });

  it("does not return null", () => {
    expect(parse(fixture("issue_15"))).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Round number assignment
// ---------------------------------------------------------------------------
describe("parse — round number assignment", () => {
  it("assigns correct round numbers to results", () => {
    const result = parse(fixture("dutch_2025_C5"));
    const p1 = result?.players[0];
    // P1: R1 as white vs P4, R2 as black vs P2
    expect(p1?.results[0]?.round).toBe(1);
    expect(p1?.results[1]?.round).toBe(2);
  });
});
