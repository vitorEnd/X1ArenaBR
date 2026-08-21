"use client";

import { ArrowUpRight, Radio, Swords, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { MatchFoundDialog } from "./match-found-dialog";
import { useMatchmakingLive } from "./matchmaking-live-provider";
import styles from "./ranked.module.css";
import { useMatchFoundAlert } from "./use-matchmaking-live";

export function GlobalRankedQueue() {
  const pathname = usePathname();
  const {
    snapshot,
    busy,
    error,
    refresh,
    updateQueue,
    updateMatch,
    clockOffsetMs,
  } = useMatchmakingLive();
  const isMatchmakingPage =
    pathname === "/matchmaking" || pathname.startsWith("/matchmaking/lobby/");
  const foundMatch = snapshot?.foundMatch ?? null;
  const profile = snapshot?.profile ?? null;
  const shouldSound = Boolean(!isMatchmakingPage && foundMatch && !foundMatch.ownAccepted);
  const { prepareAlerts } = useMatchFoundAlert(foundMatch?.matchId ?? null, shouldSound);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const prepare = () => void prepareAlerts();
    window.addEventListener("axb:prepare-ranked-alerts", prepare);
    return () => window.removeEventListener("axb:prepare-ranked-alerts", prepare);
  }, [prepareAlerts]);

  if (isMatchmakingPage || !snapshot?.authenticated || !profile) return null;

  if (foundMatch) {
    return (
      <MatchFoundDialog
        match={foundMatch}
        profile={profile}
        busy={busy}
        error={error}
        clockOffsetMs={clockOffsetMs}
        onAccept={() => updateMatch(foundMatch.matchId, { intent: "accept" })}
        onDecline={() => updateMatch(foundMatch.matchId, { intent: "decline" })}
      />
    );
  }

  if (snapshot.queue?.state === "searching") {
    return (
      <aside className={styles.globalQueueDock} aria-live="polite" aria-label="Fila Ranked ativa">
        <span className={styles.globalQueuePulse} aria-hidden="true"><Radio /></span>
        <Link href="/matchmaking" className={styles.globalQueueMain}>
          <small>Fila global ativa</small>
          <strong>Buscando adversário</strong>
          <span>{snapshot.queue.playersSearching} buscando agora</span>
        </Link>
        <button
          type="button"
          className={styles.globalQueueClose}
          aria-label="Cancelar busca"
          disabled={busy}
          onClick={() => void updateQueue("leave").catch(() => undefined)}
        >
          <X aria-hidden="true" />
        </button>
      </aside>
    );
  }

  if (snapshot.activeMatch) {
    return (
      <Link
        href="/matchmaking"
        className={`${styles.globalQueueDock} ${styles.globalQueueDockMatch}`}
        aria-label={`Voltar ao Match ${snapshot.activeMatch.matchNumber}`}
      >
        <span className={styles.globalQueuePulse} aria-hidden="true"><Swords /></span>
        <span className={styles.globalQueueMain}>
          <small>Match #{snapshot.activeMatch.matchNumber}</small>
          <strong>{snapshot.activeMatch.state === "lobby" ? "Lobby pronto" : "Partida em andamento"}</strong>
          <span>Voltar para a sala</span>
        </span>
        <ArrowUpRight className={styles.globalQueueArrow} aria-hidden="true" />
      </Link>
    );
  }

  return null;
}
