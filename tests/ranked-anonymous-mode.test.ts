import test from "node:test";
import assert from "node:assert/strict";

test("anonymous leaderboard labels use a stable four-digit number", () => {
  const label = (number: number) => `Anonimo${String(number).padStart(4, "0")}`;
  assert.equal(label(1), "Anonimo0001");
  assert.equal(label(42), "Anonimo0042");
});

test("anonymous profiles hide identity but keep public competitive data", () => {
  const profile = { anonymousMode: true, username: "Anonimo0001", wins: 7, losses: 3, mmr: 1450 };
  assert.equal(profile.anonymousMode, true);
  assert.equal(profile.username, "Anonimo0001");
  assert.equal(profile.wins, 7);
  assert.equal(profile.losses, 3);
  assert.equal(profile.mmr, 1450);
});
