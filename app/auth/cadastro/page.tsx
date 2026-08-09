import { redirect } from "next/navigation";
import { AuthConfigNotice } from "@/components/auth/config-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getAuthContext } from "@/lib/ranked/auth";
import { createPrivatePageMetadata } from "@/lib/ranked/auth-metadata";

export const metadata = createPrivatePageMetadata(
  "Criar conta ranked",
  "Crie sua conta para competir no matchmaking ranqueado da AXB.",
);

export default async function SignupPage() {
  const context = await getAuthContext();
  if (context.user) redirect(context.profile ? "/conta" : "/conta/perfil");

  return (
    <AuthShell
      kicker="Ranked AXB • Cadastro"
      title="Seu nome no placar"
      description="Crie uma conta exclusiva para a ranked. Isso não adiciona você aos jogadores ou torneios oficiais da Arena."
    >
      {!context.configured && <AuthConfigNotice />}
      <SignupForm configured={context.configured} />
    </AuthShell>
  );
}
