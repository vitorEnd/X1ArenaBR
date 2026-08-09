"use server";

import { revalidatePath } from "next/cache";
import {
  getFirstFieldError,
  rankedUsernameSchema,
  updatePasswordSchema,
} from "@/lib/ranked/auth-validation";
import type { AccountActionState } from "@/lib/ranked/action-state";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_DIMENSION,
  getImageDimensions,
  validateAvatarMetadata,
} from "@/lib/ranked/avatar";
import { normalizeRankedProfile } from "@/lib/ranked/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function databaseMessage(message: string, code?: string): string {
  const normalized = message.toLocaleLowerCase("pt-BR");
  if (code === "23505" || normalized.includes("unique")) {
    return "Esse nome ranked já está em uso.";
  }
  if (
    normalized.includes("3 hour") ||
    normalized.includes("3 horas") ||
    normalized.includes("três horas") ||
    normalized.includes("alterado a cada") ||
    normalized.includes("cooldown")
  ) {
    return "Você pode trocar o nome ranked apenas uma vez a cada três horas.";
  }
  if (normalized.includes("not authenticated") || code === "42501") {
    return "Sua sessão expirou. Entre novamente.";
  }
  return "Não foi possível salvar a alteração. Tente novamente.";
}

async function getAuthenticatedClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function createRankedProfileAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = rankedUsernameSchema.safeParse(textValue(formData, "username"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const auth = await getAuthenticatedClient();
  if (!auth) return { status: "error", message: "Entre para criar seu perfil ranked." };

  const { data, error } = await auth.supabase
    .rpc("ranked_create_profile", { p_username: parsed.data })
    .single();

  if (error) {
    return { status: "error", message: databaseMessage(error.message, error.code) };
  }
  if (!normalizeRankedProfile(data)) {
    return { status: "error", message: "O perfil não foi criado corretamente." };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Perfil ranked criado. A Arena está aberta." };
}

export async function updateRankedUsernameAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = rankedUsernameSchema.safeParse(textValue(formData, "username"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const auth = await getAuthenticatedClient();
  if (!auth) return { status: "error", message: "Sua sessão expirou. Entre novamente." };

  const { data, error } = await auth.supabase
    .rpc("ranked_update_username", { p_username: parsed.data })
    .single();

  if (error) {
    return { status: "error", message: databaseMessage(error.message, error.code) };
  }
  if (!normalizeRankedProfile(data)) {
    return { status: "error", message: "O nome não foi atualizado corretamente." };
  }

  revalidatePath("/conta");
  revalidatePath("/ranked", "layout");
  return { status: "success", message: "Nome ranked atualizado." };
}

export async function setAccountPasswordAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: textValue(formData, "password"),
    confirmPassword: textValue(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: getFirstFieldError(parsed.error.flatten().fieldErrors),
    };
  }

  const auth = await getAuthenticatedClient();
  if (!auth) return { status: "error", message: "Sua sessão expirou. Entre novamente." };

  const { error } = await auth.supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      status: "error",
      message: "Não foi possível adicionar ou alterar a senha agora.",
    };
  }

  revalidatePath("/conta");
  return { status: "success", message: "Senha de acesso atualizada." };
}

export async function updateAvatarAction(
  formData: FormData,
): Promise<AccountActionState> {
  const auth = await getAuthenticatedClient();
  if (!auth) return { status: "error", message: "Sua sessão expirou. Entre novamente." };

  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return { status: "error", message: "Escolha uma imagem para o avatar." };
  }

  const metadataError = validateAvatarMetadata(file);
  if (metadataError) return { status: "error", message: metadataError };
  if (file.type !== "image/webp") {
    return {
      status: "error",
      message: "O avatar precisa ser recortado pela página antes do envio.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = getImageDimensions(bytes, file.type);
  if (!dimensions) {
    return { status: "error", message: "O arquivo não contém uma imagem válida." };
  }
  if (dimensions.width !== dimensions.height) {
    return { status: "error", message: "Recorte o avatar no formato quadrado." };
  }
  if (
    dimensions.width > AVATAR_MAX_DIMENSION ||
    dimensions.height > AVATAR_MAX_DIMENSION
  ) {
    return { status: "error", message: "O avatar deve ter no máximo 2048 × 2048 pixels." };
  }

  const { data: currentData } = await auth.supabase
    .rpc("ranked_get_my_profile")
    .maybeSingle();
  const currentProfile = normalizeRankedProfile(currentData);
  if (!currentProfile) {
    return { status: "error", message: "Crie seu perfil ranked antes de enviar um avatar." };
  }

  const contentType = "image/webp";
  const path = `${auth.user.id}/avatar.webp`;
  const { error: uploadError } = await auth.supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType, upsert: true, cacheControl: "3600" });

  if (uploadError) {
    return { status: "error", message: "Não foi possível enviar o avatar." };
  }

  const { error: profileError } = await auth.supabase.rpc(
    "ranked_set_avatar_path",
    { p_avatar_path: path },
  );
  if (profileError) {
    return {
      status: "error",
      message: databaseMessage(profileError.message, profileError.code),
    };
  }

  revalidatePath("/conta");
  revalidatePath("/ranked", "layout");
  return { status: "success", message: "Avatar atualizado." };
}
