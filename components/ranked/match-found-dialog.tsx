"use client";

import { Check, ShieldX, Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RankedFoundMatchView, RankedPublicProfile } from "./adapter";
import { PlayerAvatar } from "./player-avatar";
import { RankEmblem, rankedTierLabels } from "./rank-emblem";
import styles from "./ranked.module.css";
import { useDialogFocusTrap } from "./use-dialog-focus-trap";

interface MatchFoundDialogProps {
  readonly match: RankedFoundMatchView;
  readonly profile: RankedPublicProfile;
  readonly busy: boolean;
  readonly onAccept: () => Promise<unknown>;
  readonly onDecline: () => Promise<unknown>;
}

function getRemainingSeconds(deadline: string) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1_000));
}

function formatRank(profile: Pick<RankedPublicProfile, "tier" | "mmr" | "placementMatchesPlayed">) {
  if (!profile.tier || profile.mmr === null) {
    return `Colocação ${profile.placementMatchesPlayed}/5`;
  }
  return `${rankedTierLabels[profile.tier]} • ${profile.mmr.toLocaleString("pt-BR")} MMR`;
}

export function MatchFoundDialog({
  match,
  profile,
  busy,
  onAccept,
  onDecline,
}: MatchFoundDialogProps) {
  const [seconds, setSeconds] = useState(() => getRemainingSeconds(match.acceptanceDeadline));
  const acceptButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocusTrap<HTMLElement>(true);

  useEffect(() => {
    acceptButtonRef.current?.focus();
    const interval = setInterval(
      () => setSeconds(getRemainingSeconds(match.acceptanceDeadline)),
      250,
    );
    return () => clearInterval(interval);
  }, [match.acceptanceDeadline]);

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section
        ref={dialogRef}
        tabIndex={-1}
        className={styles.matchDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-found-title"
        aria-describedby="match-found-status"
      >
        <div className={styles.dialogCountdown} aria-label={`${seconds} segundos restantes`}>
          {seconds}
        </div>
        <span className={styles.microLabel}>Fila global • Confronto localizado</span>
        <h2 id="match-found-title">Partida encontrada</h2>

        <div className={styles.versusGrid}>
          <div className={styles.versusPlayer}>
            <PlayerAvatar src={profile.avatarUrl} name={profile.username} size="lg" />
            <RankEmblem
              tier={profile.tier}
              size="sm"
              topPosition={profile.globalPosition}
              mmr={profile.mmr}
              showLabel={false}
            />
            <strong>{profile.username}</strong>
            <span>{formatRank(profile)}</span>
          </div>
          <div className={styles.versusMark} aria-label="versus">VS</div>
          <div className={styles.versusPlayer}>
            <PlayerAvatar
              src={match.opponent.avatarUrl}
              name={match.opponent.username}
              size="lg"
            />
            <RankEmblem
              tier={match.opponent.tier}
              size="sm"
              topPosition={match.opponent.globalPosition}
              mmr={match.opponent.mmr}
              showLabel={false}
            />
            <strong>{match.opponent.username}</strong>
            <span>
              {match.opponent.tier && match.opponent.mmr !== null
                ? `${rankedTierLabels[match.opponent.tier]} • ${match.opponent.mmr.toLocaleString("pt-BR")} MMR`
                : "Em colocação"}
            </span>
          </div>
        </div>

        <div className={styles.dialogActions}>
          <button
            ref={acceptButtonRef}
            type="button"
            className={styles.primaryButton}
            disabled={busy || match.ownAccepted || seconds === 0}
            onClick={() => void onAccept()}
          >
            <Check size={18} aria-hidden="true" />
            {match.ownAccepted ? "Aceito — aguardando rival" : "Aceitar partida"}
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            disabled={busy || match.ownAccepted || seconds === 0}
            onClick={() => void onDecline()}
          >
            <ShieldX size={18} aria-hidden="true" /> Recusar
          </button>
        </div>

        <p id="match-found-status" className={styles.dialogStatus} aria-live="assertive">
          {match.ownAccepted
            ? match.opponentAccepted
              ? "Os dois jogadores aceitaram. Preparando o lobby seguro."
              : "Sua resposta foi registrada. O alerta sonoro foi encerrado."
            : seconds > 0
              ? "Os dois jogadores precisam aceitar para abrir o lobby."
              : "Tempo encerrado. Atualizando a fila…"}
        </p>
        <span className="sr-only"><Swords aria-hidden="true" /></span>
      </section>
    </div>
  );
}
