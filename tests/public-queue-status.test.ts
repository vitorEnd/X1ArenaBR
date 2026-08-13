import assert from "node:assert/strict";
import test from "node:test";
import {
  hasPublicRankedActivity,
  normalizePublicQueueCount,
  PUBLIC_ACTIVE_LOBBY_STATUSES,
} from "../lib/ranked/public-queue-status.ts";

test("normalizes the public queue count without exposing invalid values", () => {
  assert.equal(normalizePublicQueueCount(4), 4);
  assert.equal(normalizePublicQueueCount("3"), 3);
  assert.equal(normalizePublicQueueCount(-2), 0);
  assert.equal(normalizePublicQueueCount(Number.NaN), 0);
  assert.equal(normalizePublicQueueCount("private-mmr"), 0);
});

test("reports public activity for either a search or a live lobby", () => {
  assert.equal(hasPublicRankedActivity(0, 0), false);
  assert.equal(hasPublicRankedActivity(1, 0), true);
  assert.equal(hasPublicRankedActivity(0, 1), true);
  assert.equal(hasPublicRankedActivity("invalid", -1), false);
});

test("counts only non-terminal Ranked lobby states", () => {
  assert.deepEqual(PUBLIC_ACTIVE_LOBBY_STATUSES, [
    "awaiting_acceptance",
    "lobby",
    "in_progress",
    "awaiting_score",
    "awaiting_confirmation",
  ]);
  assert.equal(PUBLIC_ACTIVE_LOBBY_STATUSES.includes("confirmed" as never), false);
  assert.equal(PUBLIC_ACTIVE_LOBBY_STATUSES.includes("cancelled" as never), false);
  assert.equal(PUBLIC_ACTIVE_LOBBY_STATUSES.includes("disputed" as never), false);
});
