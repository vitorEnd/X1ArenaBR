"use client";

import { Radio, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PublicQueueStatusResponse } from "@/lib/ranked/public-queue-status";
import { normalizePublicQueueCount } from "@/lib/ranked/public-queue-status";
import styles from "./ranked.module.css";

const REFRESH_INTERVAL_MS = 10_000;

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

  if (status.active) {
    const total = normalizePublicQueueCount(status.playersSearching);
    return {
      title: "Fila global ativa",
      detail: `${total} ${total === 1 ? "jogador buscando" : "jogadores buscando"} adversário agora.`,
      active: true,
    };
  }

  return {
    title: "Nenhuma fila em andamento",
    detail: "A fila global está livre. Entre e inicie a busca.",
    active: false,
  };
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

  return (
    <section className={styles.publicQueueSection} aria-labelledby="public-queue-title">
      <div className="page-container">
        <div className={styles.publicQueueFrame}>
          <div className={styles.publicQueueHeading}>
            <span className={styles.microLabel}>Monitor da Arena</span>
            <h2 id="public-queue-title">Filas em andamento</h2>
          </div>

          <div
            className={`${styles.publicQueueState} ${copy.active ? styles.publicQueueStateActive : ""}`}
            role="status"
            aria-live="polite"
          >
            <span className={styles.publicQueueSignal} aria-hidden="true">
              {copy.active ? <Radio /> : <Users />}
            </span>
            <span>
              <strong>{copy.title}</strong>
              <small>{copy.detail}</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
