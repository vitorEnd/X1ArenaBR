import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationRoot = new URL("../supabase/migrations/", import.meta.url);
const schema = await readFile(new URL("202608080001_ranked_schema.sql", migrationRoot), "utf8");
const rpcs = await readFile(new URL("202608080002_ranked_rpcs.sql", migrationRoot), "utf8");
const security = await readFile(new URL("202608080003_ranked_security.sql", migrationRoot), "utf8");
const temporaryBans = await readFile(
  new URL("202608130008_ranked_temporary_support_bans.sql", migrationRoot),
  "utf8",
);
const supportStartMatch = await readFile(
  new URL("202608140015_ranked_support_start_match.sql", migrationRoot),
  "utf8",
);
const funMmrRewards = await readFile(
  new URL("202608140016_ranked_fun_mmr_rewards.sql", migrationRoot),
  "utf8",
);

test("keeps ranked persistence isolated from official tournament entities", () => {
  const allMigrations = `${schema}\n${rpcs}\n${security}`.toLowerCase();
  assert.doesNotMatch(allMigrations, /references\s+public\.(players|events|matches|champions)\b/);
  assert.match(schema, /ranked-only accounts/i);
});

test("enforces case-insensitive usernames and the three-hour server cooldown", () => {
  assert.match(schema, /username\s+extensions\.citext\s+not null/i);
  assert.match(schema, /ranked_profiles_username_unique/i);
  assert.match(rpcs, /last_username_changed_at \+ interval '3 hours'/i);
  assert.match(schema, /ranked_username_history/i);
});

test("uses database guards for one active match and one MMR result", () => {
  assert.match(schema, /ranked_active_match_players[\s\S]*profile_id uuid primary key/i);
  assert.match(schema, /ranked_mmr_ledger_match_profile_unique/i);
  assert.match(rpcs, /for update of q skip locked/i);
  assert.match(rpcs, /Esta partida já foi contabilizada/i);
});

test("stores all authoritative deadlines and reconciles them server-side", () => {
  for (const field of [
    "accept_deadline",
    "heartbeat_at",
    "score_deadline",
    "confirmation_deadline",
  ]) {
    assert.match(`${schema}\n${rpcs}`, new RegExp(field, "i"));
  }
  assert.match(rpcs, /create or replace function public\.ranked_reconcile\(\)/i);
  assert.match(rpcs, /auto_approved/i);
});

test("does not grant clients direct ranked writes", () => {
  assert.doesNotMatch(security, /grant\s+(insert|update|delete|all)[^;]+authenticated/i);
  assert.match(security, /enable row level security/gi);
  assert.match(security, /grant execute on function public\.ranked_submit_score/i);
  assert.match(security, /grant execute on function public\.ranked_support_resolve_match/i);
});

test("protects lobby passwords with participant RLS and publishes realtime state", () => {
  assert.match(security, /auth\.uid\(\) in \(player_one_id, player_two_id\)/i);
  assert.match(security, /alter publication supabase_realtime add table/i);
  assert.doesNotMatch(schema, /room_password[\s\S]{0,400}ranked_public_match_history/i);
});

test("persists an idempotent per-player post-match choice before requeueing", () => {
  assert.match(schema, /create table if not exists public\.ranked_post_match_choices/i);
  assert.match(schema, /unique \(match_id, profile_id\)/i);
  assert.match(rpcs, /create or replace function public\.ranked_acknowledge_post_match/i);
  assert.match(rpcs, /on conflict \(match_id, profile_id\) do nothing/i);
  assert.match(rpcs, /perform public\.ranked_join_queue\(\)/i);
});

test("limits avatar storage to one canonical WebP object per account", () => {
  assert.match(schema, /avatar_path = id::text \|\| '\/avatar\.webp'/i);
  assert.match(security, /name = auth\.uid\(\)::text \|\| '\/avatar\.webp'/i);
  assert.match(security, /array\['image\/webp'\]/i);
});

test("limits manual support bans to 100 hours and expires their profile guard", () => {
  assert.match(
    temporaryBans,
    /v_action = 'ban'[\s\S]*p_duration_seconds > 360000/i,
  );
  assert.match(
    temporaryBans,
    /values \(p_profile_id, 'ban',[\s\S]*v_ends_at, v_support_id\)/i,
  );
  assert.match(
    temporaryBans,
    /set banned_at = null, ban_reason = null[\s\S]*pen\.kind = 'ban'[\s\S]*pen\.ends_at > clock_timestamp\(\)/i,
  );
  assert.match(temporaryBans, /v_action = 'unban'/i);
});

test("keeps every support RPC unavailable to anonymous callers", () => {
  for (const signature of [
    "ranked_is_support\\(uuid\\)",
    "ranked_support_resolve_match\\(uuid, text, integer, integer, uuid, text\\)",
    "ranked_support_adjust_mmr\\(uuid, integer, text\\)",
    "ranked_support_manage_profile\\(uuid, text, integer, text\\)",
  ]) {
    assert.match(
      temporaryBans,
      new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon`, "i"),
    );
  }
});

test("allows only authenticated support to start a stalled lobby", () => {
  assert.match(supportStartMatch, /if not public\.ranked_is_support\(v_support_id\)/i);
  assert.match(supportStartMatch, /v_match\.status <> 'lobby'/i);
  assert.match(supportStartMatch, /set status = 'in_progress'/i);
  assert.match(
    supportStartMatch,
    /revoke all on function public\.ranked_support_start_match\(uuid, text\) from public, anon/i,
  );
  assert.match(
    supportStartMatch,
    /grant execute on function public\.ranked_support_start_match\(uuid, text\) to authenticated/i,
  );
});

test("persists asymmetric fun MMR rewards in the authoritative database", () => {
  assert.match(funMmrRewards, /v_winner_gain := greatest\([\s\S]*30[\s\S]*least\(40/i);
  assert.match(funMmrRewards, /v_loser_loss := greatest\([\s\S]*10[\s\S]*least\(15/i);
  assert.match(funMmrRewards, /v_winner\.mmr \+ v_winner_gain/i);
  assert.match(funMmrRewards, /v_loser\.mmr - v_loser_loss/i);
});
