"use client";

import { Radio, Swords, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PublicQueueStatusResponse } from "@/lib/ranked/public-queue-status";
import { normalizePublicQueueCount } from "@/lib/ranked/public-queue-status";
import styles from "./ranked.module.css";

const REFRESH_INTERVAL_MS = 30_000;

function statusCopy(status: PublicQueueStatusResponse | null, failed: boolean) {
  if (failed || (status && !status.available)) {
    return {
      title: "Status temporariamente indisponível",
      detail: "A Arena não conseguiu consultar a fila agora.",
      active: false,
    };
  }

  if (!status) {
    return {
      title: "Consultando fila global",
      detail: "Atualizando o monitor da Arena…",
      active: false,
    };
  }

  return {
    title: "Monitor atualizado",
    detail: "Acompanhe quem está buscando e os confrontos que já começaram.",
    active: false,
  };
}

function queueDetail(total: number) {
  if (total === 0) return "Ninguém buscando adversário agora.";
  return `${total} ${total === 1 ? "jogador buscando" : "jogadores buscando"} adversário agora.`;
}

function lobbyDetail(total: number) {
  if (total === 0) return "Nenhuma partida acontecendo agora.";
  return `${total} ${total === 1 ? "partida em andamento" : "partidas em andamento"}.`;
}

export function PublicQueueStatus() {
  const [status, setStatus] = useState<PublicQueueStatusResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/ranked/queue-status", {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) throw new Error("Queue status unavailable");
      const payload = (await response.json()) as PublicQueueStatusResponse;
      setStatus(payload);
      setFailed(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    let controller = new AbortController();
    const initialLoad = window.setTimeout(() => void refresh(controller.signal), 0);

    const interval = setInterval(() => {
      controller.abort();
      controller = new AbortController();
      void refresh(controller.signal);
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(interval);
      controller.abort();
    };
  }, [refresh]);

  const copy = statusCopy(status, failed);
  const statusAvailable = Boolean(status?.available) && !failed;
  const playersSearching = statusAvailable
    ? normalizePublicQueueCount(status?.playersSearching)
    : 0;
  const activeLobbies = statusAvailable
    ? normalizePublicQueueCount(status?.activeLobbies)
    : 0;

  return (
    <section className={styles.publicQueueSection} aria-labelledby="public-queue-title">
      <div className="page-container">
        <div className={styles.publicQueueFrame}>
          <div className={styles.publicQueueHeading}>
            <span className={styles.microLabel}>Monitor da Arena</span>
            <h2 id="public-queue-title">Filas em andamento</h2>
          </div>

          {statusAvailable ? (
            <div className={styles.publicQueueStates} role="status" aria-live="polite">
              <article
                className={`${styles.publicActivityCard} ${playersSearching > 0 ? styles.publicActivityCardActive : ""}`}
              >
                <span className={styles.publicQueueSignal} aria-hidden="true">
                  <Radio />
                </span>
                <span className={styles.publicActivityContent}>
                  <small>Buscando adversário</small>
                  <strong>{playersSearching}</strong>
                  <span>{queueDetail(playersSearching)}</span>
                </span>
              </article>

              <article
                className={`${styles.publicActivityCard} ${activeLobbies > 0 ? styles.publicActivityCardLive : ""}`}
              >
                <span className={styles.publicQueueSignal} aria-hidden="true">
                  <Swords />
                </span>
                <span className={styles.publicActivityContent}>
                  <small>Arena ao vivo</small>
                  <strong>{activeLobbies}</strong>
                  <span>{lobbyDetail(activeLobbies)}</span>
                </span>
              </article>
            </div>
          ) : (
            <div
              className={`${styles.publicQueueState} ${copy.active ? styles.publicQueueStateActive : ""}`}
              role="status"
              aria-live="polite"
            >
              <span className={styles.publicQueueSignal} aria-hidden="true">
                <Users />
              </span>
              <span>
                <strong>{copy.title}</strong>
                <small>{copy.detail}</small>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
