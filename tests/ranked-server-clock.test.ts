import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateServerClockOffset,
  getAuthoritativeNow,
  getRemainingSeconds,
} from "../lib/ranked/server-clock.ts";

test("compensates a browser clock that is 45 seconds ahead", () => {
  const requestStartedAt = Date.parse("2026-08-13T15:22:29.900Z");
  const responseReceivedAt = Date.parse("2026-08-13T15:22:30.100Z");
  const serverNow = "2026-08-13T15:21:45.000Z";

  const offset = calculateServerClockOffset(
    serverNow,
    requestStartedAt,
    responseReceivedAt,
  );
  const authoritativeNow = getAuthoritativeNow(responseReceivedAt, offset);

  assert.equal(offset, -45_000);
  assert.equal(
    getRemainingSeconds("2026-08-13T15:22:00.000Z", authoritativeNow),
    15,
  );
});

test("returns zero after the authoritative deadline and ignores invalid clocks", () => {
  assert.equal(
    getRemainingSeconds(
      "2026-08-13T15:22:00.000Z",
      Date.parse("2026-08-13T15:22:00.001Z"),
    ),
    0,
  );
  assert.equal(calculateServerClockOffset("invalid", 1_000, 1_200), 0);
});
