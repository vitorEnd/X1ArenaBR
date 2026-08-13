import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../lib/ranked/profile-statistics.ts", import.meta.url);
const { calculateRankedProfileStatistics } = (
  await import(moduleUrl.href)
) as typeof import("../lib/ranked/profile-statistics");

test("calcula gols, win rate e adversários apenas com os confrontos recebidos", () => {
  const result = calculateRankedProfileStatistics([
    { opponentUsername: "Rival A", opponentAvatarUrl: "/a.webp", ownGoals: 4, opponentGoals: 1, outcome: "win" },
    { opponentUsername: "Rival A", opponentAvatarUrl: "/a.webp", ownGoals: null, opponentGoals: null, outcome: "win" },
    { opponentUsername: "Rival B", opponentAvatarUrl: null, ownGoals: 1, opponentGoals: 3, outcome: "loss" },
    { opponentUsername: "Rival B", opponentAvatarUrl: null, ownGoals: 2, opponentGoals: 5, outcome: "loss" },
    { opponentUsername: "Rival C", opponentAvatarUrl: null, ownGoals: 2, opponentGoals: 0, outcome: "win" },
  ]);

  assert.deepEqual(result, {
    matches: 5,
    wins: 3,
    losses: 2,
    goalsFor: 9,
    goalsAgainst: 9,
    goalDifference: 0,
    winRate: 60,
    mostBeatenOpponent: { username: "Rival A", avatarUrl: "/a.webp", matches: 2 },
    mostLostToOpponent: { username: "Rival B", avatarUrl: null, matches: 2 },
  });
});

test("W.O. conta na campanha sem inventar gols e estado vazio é explícito", () => {
  const walkover = calculateRankedProfileStatistics([
    { opponentUsername: "Rival", opponentAvatarUrl: null, ownGoals: null, opponentGoals: null, outcome: "win" },
  ]);
  assert.equal(walkover.wins, 1);
  assert.equal(walkover.goalsFor, 0);
  assert.equal(walkover.goalsAgainst, 0);

  assert.deepEqual(calculateRankedProfileStatistics([]), {
    matches: 0,
    wins: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    winRate: null,
    mostBeatenOpponent: null,
    mostLostToOpponent: null,
  });
});
