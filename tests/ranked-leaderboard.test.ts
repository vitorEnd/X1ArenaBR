import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const schema = await readFile(
  new URL("supabase/migrations/202608080001_ranked_schema.sql", root),
  "utf8",
);
const endpoint = await readFile(
  new URL("app/api/ranked/leaderboard/route.ts", root),
  "utf8",
);

test("leaderboard reads the safe all-profile projection", () => {
  assert.match(endpoint, /\.from\("ranked_public_profiles"\)/);
  assert.doesNotMatch(endpoint, /\.from\("ranked_profiles"\)/);
  assert.doesNotMatch(endpoint, /Math\.min\([^\n]*50/);
});

test("public leaderboard cannot expose provisional MMR", () => {
  assert.match(
    schema,
    /case when p\.placement_matches = 5 then p\.mmr else null end as mmr/i,
  );
  assert.doesNotMatch(
    schema.match(/create or replace view public\.ranked_public_profiles[\s\S]*?where p\.banned_at is null;/i)?.[0] ?? "",
    /provisional_mmr/i,
  );
});
