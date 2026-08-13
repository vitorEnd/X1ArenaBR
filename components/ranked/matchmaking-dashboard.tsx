"use client";

import {
  ArrowRight,
  Clock3,
  Crosshair,
  Gamepad2,
  Gauge,
  History,
  LockKeyhole,
  Radio,
  Search,
  ShieldCheck,
  TrendingUp,
  Trophy,
  UserRoundCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { MatchFoundDialog } from "./match-found-dialog";
import { MatchLobby } from "./match-lobby";
import { RankEmblem, rankedTierLabels } from "./rank-emblem";
import styles from "./ranked.module.css";
import {
  RankedConfigurationNotice,
  RankedError,
  RankedLoading,
  RankedLoginNotice,
} from "./ui-feedback";
import { useMatchFoundAlert, useMatchmakingLive } from "./use-matchmaking-live";

const rankLadder = [
  "novato",
  "pro",
  "craque",
  "desafiante",
  "immortal",
  "champion",
] as const;

function formatQueueTimer(joinedAt: string | null, now: number) {
  if (!joinedAt) return "00:00";
  const total = Math.max(0, Math.floor((now - new Date(joinedAt).getTime()) / 1_000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatPenalty(expiresAt: string | null, now: number) {
  if (!expiresAt) return null;
  const total = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1_000));
  if (total <= 0) return null;
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatPlayersSearching(total: number) {
  return `${total} ${total === 1 ? "pessoa buscando" : "pessoas buscando"}`;
}

function getRankProgress(
  mmr: number | null,
  globalPosition: number | null,
  placementMatchesPlayed: number,
  placementMatchesRequired: number,
) {
  if (placementMatchesPlayed < placementMatchesRequired || mmr === null) {
    const remaining = Math.max(0, placementMatchesRequired - placementMatchesPlayed);
    return {
      label: `${remaining} ${remaining === 1 ? "partida restante" : "partidas restantes"}`,
      detail: "Seu MMR e Elo serão revelados ao concluir a colocação.",
      progress: (placementMatchesPlayed / placementMatchesRequired) * 100,
    };
  }

  const nextRanks = [
    { min: 800, target: 1_000, label: "Pro" },
    { min: 1_000, target: 1_250, label: "Craque" },
    { min: 1_250, target: 1_800, label: "Desafiante" },
    { min: 1_800, target: 2_100, label: "Immortal" },
    { min: 2_100, target: 2_500, label: "Champion" },
  ] as const;
  const nextRank = nextRanks.find(({ target }) => mmr < target);

  if (nextRank) {
    const missingMmr = nextRank.target - mmr;
    const progress = ((mmr - nextRank.min) / (nextRank.target - nextRank.min)) * 100;
    return {
      label: `${missingMmr.toLocaleString("pt-BR")} MMR para ${nextRank.label}`,
      detail: nextRank.label === "Champion"
        ? "Ao atingir 2.500 MMR, também é preciso estar no Top 10 global."
        : `Próxima faixa começa em ${nextRank.target.toLocaleString("pt-BR")} MMR.`,
      progress: Math.min(100, Math.max(0, progress)),
    };
  }

  if (globalPosition === null || globalPosition > 10) {
    return {
      label: globalPosition
        ? `${globalPosition - 10} ${globalPosition - 10 === 1 ? "posição" : "posições"} para o Top 10`
        : "Entre no Top 10 global",
      detail: "Você já possui 2.500+ MMR. A vaga no Top 10 libera o Elo Champion.",
      progress: 100,
    };
  }

  return {
    label: "Rank máximo alcançado",
    detail: `Você está no TOP ${globalPosition} da Arena.`,
    progress: 100,
  };
}

function DashboardFrame({ children }: { readonly children: ReactNode }) {
  return (
    <section className={styles.contentSectionTight}>
      <div className="page-container">{children}</div>
    </section>
  );
}

export function MatchmakingDashboard() {
  const {
    snapshot,
    loading,
    busy,
    error,
    refresh,
    updateQueue,
    updateMatch,
  } = useMatchmakingLive();
  const [now, setNow] = useState(() => Date.now());
  const foundMatchId = snapshot?.foundMatch?.matchId ?? null;
  const shouldSound = Boolean(snapshot?.foundMatch && !snapshot.foundMatch.ownAccepted);
  const { prepareAlerts } = useMatchFoundAlert(foundMatchId, shouldSound);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const penaltyRemaining = useMemo(
    () => formatPenalty(snapshot?.penalty?.expiresAt ?? null, now),
    [now, snapshot?.penalty?.expiresAt],
  );

  const joinQueue = async () => {
    await prepareAlerts();
    await updateQueue("join");
  };

  if (loading && !snapshot) {
    return <DashboardFrame><RankedLoading label="Abrindo central de matchmaking" /></DashboardFrame>;
  }

  if (error && !snapshot) {
    return <DashboardFrame><RankedError message={error} onRetry={() => void refresh()} /></DashboardFrame>;
  }

  if (!snapshot?.configured) return <DashboardFrame><RankedConfigurationNotice /></DashboardFrame>;
  if (!snapshot.authenticated) return <DashboardFrame><RankedLoginNotice /></DashboardFrame>;

  if (!snapshot.profileComplete || !snapshot.profile) {
    return <DashboardFrame>
      <div className={styles.feedbackPanel}>
        <UserRoundCog aria-hidden="true" />
        <div>
          <span className={styles.microLabel}>Última etapa</span>
          <h2>Crie sua identidade Ranked</h2>
          <p>Escolha seu nome único e avatar antes de entrar na fila global.</p>
        </div>
        <Link href="/conta/perfil" className={styles.primaryButton}>
          Criar perfil <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </DashboardFrame>;
  }

  const { profile, queue, foundMatch, activeMatch, penalty } = snapshot;

  if (activeMatch) {
    return (
      <>
        {error && <div className="page-container"><RankedError message={error} onRetry={() => void refresh()} /></div>}
        <MatchLobby
          match={activeMatch}
          busy={busy}
          onAction={(payload) => updateMatch(activeMatch.matchId, payload)}
        />
      </>
    );
  }

  const placementActive = profile.placementMatchesPlayed < profile.placementMatchesRequired;
  const profileRankLabel =
    profile.tier && profile.mmr !== null
      ? profile.tier === "champion" && profile.globalPosition
        ? `TOP ${profile.globalPosition} • ${profile.mmr.toLocaleString("pt-BR")} MMR`
        : rankedTierLabels[profile.tier]
      : "Em colocação";
  const playersSearching = Math.max(0, queue?.playersSearching ?? 0);
  const rankProgress = getRankProgress(
    profile.mmr,
    profile.globalPosition,
    profile.placementMatchesPlayed,
    profile.placementMatchesRequired,
  );

  if (queue?.state === "searching" || foundMatch) {
    return (
      <section className={styles.contentSectionTight} aria-labelledby="queue-title">
        <div className="page-container">
          {error && <RankedError message={error} onRetry={() => void refresh()} />}
          <div className={styles.queueLayout}>
            <div className={styles.queueStage}>
              <div className={styles.queueTopbar}>
                <span className={styles.livePill}>
                  <span className={styles.liveDot} aria-hidden="true" /> Fila global ativa
                </span>
                <span
                  className={styles.queueCount}
                  aria-label={formatPlayersSearching(playersSearching)}
                  aria-live="polite"
                >
                  <Users size={17} aria-hidden="true" />
                  <strong>{playersSearching}</strong>
                  <span>{playersSearching === 1 ? "pessoa buscando" : "pessoas buscando"}</span>
                </span>
              </div>
              <div className={styles.queueCore}>
                <div className={styles.searchRadar} aria-hidden="true">
                  <span className={styles.searchSweep} />
                  <RankEmblem
                    tier={profile.tier}
                    size="lg"
                    topPosition={profile.globalPosition}
                    mmr={profile.mmr}
                    showLabel={false}
                  />
                </div>
                <div className={styles.queueTimer} aria-label={`Tempo na fila ${formatQueueTimer(queue?.joinedAt ?? null, now)}`}>
                  {formatQueueTimer(queue?.joinedAt ?? null, now)}
                </div>
                <h2 id="queue-title">Buscando adversário</h2>
                <p aria-live="polite">
                  {queue?.searchExpandedAt && now >= new Date(queue.searchExpandedAt).getTime()
                    ? "Busca global expandida: qualquer MMR elegível pode ser encontrado."
                    : "Primeiro minuto: priorizando rivais com MMR próximo ao seu."}
                </p>
                <button type="button" className={styles.dangerButton} disabled={busy || Boolean(foundMatch)} onClick={() => void updateQueue("leave")}>
                  Cancelar busca
                </button>
              </div>
            </div>

            <aside className={styles.queuePlayerPanel} aria-label="Resumo do seu perfil Ranked">
              <span className={styles.microLabel}>Seu painel</span>
              <h2 className={styles.queuePlayerName}>{profile.username}</h2>

              <div className={styles.queuePanelBlock}>
                <span>Ranked atual</span>
                <strong>{profileRankLabel}</strong>
                {!placementActive && profile.mmr !== null && profile.tier !== "champion" && (
                  <small>{profile.mmr.toLocaleString("pt-BR")} MMR</small>
                )}
                {placementActive && <small>MMR oculto durante a colocação</small>}
              </div>

              <div className={styles.queuePanelBlock}>
                <span><History size={15} aria-hidden="true" /> Histórico</span>
                <div className={styles.queueHistoryStats}>
                  <p><strong>{profile.wins}</strong><small>Vitórias</small></p>
                  <p><strong>{profile.losses}</strong><small>Derrotas</small></p>
                </div>
              </div>

              <div className={styles.queuePanelBlock}>
                <span><TrendingUp size={15} aria-hidden="true" /> Próximo rank</span>
                <strong>{rankProgress.label}</strong>
                <small>{rankProgress.detail}</small>
                <div className={styles.queueRankProgress} aria-hidden="true">
                  <span style={{ width: `${rankProgress.progress}%` }} />
                </div>
              </div>

              <Link href={`/ranked/${encodeURIComponent(profile.username)}`} className={styles.quietButton}>
                Ver perfil e histórico <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </div>

        {foundMatch && (
          <MatchFoundDialog
            match={foundMatch}
            profile={profile}
            busy={busy}
            onAccept={() => updateMatch(foundMatch.matchId, { intent: "accept" })}
            onDecline={() => updateMatch(foundMatch.matchId, { intent: "decline" })}
          />
        )}
      </section>
    );
  }

  return (
    <>
      {error && <RankedError message={error} onRetry={() => void refresh()} />}
      <section className={styles.contentSectionTight} aria-label="Painel do jogador">
        <div className="page-container">
          <div className={styles.dashboardGrid}>
            <article className={`${styles.dashboardCard} ${styles.dashboardCardPrimary}`}>
              <div className={styles.dashboardIdentity}>
                <div>
                  <span className={styles.microLabel}>Seu perfil Ranked</span>
                  <div className={styles.identityLine}>
                    <h2>{profile.username}</h2>
                  </div>
                  <p className={styles.placementCopy}>
                    {placementActive
                      ? "Seu MMR permanece oculto até completar as cinco partidas de colocação."
                      : `${profileRankLabel}${profile.mmr !== null ? ` • ${profile.mmr.toLocaleString("pt-BR")} MMR` : ""}`}
                  </p>
                </div>
                <RankEmblem
                  tier={profile.tier}
                  size="hero"
                  topPosition={profile.globalPosition}
                  mmr={profile.mmr}
                />
              </div>

              <div className={styles.statsGrid}>
                <div className={styles.statCell}><span>Vitórias</span><strong>{profile.wins}</strong></div>
                <div className={styles.statCell}><span>Derrotas</span><strong>{profile.losses}</strong></div>
                <div className={styles.statCell}><span>Pontos</span><strong>{profile.mmr === null ? "—" : profile.mmr.toLocaleString("pt-BR")}</strong></div>
                <div className={`${styles.statCell} ${styles.statCellElo}`}><span>Elo</span><strong>{profileRankLabel}</strong></div>
              </div>

              {placementActive && (
                <div className={styles.placementTrack}>
                  <div className={styles.placementTrackHeader}>
                    <span>Partidas de colocação</span>
                    <strong>{profile.placementMatchesPlayed}/5</strong>
                  </div>
                  <div className={styles.placementTrackBar} aria-hidden="true">
                    <span style={{ width: `${profile.placementMatchesPlayed * 20}%` }} />
                  </div>
                </div>
              )}
            </article>

            <aside className={styles.dashboardCard}>
              <span className={styles.microLabel}>Fila competitiva</span>
              <h2 className={styles.panelTitle}>Pronto para o próximo X1?</h2>
              <p className={styles.placementCopy}>
                A busca começa por MMR próximo e abre para toda a fila após um minuto.
              </p>
              <div className={styles.queueAvailability} aria-live="polite">
                <Users size={18} aria-hidden="true" />
                <div>
                  <span>Fila agora</span>
                  <strong>{formatPlayersSearching(playersSearching)}</strong>
                </div>
              </div>

              {penalty?.active && penaltyRemaining ? (
                <div className={styles.deadlineBox} role="alert">
                  <Clock3 aria-hidden="true" />
                  <div>
                    <strong>Fila bloqueada por {penaltyRemaining}</strong>
                    <span>Ocorrências atuais: {penalty.missedAcceptances}/3.</span>
                  </div>
                </div>
              ) : (
                <div className={styles.actionStack}>
                  <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void joinQueue()}>
                    <Crosshair size={19} aria-hidden="true" /> Entrar na fila
                  </button>
                  <Link href="/matchmaking/ranking" className={styles.secondaryButton}>
                    <Trophy size={17} aria-hidden="true" /> Ver Top 50
                  </Link>
                  <Link href={`/ranked/${encodeURIComponent(profile.username)}`} className={styles.quietButton}>
                    Ver perfil público <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </aside>
          </div>
          {!(penalty?.active && penaltyRemaining) && (
            <button
              type="button"
              className={styles.mobileQueueCta}
              disabled={busy}
              onClick={() => void joinQueue()}
            >
              <Crosshair size={18} aria-hidden="true" /> ENTRAR NA FILA
            </button>
          )}
        </div>
      </section>
    </>
  );
}

export function MatchmakingHero() {
  return (
    <header className={styles.rankedHero}>
      <div className="page-container">
        <div className={styles.heroGrid}>
          <div>
            <span className={styles.eyebrow}>AXB Ranked • Fila global</span>
            <h1 className={styles.heroTitle}>Entre. Jogue. <span>Suba.</span></h1>
            <p className={styles.heroLead}>
              Matchmaking competitivo X1, MMR contínuo e uma escalada que termina entre os dez melhores da Arena.
            </p>
          </div>
          <div className={styles.heroRail} aria-label="Características da Ranked">
            <div><Radio aria-hidden="true" /><p><span>Busca</span><strong>Tempo real</strong></p></div>
            <div><Gauge aria-hidden="true" /><p><span>Precisão</span><strong>MMR dinâmico</strong></p></div>
            <div><LockKeyhole aria-hidden="true" /><p><span>Resultado</span><strong>Dupla confirmação</strong></p></div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function RankLadder() {
  return (
    <section className={styles.contentSection} aria-labelledby="rank-ladder-title">
      <div className="page-container">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Progressão competitiva</span>
            <h2 id="rank-ladder-title" className={styles.sectionTitle}>Seis níveis. <span>Um topo.</span></h2>
            <p className={styles.sectionDescription}>
              Complete cinco partidas de colocação, revele seu MMR e dispute uma vaga no Top 10 Champion.
            </p>
          </div>
          <Link href="/matchmaking/ranking" className={styles.miniLink}>
            Abrir classificação <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.rankLadder}>
          {rankLadder.map((tier, index) => (
            <article key={tier} className={styles.rankLadderItem}>
              <span className={styles.rankIndex}>{String(index + 1).padStart(2, "0")}</span>
              <RankEmblem tier={tier} size="lg" />
              <p>
                {tier === "novato" && "800–999 MMR"}
                {tier === "pro" && "1.000–1.249 MMR"}
                {tier === "craque" && "1.250–1.799 MMR"}
                {tier === "desafiante" && "1.800–2.099 MMR"}
                {tier === "immortal" && "2.100–2.499 MMR"}
                {tier === "champion" && "2.500+ • Top 10"}
              </p>
            </article>
          ))}
        </div>
        <div className={styles.rankedRules}>
          <div><Search aria-hidden="true" /><strong>60 segundos</strong><span>por MMR próximo</span></div>
          <div><Users aria-hidden="true" /><strong>Fila única</strong><span>sem categorias</span></div>
          <div><Gamepad2 aria-hidden="true" /><strong>X1 decisivo</strong><span>empate não existe</span></div>
          <div><ShieldCheck aria-hidden="true" /><strong>Resultado seguro</strong><span>com suporte AXB</span></div>
        </div>
      </div>
    </section>
  );
}
