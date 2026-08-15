import assert from "node:assert/strict";
import test from "node:test";

const constantsModuleUrl = new URL("../lib/ranked/constants.ts", import.meta.url);
const mmrModuleUrl = new URL("../lib/ranked/mmr.ts", import.meta.url);
const matchmakingModuleUrl = new URL("../lib/ranked/matchmaking.ts", import.meta.url);
const placementsModuleUrl = new URL("../lib/ranked/placements.ts", import.meta.url);
const penaltiesModuleUrl = new URL("../lib/ranked/penalties.ts", import.meta.url);
const ranksModuleUrl = new URL("../lib/ranked/ranks.ts", import.meta.url);

const {
  RANKED_NO_ACCEPT_PENALTY_SECONDS,
  RANKED_PLACEMENT_MMR_BY_WINS,
} = (await import(constantsModuleUrl.href)) as typeof import("../lib/ranked/constants");
const {
  applyRankedMmrResult,
  calculateExpectedScore,
  calculateRankedMmrDelta,
  calculateRankedMmrLoss,
} = (await import(mmrModuleUrl.href)) as typeof import("../lib/ranked/mmr");
const { canPairRankedCandidate, compareRankedCandidates } = (
  await import(matchmakingModuleUrl.href)
) as typeof import("../lib/ranked/matchmaking");
const { getPlacementMmr, getRankedPlacementState } = (
  await import(placementsModuleUrl.href)
) as typeof import("../lib/ranked/placements");
const { recordRankedNoAccept, resetRankedNoAcceptProgress } = (
  await import(penaltiesModuleUrl.href)
) as typeof import("../lib/ranked/penalties");
const {
  buildRankedStandings,
  formatRankedTier,
  getBaseRankedTier,
  getRankedTier,
} = (await import(ranksModuleUrl.href)) as typeof import("../lib/ranked/ranks");

test("maps every MMR boundary to the official AXB tier", () => {
  assert.equal(getBaseRankedTier(800), "novato");
  assert.equal(getBaseRankedTier(999), "novato");
  assert.equal(getBaseRankedTier(1_000), "pro");
  assert.equal(getBaseRankedTier(1_249), "pro");
  assert.equal(getBaseRankedTier(1_250), "craque");
  assert.equal(getBaseRankedTier(1_799), "craque");
  assert.equal(getBaseRankedTier(1_800), "desafiante");
  assert.equal(getBaseRankedTier(2_099), "desafiante");
  assert.equal(getBaseRankedTier(2_100), "immortal");
  assert.equal(getBaseRankedTier(10_000), "immortal");
});

test("requires both 2,500 MMR and a Top 10 position for Champion", () => {
  assert.equal(getRankedTier(2_500, 10), "champion");
  assert.equal(getRankedTier(2_500, 11), "immortal");
  assert.equal(getRankedTier(2_499, 1), "immortal");
  assert.equal(formatRankedTier(2_847, 1), "TOP 1 • 2.847 MMR");
});

test("orders the global table by every official tie-break in sequence", () => {
  const standings = buildRankedStandings([
    { id: "d", mmr: 2_500, wins: 10, losses: 2, mmrReachedAt: "2026-01-02T00:00:00Z" },
    { id: "c", mmr: 2_500, wins: 10, losses: 1, mmrReachedAt: "2026-01-03T00:00:00Z" },
    { id: "b", mmr: 2_500, wins: 10, losses: 1, mmrReachedAt: "2026-01-01T00:00:00Z" },
    { id: "a", mmr: 2_600, wins: 1, losses: 9, mmrReachedAt: "2026-02-01T00:00:00Z" },
  ]);

  assert.deepEqual(standings.map(({ id }) => id), ["a", "b", "c", "d"]);
  assert.deepEqual(standings.map(({ globalPosition }) => globalPosition), [1, 2, 3, 4]);
  assert.ok(standings.every(({ tier }) => tier === "champion"));
});

test("keeps placement MMR hidden until match five and uses the approved values", () => {
  assert.deepEqual(
    [...RANKED_PLACEMENT_MMR_BY_WINS],
    [800, 900, 1_000, 1_100, 1_200, 1_400],
  );
  assert.equal(getRankedPlacementState(4, 4).revealedMmr, null);
  assert.equal(getRankedPlacementState(5, 4).revealedMmr, 1_200);
  assert.equal(getPlacementMmr(5), 1_400);
  assert.throws(() => getRankedPlacementState(2, 3), RangeError);
});

test("rewards wins with 30–40 MMR, limits losses to 10–15 and enforces the floor", () => {
  assert.equal(calculateExpectedScore(1_200, 1_200), 0.5);
  assert.equal(calculateRankedMmrDelta(1_200, 1_200), 35);
  assert.equal(calculateRankedMmrLoss(1_200, 1_200), 13);
  assert.equal(calculateRankedMmrDelta(2_500, 800), 30);
  assert.equal(calculateRankedMmrLoss(2_500, 800), 10);
  assert.equal(calculateRankedMmrDelta(800, 2_500), 40);
  assert.equal(calculateRankedMmrLoss(800, 2_500), 15);

  assert.deepEqual(applyRankedMmrResult(1_200, 810), {
    winnerBefore: 1_200,
    winnerAfter: 1_231,
    loserBefore: 810,
    loserAfter: 800,
    nominalDelta: 31,
    winnerDelta: 31,
    loserDelta: -10,
  });
  assert.equal(applyRankedMmrResult(1_200, 800).loserAfter, 800);
});

test("opens matchmaking after 60 seconds and preserves chronological priority", () => {
  const now = 100_000;
  const closeSearcher = { id: "self", effectiveMmr: 1_200, joinedAt: now - 10_000 };
  const expandedSearcher = { ...closeSearcher, joinedAt: now - 60_000 };
  const close = { id: "close", effectiveMmr: 1_300, joinedAt: now - 5_000 };
  const farOld = { id: "far", effectiveMmr: 2_500, joinedAt: now - 20_000 };

  assert.equal(canPairRankedCandidate(closeSearcher, close, now), true);
  assert.equal(canPairRankedCandidate(closeSearcher, farOld, now), false);
  assert.equal(canPairRankedCandidate(expandedSearcher, farOld, now), true);
  assert.ok(compareRankedCandidates(closeSearcher, close, farOld, now) < 0);
  assert.ok(compareRankedCandidates(expandedSearcher, close, farOld, now) > 0);
});

test("applies a progressive penalty on every third missed acceptance", () => {
  let progress = resetRankedNoAcceptProgress();

  for (const expectedSeconds of RANKED_NO_ACCEPT_PENALTY_SECONDS) {
    const first = recordRankedNoAccept(progress);
    const second = recordRankedNoAccept(first);
    const third = recordRankedNoAccept(second);
    assert.equal(first.penaltySeconds, null);
    assert.equal(second.penaltySeconds, null);
    assert.equal(third.penaltySeconds, expectedSeconds);
    assert.equal(third.strikes, 0);
    progress = third;
  }

  assert.deepEqual(resetRankedNoAcceptProgress(), { strikes: 0, penaltyLevel: 0 });
});
