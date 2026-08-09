import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth.module.css";
import { createPrivatePageMetadata } from "@/lib/ranked/auth-metadata";

export const metadata = createPrivatePageMetadata(
  "Falha no acesso",
  "Não foi possível concluir a autenticação da conta ranked AXB.",
);

const messages: Record<string, string> = {
  config:
    process.env.NODE_ENV === "development"
      ? "A autenticação ainda não foi configurada neste ambiente. Preencha as variáveis do Supabase antes de testar o acesso."
      : "O acesso à ranked está temporariamente indisponível.",
  discord:
    "O Discord não concluiu a autorização. Verifique a configuração do provedor e tente novamente.",
  callback:
    "O link de autenticação expirou ou já foi utilizado. Inicie o acesso novamente.",
  confirmation:
    "O link de confirmação expirou ou é inválido. Solicite um novo acesso.",
  oauth: "O provedor de acesso não retornou uma autorização válida.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = messages[reason ?? ""] ?? "Não foi possível concluir o acesso.";
  return (
    <AuthShell
      kicker="Conta AXB • Segurança"
      title="Acesso não concluído"
      description="Nenhuma sessão foi criada. Você pode retornar e tentar novamente com segurança."
    >
      <div className={styles.form}>
        <CircleAlert size={42} color="#f5b800" aria-hidden="true" />
        <p className={styles.feedback} data-status="error" role="alert">
          {message}
        </p>
        <Link href="/auth/entrar" className={styles.submit}>
          Voltar para entrar
        </Link>
      </div>
    </AuthShell>
  );
}
