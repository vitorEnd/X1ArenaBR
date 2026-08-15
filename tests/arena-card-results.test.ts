import assert from "node:assert/strict";
import test from "node:test";
import {
  canAddArenaCardMatch,
  hasCompleteArenaCardResults,
} from "../lib/arena-card-results.ts";

test("permite adicionar confrontos enquanto o card está ao vivo", () => {
  assert.equal(canAddArenaCardMatch("live"), true);
  assert.equal(canAddArenaCardMatch("finished"), false);
});

test("rejeita placares incompletos ou empatados para a finalização do card", () => {
  const matches = [{ id: "m1" }, { id: "m2" }];

  assert.equal(
    hasCompleteArenaCardResults(matches, {
      m1: { a: "2", b: "1" },
      m2: { a: "0", b: "" },
    }),
    false,
  );

  assert.equal(
    hasCompleteArenaCardResults(matches, {
      m1: { a: "2", b: "1" },
      m2: { a: "1", b: "1" },
    }),
    false,
  );

  assert.equal(
    hasCompleteArenaCardResults(matches, {
      m1: { a: "2", b: "1" },
      m2: { a: "3", b: "0" },
    }),
    true,
  );
});
