import { CheckCircle2, LogOut, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AccountPasswordForm,
  AvatarUploader,
  AnonymousModeForm,
  DiscordIdentityButton,
  UsernameForm,
} from "@/components/auth/account-forms";
import { AuthConfigNotice } from "@/components/auth/config-notice";
import { AuthShell } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth.module.css";
import { logoutAction } from "@/app/auth/actions";
import { getAuthContext, getLinkedProviders } from "@/lib/ranked/auth";
import { createPrivatePageMetadata } from "@/lib/ranked/auth-metadata";
import { getRankedAvatarUrl } from "@/lib/ranked/profile-server";

export const metadata = createPrivatePageMetadata(
  "Minha conta ranked",
  "Gerencie identidade, avatar e métodos de acesso da sua conta ranked AXB.",
);

function formatAccountDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default async function AccountPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ linked?: string; password?: string }>;
}) {
  const params = await searchParams;
  const context = await getAuthContext();
  if (!context.configured) {
    return (
      <AuthShell
        kicker="Ranked AXB • Conta"
        title="Minha conta"
        description="A área de conta será liberada quando a conexão real com o Supabase estiver configurada."
      >
        <AuthConfigNotice />
      </AuthShell>
    );
  }
  if (!context.user) redirect("/auth/entrar?next=%2Fconta");
  if (!context.profile) redirect("/conta/perfil?next=%2Fconta");

  const providers = getLinkedProviders(context.user);
  const discordConnected = providers.includes("discord");
  const emailConnected = providers.includes("email");
  const avatarUrl = await getRankedAvatarUrl(
    context.profile.avatarPath,
    context.profile.updatedAt,
  );
  const initial = context.profile.username.slice(0, 1).toLocaleUpperCase("pt-BR");
  const placementsFinished = context.profile.placementMatches >= 5;

  return (
    <section className={styles.accountPage}>
      <div className="page-container">
        <header className={styles.accountHeader}>
          <div>
            <p className={styles.kicker}>Ranked AXB • Configurações</p>
            <h1 className={styles.accountTitle}>Minha conta</h1>
            <p className={styles.accountLead}>
              Gerencie sua identidade pública e os métodos usados para entrar. O
              perfil ranked permanece separado dos jogadores dos torneios oficiais.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/matchmaking" className={styles.secondaryButton}>
              Voltar ao matchmaking
            </Link>
            <Link href={`/ranked/${encodeURIComponent(context.profile.username)}`} className={styles.secondaryButton}>
              Ver meu perfil público
            </Link>
            <form action={logoutAction}>
              <button className={styles.danger} type="submit">
                <LogOut size={17} aria-hidden="true" />
                Sair da conta
              </button>
            </form>
          </div>
        </header>

        {((params.linked === "discord" && discordConnected) ||
          (params.password === "updated" && emailConnected)) && (
          <p className={styles.feedback} data-status="success" role="status">
            {params.linked === "discord"
              ? "Discord conectado à mesma conta."
              : "Senha atualizada com segurança."}
          </p>
        )}

        <div className={styles.accountGrid}>
          <article className={`${styles.panel} ${styles.panelWide}`}>
            <div className={styles.profileStrip}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.avatar}
                  src={avatarUrl}
                  alt={`Avatar ranked de ${context.profile.username}`}
                />
              ) : (
                <div className={styles.avatarFallback} aria-label="Avatar padrão">
                  {initial}
                </div>
              )}
              <div>
                <h2 className={styles.profileName}>{context.profile.username}</h2>
                <p className={styles.profileMeta}>
                  Conta criada em {formatAccountDate(context.profile.createdAt)} •{" "}
                  {context.user.email ?? "acesso pelo Discord"}
                </p>
              </div>
            </div>
            <div className={styles.statGrid} style={{ marginTop: 24 }}>
              <div className={styles.stat}>
                <strong>{context.profile.wins}</strong>
                <span>Vitórias</span>
              </div>
              <div className={styles.stat}>
                <strong>{context.profile.losses}</strong>
                <span>Derrotas</span>
              </div>
              <div className={styles.stat}>
                <strong>
                  {placementsFinished ? context.profile.mmr.toLocaleString("pt-BR") : "Oculto"}
                </strong>
                <span>
                  {placementsFinished
                    ? "MMR"
                    : `Colocação ${context.profile.placementMatches}/5`}
                </span>
              </div>
            </div>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Modo Anônimo</h2>
            <p className={styles.panelText}>Oculte seus dados competitivos de qualquer pessoa que não seja você.</p>
            <AnonymousModeForm enabled={context.profile.anonymousMode} />
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Nome ranked</h2>
            <p className={styles.panelText}>
              Usado publicamente no leaderboard, nos lobbies e no histórico.
            </p>
            <UsernameForm currentName={context.profile.username} />
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Avatar próprio</h2>
            <p className={styles.panelText}>
              A imagem é recortada no navegador antes de ser enviada ao armazenamento.
            </p>
            <AvatarUploader key={avatarUrl ?? "empty-avatar"} currentUrl={avatarUrl} />
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Métodos conectados</h2>
            <p className={styles.panelText}>
              Discord e e-mail podem acessar esta mesma conta, sem duplicar o perfil.
            </p>
            <ul className={styles.providerList}>
              <li className={styles.provider}>
                <span>
                  <Mail size={16} aria-hidden="true" /> E-mail e senha
                </span>
                {emailConnected ? (
                  <span className={styles.connected}>
                    <CheckCircle2 size={14} aria-hidden="true" /> Conectado
                  </span>
                ) : (
                  <span className={styles.profileMeta}>Disponível abaixo</span>
                )}
              </li>
              <li className={styles.provider}>
                <span>
                  <ShieldCheck size={16} aria-hidden="true" /> Discord
                </span>
                {discordConnected && (
                  <span className={styles.connected}>
                    <CheckCircle2 size={14} aria-hidden="true" /> Conectado
                  </span>
                )}
              </li>
            </ul>
            <DiscordIdentityButton connected={discordConnected} />
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Senha de acesso</h2>
            <p className={styles.panelText}>
              Adicione uma senha à conta criada pelo Discord ou substitua sua senha atual.
            </p>
            <AccountPasswordForm />
          </article>
        </div>
      </div>
    </section>
  );
}
