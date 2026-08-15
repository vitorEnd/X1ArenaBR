"use client";

import {
  AlertTriangle,
  Check,
  Clipboard,
  Clock3,
  Copy,
  Flag,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  ShieldAlert,
  Square,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getAuthoritativeNow } from "@/lib/ranked/server-clock";
import type { RankedLobbyView, RankedMatchIntent } from "./adapter";
import { PlayerAvatar } from "./player-avatar";
import { RankEmblem, rankedTierLabels } from "./rank-emblem";
import { ReportDialog, ScoreDialog } from "./score-report-dialogs";
import styles from "./ranked.module.css";

interface MatchLobbyProps {
  readonly match: RankedLobbyView;
  readonly busy: boolean;
  readonly clockOffsetMs: number;
  readonly onAction: (payload: RankedMatchIntent) => Promise<unknown>;
}

function getDeadlineLabel(deadline: string | null, now = Date.now()) {
  if (!deadline) return null;
  const remaining = Math.max(0, new Date(deadline).getTime() - now);
  const totalSeconds = Math.ceil(remaining / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useDeadline(deadline: string | null, clockOffsetMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  return getDeadlineLabel(deadline, getAuthoritativeNow(now, clockOffsetMs));
}

function stateLabel(state: RankedLobbyView["state"]) {
  const labels: Record<RankedLobbyView["state"], string> = {
    awaiting_acceptance: "Aguardando aceite",
    lobby: "Lobby aberto",
    in_progress: "X1 em andamento",
    awaiting_score: "Aguardando placar",
    awaiting_confirmation: "Aguardando confirmação",
    frozen: "Lobby congelado",
    disputed: "Em análise pelo suporte",
    confirmed: "Resultado confirmado",
    cancelled: "Partida cancelada",
  };
  return labels[state];
}

function playerRankLabel(player: RankedLobbyView["playerA"]) {
  if (!player.tier || player.mmr === null) return "Em colocação";
  if (player.tier === "champion" && player.globalPosition) {
    return `TOP ${player.globalPosition} • ${player.mmr.toLocaleString("pt-BR")} MMR`;
  }
  return `${rankedTierLabels[player.tier]} • ${player.mmr.toLocaleString("pt-BR")} MMR`;
}

export function MatchLobby({ match, busy, clockOffsetMs, onAction }: MatchLobbyProps) {
  const [scoreOpen, setScoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const scoreDeadline = useDeadline(match.scoreSubmissionDeadline, clockOffsetMs);
  const confirmationDeadline = useDeadline(match.confirmationDeadline, clockOffsetMs);
  const viewerIsCreator = match.creatorId === match.viewerId;
  const creator = match.playerA.id === match.creatorId ? match.playerA : match.playerB;
  const canReport = ["lobby", "in_progress", "awaiting_score", "awaiting_confirmation"].includes(match.state);
  const viewerIsPlayerA = match.playerA.id === match.viewerId;

  useEffect(() => {
    if (match.state === "awaiting_score" && viewerIsCreator) {
      setScoreOpen(true);
    }
  }, [match.state, viewerIsCreator]);

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1_800);
    } catch {
      setCopied(null);
    }
  };

  const submittedScore = match.submittedScore;
  const viewerNeedsToConfirm = match.state === "awaiting_confirmation" && !viewerIsCreator;

  return (
    <section className={styles.contentSectionTight} aria-labelledby="lobby-title">
      <div className="page-container">
        <div className={styles.lobbyShell}>
          <div className={styles.lobbyTopline}>
            <div>
              <span className={styles.microLabel}>Arena Ranked • Lobby privado</span>
              <h1 id="lobby-title">Match <span>#{match.matchNumber}</span></h1>
            </div>
            <span className={styles.livePill}>
              <span className={styles.liveDot} aria-hidden="true" /> {stateLabel(match.state)}
            </span>
          </div>

          <article className={styles.lobbyPanel}>
            <div className={styles.roomGrid}>
              <div className={styles.roomCredentials}>
                <div className={styles.credentialRow}>
                  <span>Nome da sala</span>
                  <strong>{match.roomName}</strong>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Copiar nome da sala"
                    onClick={() => void copyText("sala", match.roomName)}
                  >
                    {copied === "sala" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  </button>
                </div>
                <div className={styles.credentialRow}>
                  <span>Senha numérica</span>
                  <strong>{match.roomPassword}</strong>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Copiar senha da sala"
                    onClick={() => void copyText("senha", match.roomPassword)}
                  >
                    {copied === "senha" ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className={styles.creatorCard}>
                <KeyRound size={28} aria-hidden="true" />
                <span className={styles.microLabel}>Criador sorteado</span>
                <strong>{creator.username}</strong>
                <p>
                  {viewerIsCreator
                    ? "Crie esta sala manualmente no World of Football."
                    : "Aguarde o rival criar a sala no World of Football."}
                </p>
              </div>
            </div>

            <div className={styles.lobbyPlayers}>
              <div className={styles.lobbyPlayer}>
                <PlayerAvatar src={match.playerA.avatarUrl} name={match.playerA.username} size="md" />
                <div>
                  <strong>{match.playerA.username}</strong>
                  <span>{playerRankLabel(match.playerA)}</span>
                </div>
                <RankEmblem
                  tier={match.playerA.tier}
                  size="sm"
                  topPosition={match.playerA.globalPosition}
                  mmr={match.playerA.mmr}
                  showLabel={false}
                />
              </div>
              <span className={styles.versusMark} aria-label="versus">X1</span>
              <div className={styles.lobbyPlayer}>
                <div>
                  <strong>{match.playerB.username}</strong>
                  <span>{playerRankLabel(match.playerB)}</span>
                </div>
                <PlayerAvatar src={match.playerB.avatarUrl} name={match.playerB.username} size="md" />
                <RankEmblem
                  tier={match.playerB.tier}
                  size="sm"
                  topPosition={match.playerB.globalPosition}
                  mmr={match.playerB.mmr}
                  showLabel={false}
                />
              </div>
            </div>

            {match.state === "awaiting_score" && (
              <div className={styles.deadlineBox} role="status" aria-live="polite">
                <Clock3 aria-hidden="true" />
                <div>
                  <strong>Envio do placar: {scoreDeadline ?? "prazo encerrado"}</strong>
                  <span>Sem envio, a partida será congelada e encaminhada ao suporte.</span>
                </div>
              </div>
            )}

            {match.state === "awaiting_confirmation" && submittedScore && (
              <div className={styles.deadlineBox} role="status" aria-live="polite">
                <Flag aria-hidden="true" />
                <div>
                  <strong>
                    Placar enviado: {match.playerA.username} {submittedScore.playerAGoals} × {submittedScore.playerBGoals} {match.playerB.username}
                  </strong>
                  <span>
                    {viewerNeedsToConfirm
                      ? `Confirme ou conteste em ${confirmationDeadline ?? "prazo encerrado"}.`
                      : "Aguardando a resposta do adversário. Sem resposta, o placar será aprovado automaticamente."}
                  </span>
                </div>
              </div>
            )}

            {(match.state === "frozen" || match.state === "disputed") && (
              <div className={styles.deadlineBox} role="alert">
                <ShieldAlert aria-hidden="true" />
                <div>
                  <strong>Partida protegida para análise</strong>
                  <span>Os dois jogadores ficam fora da fila até a decisão do suporte.</span>
                </div>
              </div>
            )}

            {match.state === "confirmed" && submittedScore && (
              <div className={styles.deadlineBox} role="status">
                <Check aria-hidden="true" />
                <div>
                  <strong>
                    Resultado confirmado: {submittedScore.playerAGoals} × {submittedScore.playerBGoals}
                  </strong>
                  <span>MMR e histórico foram processados com segurança.</span>
                </div>
              </div>
            )}

            <div className={styles.lobbyActions}>
              <div>
                {viewerIsCreator && (match.state === "lobby" || match.state === "in_progress") && (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={busy}
                    onClick={async () => {
                      setScoreOpen(true);
                      try {
                        await onAction({ intent: "end" });
                      } catch {
                        // Erro já foi tratado e mostrado na UI via error state
                      }
                    }}
                  >
                    <Square size={16} aria-hidden="true" /> Finalizar partida
                  </button>
                )}
                {viewerIsCreator && match.state === "awaiting_score" && (
                  <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => setScoreOpen(true)}>
                    <Flag size={17} aria-hidden="true" /> Informar placar
                  </button>
                )}
                {viewerNeedsToConfirm && (
                  <>
                    <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void onAction({ intent: "confirm" })}>
                      <Check size={17} aria-hidden="true" /> Aprovar placar
                    </button>
                    <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void onAction({ intent: "contest" })}>
                      <ShieldAlert size={17} aria-hidden="true" /> Contestar
                    </button>
                  </>
                )}
                {match.state === "confirmed" && (
                  <>
                    <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void onAction({ intent: "continue" })}>
                      <RotateCcw size={17} aria-hidden="true" /> Continuar jogando
                    </button>
                    <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void onAction({ intent: "finish" })}>
                      Encerrar sessão
                    </button>
                  </>
                )}
              </div>
              {canReport && (
                <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => setReportOpen(true)}>
                  <AlertTriangle size={17} aria-hidden="true" /> Reportar problema
                </button>
              )}
            </div>
          </article>
        </div>
      </div>

      <ScoreDialog
        open={scoreOpen}
        match={match}
        busy={busy}
        onClose={() => setScoreOpen(false)}
        onSubmit={(playerAGoals, playerBGoals) =>
          onAction({ intent: "submit-score", playerAGoals, playerBGoals })
        }
      />
      <ReportDialog
        open={reportOpen}
        busy={busy}
        onClose={() => setReportOpen(false)}
        onSubmit={(category, observation) =>
          onAction({ intent: "report", category, observation })
        }
      />
      <span className="sr-only">
        Você é {viewerIsPlayerA ? match.playerA.username : match.playerB.username}. <LockKeyhole aria-hidden="true" />
      </span>
    </section>
  );
}
