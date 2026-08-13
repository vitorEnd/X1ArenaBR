"use client";

import { CalendarDays, ChevronLeft, Gavel, History, Settings, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  rankedUiAdapter,
  type RankedProfileResponse,
  type RankedUiAdapter,
} from "./adapter";
import { PlayerAvatar } from "./player-avatar";
import { RankEmblem, rankedTierLabels } from "./rank-emblem";
import styles from "./ranked.module.css";
import { RankedConfigurationNotice, RankedError, RankedLoading } from "./ui-feedback";

interface RankedProfileViewProps {
  readonly username: string;
  readonly isOwner?: boolean;
  readonly isSupport?: boolean;
  readonly adapter?: RankedUiAdapter;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function RankedProfileView({
  username,
  isOwner = false,
  isSupport = false,
  adapter = rankedUiAdapter,
}: RankedProfileViewProps) {
  const [response, setResponse] = useState<RankedProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await adapter.getProfile(username, signal);
      setResponse(result);
      setError(null);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar este perfil.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [adapter, username]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = setTimeout(() => void load(controller.signal), 0);
    return () => {
      clearTimeout(initialLoad);
      controller.abort();
    };
  }, [load]);

  if (loading && !response) return <RankedLoading label="Carregando perfil Ranked" />;
  if (error && !response) return <RankedError message={error} onRetry={() => void load()} />;
  if (!response?.configured) return <RankedConfigurationNotice />;

  if (!response.profile) {
    return (
      <div className={styles.emptyRanking}>
        <div>
          <ShieldQuestion size={36} aria-hidden="true" />
          <h2>Perfil Ranked não encontrado</h2>
          <p>Confira o nome informado ou volte para a classificação global.</p>
          <Link href="/matchmaking/ranking" className={styles.secondaryButton}>
            <ChevronLeft size={17} aria-hidden="true" /> Voltar ao Top 50
          </Link>
        </div>
      </div>
    );
  }

  const { profile, history } = response;
  const placementActive = profile.placementMatchesPlayed < 5;
  const tierLabel = profile.tier ? rankedTierLabels[profile.tier] : "Em colocação";

  return (
    <>
      {error && <RankedError message={error} onRetry={() => void load()} />}
      <article className={styles.profileHero}>
        <PlayerAvatar src={profile.avatarUrl} name={profile.username} size="lg" />
        <div className={styles.profileMeta}>
          <span className={styles.microLabel}>Perfil público Ranked</span>
          <h1 className={styles.profileName}>{profile.username}</h1>
          <p>
            <CalendarDays size={15} aria-hidden="true" /> Na Arena desde {formatDate(profile.createdAt)}
          </p>
          {isOwner && (
            <div className={styles.actionStack}>
              <Link href="/conta" className={styles.secondaryButton}>
                <Settings size={17} aria-hidden="true" /> Configurações da conta
              </Link>
              {isSupport && (
                <Link href="/suporte" className={styles.primaryButton}>
                  <Gavel size={17} aria-hidden="true" /> Central de suporte
                </Link>
              )}
            </div>
          )}
          <div className={styles.profileStats}>
            <div className={styles.statCell}><span>Vitórias</span><strong>{profile.wins}</strong></div>
            <div className={styles.statCell}><span>Derrotas</span><strong>{profile.losses}</strong></div>
            <div className={styles.statCell}><span>MMR</span><strong>{placementActive ? "Oculto" : profile.mmr?.toLocaleString("pt-BR") ?? "—"}</strong></div>
            <div className={styles.statCell}><span>Posição</span><strong>{profile.globalPosition ? `#${profile.globalPosition}` : "—"}</strong></div>
          </div>
        </div>
        <RankEmblem
          tier={profile.tier}
          size="hero"
          topPosition={profile.globalPosition}
          mmr={profile.mmr}
        />
      </article>

      <section className={styles.contentSection} aria-labelledby="history-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Confrontos confirmados</span>
            <h2 id="history-title" className={styles.sectionTitle}>Histórico <span>Ranked</span></h2>
            <p className={styles.sectionDescription}>
              {placementActive
                ? `Partidas de colocação: ${profile.placementMatchesPlayed}/5. Elo e MMR permanecem ocultos.`
                : `Elo atual: ${tierLabel}. Somente resultados confirmados aparecem neste perfil.`}
            </p>
          </div>
          <Link href="/matchmaking/ranking" className={styles.miniLink}>
            <ChevronLeft size={16} aria-hidden="true" /> Top 50
          </Link>
        </div>

        {history.length > 0 ? (
          <div className={styles.historyList}>
            {history.map((entry) => (
              <article key={entry.id} className={styles.historyCard}>
                <span className={`${styles.historyResult} ${entry.outcome === "win" ? styles.positive : styles.negative}`}>
                  {entry.outcome === "win" ? "V" : "D"}
                </span>
                <div className={styles.historyOpponent}>
                  <PlayerAvatar src={entry.opponentAvatarUrl} name={entry.opponentUsername} size="sm" />
                  <div><strong>{entry.opponentUsername}</strong><small>Match #{entry.matchNumber}</small></div>
                </div>
                <strong className={styles.historyScore}>
                  {entry.method === "walkover" || entry.ownGoals === null || entry.opponentGoals === null
                    ? "W.O."
                    : `${entry.ownGoals} × ${entry.opponentGoals}`}
                </strong>
                <div className={styles.historyMeta}>
                  <strong
                    className={
                      entry.mmrChange === null
                        ? undefined
                        : entry.mmrChange >= 0
                          ? styles.positive
                          : styles.negative
                    }
                  >
                    {entry.mmrChange === null
                      ? "MMR oculto"
                      : `${entry.mmrChange > 0 ? "+" : ""}${entry.mmrChange} MMR`}
                  </strong>
                  <span className={styles.historyTierChange}>
                    {entry.previousTier ? rankedTierLabels[entry.previousTier] : "Colocação"}
                    {" → "}
                    {entry.nextTier ? rankedTierLabels[entry.nextTier] : "Colocação"}
                  </span>
                  <small>
                    {entry.resolutionSource === "support" ? "Decisão do suporte • " : ""}
                    {formatDate(entry.confirmedAt)}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyRanking}>
            <div>
              <History size={34} aria-hidden="true" />
              <h2>Nenhum confronto confirmado</h2>
              <p>O histórico será preenchido depois do primeiro resultado válido deste jogador.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
