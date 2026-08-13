import assert from "node:assert/strict";
import test from "node:test";
import { normalizePublicQueueCount } from "../lib/ranked/public-queue-status.ts";

test("normalizes the public queue count without exposing invalid values", () => {
  assert.equal(normalizePublicQueueCount(4), 4);
  assert.equal(normalizePublicQueueCount("3"), 3);
  assert.equal(normalizePublicQueueCount(-2), 0);
  assert.equal(normalizePublicQueueCount(Number.NaN), 0);
  assert.equal(normalizePublicQueueCount("private-mmr"), 0);
});

