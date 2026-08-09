import { AuthConfigNotice } from "@/components/auth/config-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordResetRequestForm } from "@/components/auth/password-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPrivatePageMetadata } from "@/lib/ranked/auth-metadata";

export const metadata = createPrivatePageMetadata(
  "Recuperar senha",
  "Solicite um link seguro para recuperar sua conta ranked AXB.",
);

export default function ForgotPasswordPage() {
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      kicker="Conta AXB • Recuperação"
      title="Recupere seu acesso"
      description="Informe o e-mail da conta. Se ele estiver cadastrado, você receberá um link seguro para escolher uma nova senha."
    >
      {!configured && <AuthConfigNotice />}
      <PasswordResetRequestForm configured={configured} />
    </AuthShell>
  );
}
