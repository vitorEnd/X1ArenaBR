import { redirect } from "next/navigation";
import { AuthConfigNotice } from "@/components/auth/config-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import { ProfileOnboardingForm } from "@/components/auth/account-forms";
import { getAuthContext } from "@/lib/ranked/auth";
import { getSafeNextPath } from "@/lib/ranked/auth-validation";
import { createPrivatePageMetadata } from "@/lib/ranked/auth-metadata";

export const metadata = createPrivatePageMetadata(
  "Criar perfil ranked",
  "Escolha seu nome público para entrar no matchmaking da AXB.",
);

export default async function RankedProfileOnboardingPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string }>;
}) {
  const { next: requestedNext } = await searchParams;
  const next = getSafeNextPath(requestedNext, "/matchmaking");
  const context = await getAuthContext();

  if (!context.configured) {
    return (
      <AuthShell
        kicker="Ranked AXB • Configuração"
        title="Prepare seu perfil"
        description="A conexão com o banco precisa ser configurada antes de criar um perfil ranked real."
      >
        <AuthConfigNotice />
      </AuthShell>
    );
  }
  if (!context.user) {
    redirect(`/auth/entrar?next=${encodeURIComponent("/conta/perfil")}`);
  }
  if (context.profile) redirect(next);

  return (
    <AuthShell
      kicker="Ranked AXB • Identidade"
      title="Escolha seu nome"
      description="Este será seu nome público no lobby, na fila, no ranking e no histórico de partidas."
    >
      <ProfileOnboardingForm next={next} />
    </AuthShell>
  );
}
