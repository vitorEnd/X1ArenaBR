"use client";

import {
  Activity,
  Clock3,
  Gavel,
  History,
  LockKeyhole,
  Search,
  ShieldOff,
  Swords,
  Trash2,
  UserCog,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  rankedUiAdapter,
  type RankedSupportAccount,
  type RankedSupportHistoryMatch,
  type RankedSupportIntent,
  type RankedSupportMatch,
  type RankedSupportResponse,
  type RankedUiAdapter,
} from "./adapter";
import { RankEmblem } from "./rank-emblem";
import styles from "./ranked.module.css";
import { ArenaCardManager } from "./arena-card-manager";
import { OfficialPlayerNicknameManager } from "./official-player-nickname-manager";
import { SupportActionDialog } from "./support-action-dialog";
import { RankedConfigurationNotice, RankedError, RankedLoading } from "./ui-feedback";

interface SupportDashboardProps {
  readonly adapter?: RankedUiAdapter;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function SupportDashboard({ adapter = rankedUiAdapter }: SupportDashboardProps) {
  const [response, setResponse] = useState<RankedSupportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountQuery, setAccountQuery] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<
    RankedSupportMatch | RankedSupportHistoryMatch | null
  >(null);
  const [selectedAccount, setSelectedAccount] = useState<RankedSupportAccount | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await adapter.getSupport(accountQuery.trim(), signal);
      setResponse(result);
      setError(null);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Não foi possível abrir a central de suporte.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accountQuery, adapter]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = setTimeout(() => void load(controller.signal), 250);
    return () => {
      clearTimeout(initialLoad);
      controller.abort();
    };
  }, [load]);

  useEffect(() => {
    if (!response?.configured || !response.authorized) return;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      const fallback = setInterval(() => void load(), 15_000);
      return () => clearInterval(fallback);
    }
    const channel = supabase
      .channel("ranked-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "ranked_notifications" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ranked_matches" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ranked_queue_entries" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ranked_match_reports" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_audit_log" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "arena_cards" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "arena_card_matches" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "arena_player_nicknames" }, () => void load())
      .subscribe();
    const fallback = setInterval(() => void load(), 15_000);
    return () => {
      clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [load, response?.authorized, response?.configured]);

  const mutate = async (payload: RankedSupportIntent) => {
    setBusy(true);
    setError(null);
    try {
      const result = await adapter.updateSupport(payload);
      if (!result.ok) throw new Error(result.message);
      await load();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "A ação não pôde ser concluída.");
      throw mutationError;
    } finally {
      setBusy(false);
    }
  };

  const resetRanked = async () => {
    try {
      await mutate({ intent: "reset-ranked", password: resetPassword });
      setResetPassword("");
      setResetOpen(false);
    } catch {
      // O erro seguro do servidor já aparece no painel.
    }
  };

  if (loading && !response) return <RankedLoading label="Abrindo central do suporte" />;
  if (error && !response) return <RankedError message={error} onRetry={() => void load()} />;
  if (!response?.configured) return <RankedConfigurationNotice />;

  if (!response.authenticated) {
    return (
      <div className={styles.feedbackPanel}>
        <LockKeyhole aria-hidden="true" />
        <div><span className={styles.microLabel}>Área restrita</span><h2>Identificação necessária</h2><p>Entre com uma conta autorizada para abrir a central.</p></div>
        <Link href="/auth/entrar?next=/suporte" className={styles.primaryButton}>Entrar</Link>
      </div>
    );
  }

  if (!response.authorized) {
    return (
      <div className={styles.feedbackPanel} role="alert">
        <ShieldOff aria-hidden="true" />
        <div><span className={styles.microLabel}>Acesso protegido</span><h2>Conta sem permissão de suporte</h2><p>A lista segura de IDs é definida apenas na configuração privada do projeto.</p></div>
      </div>
    );
  }

  const matchHistory = response.matchHistory ?? [];

  return (
    <>
      {error && <RankedError message={error} onRetry={() => void load()} />}
      <div className={styles.supportToolbar}>
        <div className={styles.pointsMultiplierControl}>
          <span><Zap size={16} aria-hidden="true" /> Pontos Ranked</span>
          <div role="group" aria-label="Multiplicador de pontos Ranked">
            {([1, 2, 3] as const).map((multiplier) => (
              <button
                key={multiplier}
                type="button"
                className={
                  response.pointsMultiplier === multiplier
                    ? styles.pointsMultiplierActive
                    : styles.pointsMultiplierButton
                }
                aria-pressed={response.pointsMultiplier === multiplier}
                disabled={busy || response.pointsMultiplier === multiplier}
                onClick={() => void mutate({
                  intent: "set-ranked-points-multiplier",
                  multiplier,
                }).catch(() => undefined)}
              >
                {multiplier}x
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => {
            setError(null);
            setResetPassword("");
            setResetOpen(true);
          }}
        >
          <Trash2 size={16} aria-hidden="true" /> Resetar ranked
        </button>
      </div>
      <div className={styles.supportStats}>
        <div className={styles.supportStat}><span>Na fila</span><strong>{response.queue.length}</strong></div>
        <div className={styles.supportStat}><span>Lobbies ativos</span><strong>{response.activeLobbies.length}</strong></div>
        <div className={styles.supportStat}><span>Exigem decisão</span><strong>{response.frozenMatches.length}</strong></div>
        <div className={styles.supportStat}><span>Partidas em 24h</span><strong>{matchHistory.length}</strong></div>
      </div>

      <OfficialPlayerNicknameManager
        players={response.officialPlayers}
        busy={busy}
        onSubmit={mutate}
      />

      <ArenaCardManager cards={response.arenaCards} busy={busy} onSubmit={mutate} />

      <section className={`${styles.supportPanel} ${styles.supportHistoryPanel}`} aria-labelledby="match-history-title">
        <span className={styles.microLabel}>Janela móvel de 24 horas</span>
        <h2 id="match-history-title">Histórico de partidas</h2>
        <p className={styles.supportPanelDescription}>
          Partidas confirmadas saem automaticamente desta lista após 24 horas.
        </p>
        <div className={styles.supportHistoryList}>
          {matchHistory.length > 0 ? matchHistory.map((match) => (
            <article key={match.id} className={styles.supportItem}>
              <div className={styles.supportItemHeader}>
                <strong>Match #{match.matchNumber}</strong>
                <span className={styles.statusPill}>{formatDate(match.confirmedAt)}</span>
              </div>
              <p>{match.playerA.username} {match.submittedScore?.playerAGoals ?? "—"} × {match.submittedScore?.playerBGoals ?? "—"} {match.playerB.username}</p>
              <p>MMR atual: {match.playerA.username} {match.playerACurrentMmr} • {match.playerB.username} {match.playerBCurrentMmr}</p>
              <button type="button" className={styles.secondaryButton} onClick={() => setSelectedMatch(match)}>
                <Gavel size={16} aria-hidden="true" /> Corrigir resultado e MMR
              </button>
            </article>
          )) : <div className={styles.emptyCompact}>Nenhuma partida confirmada nas últimas 24 horas.</div>}
        </div>
      </section>

      <div className={styles.supportGrid}>
        <section className={styles.supportPanel} aria-labelledby="frozen-title">
          <span className={styles.microLabel}>Prioridade</span>
          <h2 id="frozen-title">Partidas congeladas</h2>
          <div className={styles.supportList}>
            {response.frozenMatches.length > 0 ? response.frozenMatches.map((match) => (
              <article key={match.id} className={styles.supportItem}>
                <div className={styles.supportItemHeader}>
                  <strong>Match #{match.matchNumber} • {match.playerA.username} × {match.playerB.username}</strong>
                  <span className={styles.statusPill}>{match.state}</span>
                </div>
                <p><b>{match.reportCategory ?? "Prazo ou fluxo interrompido"}</b>{match.reportObservation ? ` — ${match.reportObservation}` : ""}</p>
                {match.submittedScore && (
                  <p>
                    Placar enviado: {match.playerA.username} {match.submittedScore.playerAGoals}
                    {" × "}{match.submittedScore.playerBGoals} {match.playerB.username}
                  </p>
                )}
                <p>Congelada em {formatDate(match.frozenAt)}</p>
                <div className={styles.actionStack}>
                  <button type="button" className={styles.primaryButton} onClick={() => setSelectedMatch(match)}>
                    <Gavel size={16} aria-hidden="true" /> Analisar e decidir
                  </button>
                </div>
              </article>
            )) : <div className={styles.emptyCompact}>Nenhuma partida aguarda decisão.</div>}
          </div>
        </section>

        <aside className={styles.supportPanel} aria-labelledby="queue-live-title">
          <span className={styles.microLabel}>Tempo real</span>
          <h2 id="queue-live-title">Fila ao vivo</h2>
          <div className={styles.supportList}>
            {response.queue.length > 0 ? response.queue.map((entry) => (
              <div key={entry.profileId} className={styles.supportItem}>
                <div className={styles.supportItemHeader}>
                  <strong>{entry.username}</strong>
                  <RankEmblem tier={entry.tier} size="sm" showLabel={false} />
                </div>
                <p><Clock3 size={14} aria-hidden="true" /> entrou às {formatDate(entry.joinedAt)}</p>
              </div>
            )) : <div className={styles.emptyCompact}>A fila global está vazia.</div>}
          </div>
        </aside>

        <section className={styles.supportPanel} aria-labelledby="accounts-title">
          <span className={styles.microLabel}>Contas Ranked</span>
          <h2 id="accounts-title">Gerenciar jogadores</h2>
          <div className={styles.searchField}>
            <Search size={17} aria-hidden="true" />
            <label className="sr-only" htmlFor="support-account-search">Buscar conta</label>
            <input id="support-account-search" type="search" value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder="Buscar conta carregada" />
          </div>
          <div className={styles.supportList}>
            {response.accounts.length > 0 ? response.accounts.map((account) => (
              <article key={account.profileId} className={styles.supportItem}>
                <div className={styles.supportItemHeader}>
                  <strong>{account.username}</strong>
                  <span className={styles.statusPill}>{account.banned ? "Banido" : account.frozen ? "Congelado" : "Ativo"}</span>
                </div>
                <p>MMR: {account.mmr?.toLocaleString("pt-BR") ?? "oculto"} • {account.usernameHistory.length} alteração(ões) de nome</p>
                {(account.banned || account.frozen) && account.penaltyExpiresAt && (
                  <p>Restrição programada até {formatDate(account.penaltyExpiresAt)}.</p>
                )}
                {account.usernameHistory.length > 0 && (
                  <details className={styles.usernameHistory}>
                    <summary>Consultar histórico de nomes</summary>
                    <ul>
                      {account.usernameHistory.map((item) => (
                        <li key={`${item.changedAt}-${item.previousUsername}`}>
                          <span>{item.previousUsername}</span>
                          <strong>→ {item.nextUsername}</strong>
                          <small>{formatDate(item.changedAt)}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className={styles.actionStack}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setSelectedAccount(account)}>
                    <UserCog size={16} aria-hidden="true" /> Gerenciar
                  </button>
                </div>
              </article>
            )) : <div className={styles.emptyCompact}>Nenhuma conta encontrada.</div>}
          </div>
        </section>

        <aside className={styles.supportPanel} aria-labelledby="live-lobbies-title">
          <span className={styles.microLabel}>Monitoramento</span>
          <h2 id="live-lobbies-title">Lobbies ativos</h2>
          <div className={styles.supportList}>
            {response.activeLobbies.length > 0 ? response.activeLobbies.map((match) => (
              <article key={match.id} className={styles.supportItem}>
                <div className={styles.supportItemHeader}><strong>Match #{match.matchNumber}</strong><span className={styles.statusPill}>{match.state}</span></div>
                <p>{match.playerA.username} × {match.playerB.username}</p>
                <button type="button" className={styles.secondaryButton} onClick={() => setSelectedMatch(match)}>
                  <Gavel size={16} aria-hidden="true" /> {match.state === "lobby" ? "Iniciar ou intervir" : "Intervir no lobby"}
                </button>
              </article>
            )) : <div className={styles.emptyCompact}>Nenhum lobby em andamento.</div>}
          </div>
        </aside>

        <section className={styles.supportPanel} aria-labelledby="audit-title">
          <span className={styles.microLabel}>Rastreabilidade</span>
          <h2 id="audit-title">Auditoria recente</h2>
          <div className={styles.auditList}>
            {response.audit.length > 0 ? response.audit.map((entry) => (
              <div key={entry.id} className={styles.auditItem}>
                <div><strong>{entry.action}</strong><small>{entry.targetLabel} • {formatDate(entry.createdAt)}</small></div>
              </div>
            )) : <div className={styles.emptyCompact}>Nenhuma ação registrada.</div>}
          </div>
        </section>

        <aside className={styles.supportPanel} aria-label="Garantias operacionais">
          <span className={styles.microLabel}>Central protegida</span>
          <h2>Operação AXB</h2>
          <div className={styles.supportList}>
            <div className={styles.supportItem}><Activity aria-hidden="true" /><p>Atualizações privadas em tempo real, com reconciliação periódica.</p></div>
            <div className={styles.supportItem}><History aria-hidden="true" /><p>Toda decisão registra estado anterior, posterior, responsável e horário.</p></div>
            <div className={styles.supportItem}><Users aria-hidden="true" /><p>Ranked e jogadores dos torneios permanecem sistemas separados.</p></div>
            <div className={styles.supportItem}><Swords aria-hidden="true" /><p>Uma conta ocupa apenas uma fila ou lobby por vez.</p></div>
          </div>
        </aside>
      </div>

      {(selectedMatch || selectedAccount) && (
        <SupportActionDialog
          match={selectedMatch}
          account={selectedAccount}
          busy={busy}
          onClose={() => {
            setSelectedMatch(null);
            setSelectedAccount(null);
          }}
          onSubmit={mutate}
        />
      )}

      {resetOpen && (
        <div className={styles.dialogBackdrop} role="presentation">
          <section className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="reset-ranked-title">
            <div className={styles.formDialogHeader}>
              <div>
                <span className={styles.microLabel}>Ação irreversível</span>
                <h2 id="reset-ranked-title">Resetar toda a Ranked?</h2>
              </div>
              <button type="button" className={styles.iconButton} disabled={busy} onClick={() => setResetOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className={styles.formGrid}>
              <p className={styles.formHint}>
                Contas, nomes e avatares serão preservados. Partidas, vitórias, derrotas, colocações e MMR serão zerados.
              </p>
              <div className={styles.field}>
                <label htmlFor="ranked-reset-password">Senha de confirmação</label>
                <input
                  id="ranked-reset-password"
                  type="password"
                  autoComplete="off"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
              </div>
              {error && <p className={styles.formError} role="alert">{error}</p>}
              <button type="button" className={styles.dangerButton} disabled={busy || resetPassword.length === 0} onClick={() => void resetRanked()}>
                <Trash2 size={17} aria-hidden="true" /> Confirmar reset da Ranked
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
