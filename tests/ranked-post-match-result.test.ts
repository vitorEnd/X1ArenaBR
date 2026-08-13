import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL(
  "../lib/ranked/post-match-result.ts",
  import.meta.url,
);
const { buildPostMatchResult } = (await import(moduleUrl.href)) as typeof import(
  "../lib/ranked/post-match-result"
);

const base = {
  matchId: "match-1",
  matchNumber: 42,
  viewerId: "viewer",
  winnerProfileId: "viewer",
  placementMatchesRequired: 5,
  currentMmr: null,
  currentTier: null,
  oldMmr: null,
  newMmr: null,
  mmrDelta: null,
} as const;

test("never leaks provisional MMR before placement match five", () => {
  const result = buildPostMatchResult({
    ...base,
    isPlacement: true,
    placementMatchesPlayed: 4,
    // Even accidental private inputs must not cross this projection boundary.
    currentMmr: 1_400,
    currentTier: "craque",
    oldMmr: 1_200,
    newMmr: 1_400,
    mmrDelta: 200,
  });

  assert.equal(result.placementPending, true);
  assert.equal(result.rankChange, "unchanged");
  assert.equal(result.oldMmr, null);
  assert.equal(result.newMmr, null);
  assert.equal(result.mmrDelta, null);
  assert.equal(result.previousTier, null);
  assert.equal(result.nextTier, null);
});

test("reveals only final MMR and tier when placement match five completes", () => {
  const result = buildPostMatchResult({
    ...base,
    isPlacement: true,
    placementMatchesPlayed: 5,
    currentMmr: 1_200,
    currentTier: "pro",
  });

  assert.equal(result.placementPending, false);
  assert.equal(result.rankChange, "placement_revealed");
  assert.equal(result.oldMmr, null);
  assert.equal(result.newMmr, 1_200);
  assert.equal(result.mmrDelta, null);
  assert.equal(result.previousTier, null);
  assert.equal(result.nextTier, "pro");
});

test("classifies regular promotion with authoritative MMR delta", () => {
  const result = buildPostMatchResult({
    ...base,
    isPlacement: false,
    placementMatchesPlayed: 5,
    currentMmr: 1_008,
    currentTier: "pro",
    oldMmr: 990,
    newMmr: 1_008,
    mmrDelta: 18,
  });

  assert.equal(result.outcome, "win");
  assert.equal(result.rankChange, "promoted");
  assert.equal(result.previousTier, "novato");
  assert.equal(result.nextTier, "pro");
  assert.equal(result.mmrDelta, 18);
});

test("classifies regular loss and demotion", () => {
  const result = buildPostMatchResult({
    ...base,
    winnerProfileId: "opponent",
    isPlacement: false,
    placementMatchesPlayed: 5,
    currentMmr: 1_790,
    currentTier: "craque",
    oldMmr: 1_810,
    newMmr: 1_790,
    mmrDelta: -20,
  });

  assert.equal(result.outcome, "loss");
  assert.equal(result.rankChange, "demoted");
  assert.equal(result.previousTier, "desafiante");
  assert.equal(result.nextTier, "craque");
  assert.equal(result.mmrDelta, -20);
});

test("does not replay Champion promotion on every subsequent win", () => {
  const result = buildPostMatchResult({
    ...base,
    isPlacement: false,
    placementMatchesPlayed: 5,
    currentMmr: 2_540,
    currentTier: "champion",
    oldMmr: 2_520,
    newMmr: 2_540,
    mmrDelta: 20,
  });

  assert.equal(result.previousTier, "champion");
  assert.equal(result.nextTier, "champion");
  assert.equal(result.rankChange, "unchanged");
});
