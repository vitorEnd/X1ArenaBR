import assert from "node:assert/strict";
import test from "node:test";
const avatarUrl = new URL("../lib/ranked/avatar.ts", import.meta.url);
const { AVATAR_MAX_BYTES, getImageDimensions, validateAvatarMetadata } = (await import(
  avatarUrl.href
)) as typeof import("../lib/ranked/avatar");

test("avatar aceita somente PNG, JPEG ou WebP até 5 MB", () => {
  assert.equal(validateAvatarMetadata({ size: 1024, type: "image/png" }), null);
  assert.match(
    validateAvatarMetadata({ size: AVATAR_MAX_BYTES + 1, type: "image/png" }) ?? "",
    /5 MB/,
  );
  assert.match(
    validateAvatarMetadata({ size: 1024, type: "image/svg+xml" }) ?? "",
    /PNG, JPG ou WebP/,
  );
});

test("leitor de PNG obtém dimensões reais do cabeçalho", () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 512);
  view.setUint32(20, 512);
  assert.deepEqual(getImageDimensions(bytes, "image/png"), {
    width: 512,
    height: 512,
  });
});

test("assinatura falsa não é aceita como imagem", () => {
  const bytes = new Uint8Array(32);
  assert.equal(getImageDimensions(bytes, "image/png"), null);
  assert.equal(getImageDimensions(bytes, "image/jpeg"), null);
  assert.equal(getImageDimensions(bytes, "image/webp"), null);
});
