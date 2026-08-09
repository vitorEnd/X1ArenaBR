import { MailCheck } from "lucide-react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth.module.css";
import { createPrivatePageMetadata } from "@/lib/ranked/auth-metadata";

export const metadata = createPrivatePageMetadata(
  "Confirme seu e-mail",
  "Confirme o endereço de e-mail para ativar sua conta ranked AXB.",
);

export default async function VerifyEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthShell
      kicker="Conta AXB • Verificação"
      title="Confira sua caixa de entrada"
      description="Sua conta fica protegida por confirmação de e-mail antes do primeiro acesso."
    >
      <div className={styles.form}>
        <MailCheck size={42} color="#f5b800" aria-hidden="true" />
        <p className={styles.notice} role="status">
          Enviamos as instruções de confirmação
          {email ? ` para ${email}` : " para o endereço informado"}. O link pode
          levar alguns minutos para chegar.
        </p>
        <p className={styles.finePrint}>
          Não encontrou? Confira a caixa de spam. Para sua segurança, esta página
          não confirma se um endereço já possuía cadastro.
        </p>
        <div className={styles.inlineLinks}>
          <Link href="/auth/entrar">Voltar para entrar</Link>
        </div>
      </div>
    </AuthShell>
  );
}
