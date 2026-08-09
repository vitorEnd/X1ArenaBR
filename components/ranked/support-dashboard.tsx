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
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  rankedUiAdapter,
  type RankedSupportAccount,
  type RankedSupportIntent,
  type RankedSupportMatch,
  type RankedSupportResponse,
  type RankedUiAdapter,
} from "./adapter";
import { RankEmblem } from "./rank-emblem";
import styles from "./ranked.module.css";
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
  const [selectedMatch, setSelectedMatch] = useState<RankedSupportMatch | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<RankedSupportAccount | null>(null);

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
    const supabase = createClient();
    const channel = supabase
      .channel("ranked-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "ranked_notifications" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ranked_matches" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ranked_queue_entries" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ranked_match_reports" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_audit_log" }, () => void load())
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

  return (
    <>
      {error && <RankedError message={error} onRetry={() => void load()} />}
      <div className={styles.supportStats}>
        <div className={styles.supportStat}><span>Na fila</span><strong>{response.queue.length}</strong></div>
        <div className={styles.supportStat}><span>Lobbies ativos</span><strong>{response.activeLobbies.length}</strong></div>
        <div className={styles.supportStat}><span>Exigem decisão</span><strong>{response.frozenMatches.length}</strong></div>
      </div>

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
    </>
  );
}
