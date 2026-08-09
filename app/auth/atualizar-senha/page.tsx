import { AuthConfigNotice } from "@/components/auth/config-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/password-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPrivatePageMetadata } from "@/lib/ranked/auth-metadata";

export const metadata = createPrivatePageMetadata(
  "Atualizar senha",
  "Defina uma nova senha segura para sua conta ranked AXB.",
);

export default function UpdatePasswordPage() {
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      kicker="Conta AXB • Segurança"
      title="Nova senha"
      description="Escolha uma senha com pelo menos oito caracteres para recuperar o acesso à sua conta."
    >
      {!configured && <AuthConfigNotice />}
      <UpdatePasswordForm configured={configured} />
    </AuthShell>
  );
}
