import assert from "node:assert/strict";
import test from "node:test";
const authValidationUrl = new URL(
  "../lib/ranked/auth-validation.ts",
  import.meta.url,
);
const { getSafeNextPath, rankedUsernameSchema } = (await import(
  authValidationUrl.href
)) as typeof import("../lib/ranked/auth-validation");

const profileUrl = new URL("../lib/ranked/profile.ts", import.meta.url);
const { getUsernameChangeAvailableAt, isUsernameChangeAvailable } = (await import(
  profileUrl.href
)) as typeof import("../lib/ranked/profile");

test("next autenticado aceita somente caminhos internos seguros", () => {
  assert.equal(getSafeNextPath("/matchmaking?fila=1"), "/matchmaking?fila=1");
  assert.equal(getSafeNextPath("https://evil.example"), "/conta");
  assert.equal(getSafeNextPath("//evil.example"), "/conta");
  assert.equal(getSafeNextPath("/\\evil.example"), "/conta");
});

test("nome ranked normaliza espaços e aceita caracteres brasileiros", () => {
  const result = rankedUsernameSchema.parse("  João   AXB_01  ");
  assert.equal(result, "João AXB_01");
});

test("nome ranked bloqueia caracteres de controle e nomes fora do limite", () => {
  assert.equal(rankedUsernameSchema.safeParse("ab").success, false);
  assert.equal(rankedUsernameSchema.safeParse("jogador<script>").success, false);
});

test("troca de nome respeita intervalo de três horas", () => {
  const changedAt = "2026-08-08T12:00:00.000Z";
  const profile = { lastUsernameChangedAt: changedAt };
  assert.equal(
    getUsernameChangeAvailableAt(profile)?.toISOString(),
    "2026-08-08T15:00:00.000Z",
  );
  assert.equal(
    isUsernameChangeAvailable(profile, Date.parse("2026-08-08T14:59:59.999Z")),
    false,
  );
  assert.equal(
    isUsernameChangeAvailable(profile, Date.parse("2026-08-08T15:00:00.000Z")),
    true,
  );
});
