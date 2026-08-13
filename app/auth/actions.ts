"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  emailSchema,
  getFirstFieldError,
  getSafeNextPath,
  loginSchema,
  signupSchema,
  updatePasswordSchema,
} from "@/lib/ranked/auth-validation";
import type { AuthActionState } from "@/lib/ranked/action-state";
import { getSiteOrigin } from "@/lib/ranked/site-url";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function configurationState(): AuthActionState | null {
  if (isSupabaseConfigured()) return null;
  return {
    status: "error",
    message:
      process.env.NODE_ENV === "development"
        ? "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local."
        : "O acesso à ranked está temporariamente indisponível.",
  };
}

function authErrorMessage(message: string): string {
  const normalized = message.toLocaleLowerCase("en-US");
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (normalized.includes("rate limit")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (normalized.includes("provider is not enabled")) {
    return "O login pelo Discord ainda não foi ativado.";
  }
  if (normalized.includes("password should be")) {
    return "A senha não atende aos requisitos de segurança.";
  }
  return "Não foi possível concluir a autenticação. Tente novamente.";
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const configError = configurationState();
  if (configError) return configError;

  const parsed = loginSchema.safeParse({
    email: textValue(formData, "email"),
    password: textValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: getFirstFieldError(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: authErrorMessage(error.message) };

  revalidatePath("/", "layout");
  redirect(getSafeNextPath(textValue(formData, "next")));
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const configError = configurationState();
  if (configError) return configError;

  const parsed = signupSchema.safeParse({
    email: textValue(formData, "email"),
    password: textValue(formData, "password"),
    confirmPassword: textValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: getFirstFieldError(parsed.error.flatten().fieldErrors),
    };
  }

  const origin = await getSiteOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/conta/perfil")}`,
    },
  });

  if (error) return { status: "error", message: authErrorMessage(error.message) };
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/conta/perfil");
  }

  redirect(
    `/auth/verifique-email?email=${encodeURIComponent(parsed.data.email)}`,
  );
}

export async function discordLoginAction(formData: FormData): Promise<void> {
  const configError = configurationState();
  if (configError) redirect("/auth/erro?reason=config");

  const next = getSafeNextPath(textValue(formData, "next"));
  const origin = await getSiteOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: "identify email",
    },
  });

  if (error || !data.url) {
    redirect(`/auth/erro?reason=${error ? "discord" : "oauth"}`);
  }

  redirect(data.url);
}

export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const configError = configurationState();
  if (configError) return configError;

  const parsed = emailSchema.safeParse(textValue(formData, "email"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const origin = await getSiteOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/atualizar-senha")}`,
  });

  if (error) {
    return { status: "error", message: authErrorMessage(error.message) };
  }

  // Keep the response deliberately identical for registered and unknown emails.
  return {
    status: "success",
    message:
      "Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha.",
  };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const configError = configurationState();
  if (configError) return configError;

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

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      status: "error",
      message: "O link expirou. Solicite uma nova recuperação de senha.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { status: "error", message: authErrorMessage(error.message) };

  revalidatePath("/", "layout");
  redirect("/conta?password=updated");
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}
