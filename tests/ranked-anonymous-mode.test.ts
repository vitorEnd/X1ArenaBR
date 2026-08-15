import test from "node:test";
import assert from "node:assert/strict";

test("anonymous leaderboard labels use a stable four-digit number", () => {
  const label = (number: number) => `Anonimo${String(number).padStart(4, "0")}`;
  assert.equal(label(1), "Anonimo0001");
  assert.equal(label(42), "Anonimo0042");
});

test("anonymous profiles expose no public competitive data", () => {
  const profile = { anonymousMode: true, wins: 0, losses: 0, mmr: null, statistics: null, history: [] };
  assert.equal(profile.anonymousMode, true);
  assert.equal(profile.mmr, null);
  assert.equal(profile.statistics, null);
  assert.deepEqual(profile.history, []);
});
