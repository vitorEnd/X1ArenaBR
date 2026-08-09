import { redirect } from "next/navigation";
import { AuthConfigNotice } from "@/components/auth/config-notice";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAuthContext } from "@/lib/ranked/auth";
import { getSafeNextPath } from "@/lib/ranked/auth-validation";
import { createPrivatePageMetadata } from "@/lib/ranked/auth-metadata";

export const metadata = createPrivatePageMetadata(
  "Entrar na ranked",
  "Acesse sua conta da ranked AXB por Discord ou e-mail.",
);

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = getSafeNextPath(params.next);
  const context = await getAuthContext();
  if (context.user) redirect(next);

  return (
    <AuthShell
      kicker="Ranked AXB • Acesso"
      title="Entre na Arena"
      description="Use Discord ou e-mail para acessar seu perfil, entrar na fila global e acompanhar sua evolução."
    >
      {!context.configured && <AuthConfigNotice />}
      <LoginForm configured={context.configured} next={next} />
    </AuthShell>
  );
}
