"use client";

import { Gavel, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  RankedSupportAccount,
  RankedSupportIntent,
  RankedSupportMatch,
} from "./adapter";
import styles from "./ranked.module.css";
import { useDialogFocusTrap } from "./use-dialog-focus-trap";

interface SupportActionDialogProps {
  readonly match?: RankedSupportMatch | null;
  readonly account?: RankedSupportAccount | null;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (payload: RankedSupportIntent) => Promise<unknown>;
}

export function SupportActionDialog({
  match = null,
  account = null,
  busy,
  onClose,
  onSubmit,
}: SupportActionDialogProps) {
  const [resolution, setResolution] = useState<"confirm" | "walkover-a" | "walkover-b" | "cancel">("confirm");
  const [playerAGoals, setPlayerAGoals] = useState("0");
  const [playerBGoals, setPlayerBGoals] = useState("0");
  const [accountAction, setAccountAction] = useState<"freeze" | "release" | "ban" | "penalize" | "adjust-mmr">("freeze");
  const [newMmr, setNewMmr] = useState(() => String(account?.mmr ?? 800));
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstControlRef = useRef<HTMLSelectElement>(null);
  const closeWhenAvailable = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  const dialogRef = useDialogFocusTrap<HTMLElement>(true, closeWhenAvailable);

  const title = useMemo(
    () => match ? `Resolver Match #${match.matchNumber}` : `Gerenciar ${account?.username ?? "jogador"}`,
    [account?.username, match],
  );

  useEffect(() => {
    firstControlRef.current?.focus();
  }, []);

  const submit = async () => {
    const internalNote = note.trim();
    if (internalNote.length < 6) {
      setError("Registre uma observação interna com pelo menos 6 caracteres.");
      return;
    }

    let payload: RankedSupportIntent;
    if (match) {
      const scoreA = Number(playerAGoals);
      const scoreB = Number(playerBGoals);
      if (
        resolution === "confirm" &&
        (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA === scoreB)
      ) {
        setError("Para confirmar, informe um placar válido e sem empate.");
        return;
      }
      payload = {
        intent: "resolve-match",
        matchId: match.id,
        resolution,
        ...(resolution === "confirm" ? { playerAGoals: scoreA, playerBGoals: scoreB } : {}),
        internalNote,
      };
    } else if (account) {
      if (accountAction === "adjust-mmr") {
        const parsedMmr = Number(newMmr);
        if (!Number.isInteger(parsedMmr) || parsedMmr < 800) {
          setError("Informe um novo MMR inteiro a partir de 800.");
          return;
        }
        payload = {
          intent: "adjust-mmr",
          profileId: account.profileId,
          newMmr: parsedMmr,
          internalNote,
        };
      } else {
        const durationSeconds = Number(durationMinutes) * 60;
        if (
          (accountAction === "freeze" || accountAction === "penalize") &&
          (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 31_536_000)
        ) {
          setError("Informe uma duração entre 1 minuto e 365 dias.");
          return;
        }
        payload = {
          intent: "account-action",
          profileId: account.profileId,
          action: accountAction,
          ...((accountAction === "freeze" || accountAction === "penalize")
            ? { durationSeconds }
            : {}),
          internalNote,
        };
      }
    } else {
      return;
    }

    setError(null);
    try {
      await onSubmit(payload);
      onClose();
    } catch {
      // The parent surface displays the server error.
    }
  };

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section ref={dialogRef} tabIndex={-1} className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="support-action-title">
        <div className={styles.formDialogHeader}>
          <div>
            <span className={styles.microLabel}>Ação auditada</span>
            <h2 id="support-action-title">{title}</h2>
          </div>
          <button type="button" className={styles.iconButton} disabled={busy} onClick={closeWhenAvailable} aria-label="Fechar">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.formGrid}>
          {match ? (
            <>
              <div className={styles.field}>
                <label htmlFor="support-resolution">Decisão</label>
                <select
                  ref={firstControlRef}
                  id="support-resolution"
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value as typeof resolution)}
                >
                  <option value="confirm">Confirmar com placar corrigido</option>
                  <option value="walkover-a">Aplicar W.O. para {match.playerA.username}</option>
                  <option value="walkover-b">Aplicar W.O. para {match.playerB.username}</option>
                  <option value="cancel">Cancelar partida</option>
                </select>
              </div>
              {resolution === "confirm" && (
                <div className={styles.scoreGrid}>
                  <div className={styles.field}>
                    <label htmlFor="support-score-a">{match.playerA.username}</label>
                    <input id="support-score-a" type="number" min="0" step="1" value={playerAGoals} onChange={(event) => setPlayerAGoals(event.target.value)} />
                  </div>
                  <strong aria-hidden="true">×</strong>
                  <div className={styles.field}>
                    <label htmlFor="support-score-b">{match.playerB.username}</label>
                    <input id="support-score-b" type="number" min="0" step="1" value={playerBGoals} onChange={(event) => setPlayerBGoals(event.target.value)} />
                  </div>
                </div>
              )}
            </>
          ) : account ? (
            <>
              <div className={styles.field}>
                <label htmlFor="support-account-action">Operação</label>
                <select
                  ref={firstControlRef}
                  id="support-account-action"
                  value={accountAction}
                  onChange={(event) => setAccountAction(event.target.value as typeof accountAction)}
                >
                  <option value="freeze">Congelar jogador</option>
                  <option value="release">Liberar jogador</option>
                  <option value="penalize">Aplicar punição</option>
                  <option value="adjust-mmr">Corrigir MMR</option>
                  <option value="ban">Banir conta</option>
                </select>
              </div>
              {accountAction === "adjust-mmr" && (
                <div className={styles.field}>
                  <label htmlFor="support-new-mmr">Novo MMR absoluto</label>
                  <input id="support-new-mmr" type="number" min="800" step="1" value={newMmr} onChange={(event) => setNewMmr(event.target.value)} />
                </div>
              )}
              {(accountAction === "freeze" || accountAction === "penalize") && (
                <div className={styles.field}>
                  <label htmlFor="support-duration">Duração em minutos</label>
                  <input
                    id="support-duration"
                    type="number"
                    min="1"
                    max="525600"
                    step="1"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                  />
                </div>
              )}
            </>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="support-note">Observação interna</label>
            <textarea
              id="support-note"
              maxLength={800}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Motivo e contexto da decisão para o registro de auditoria."
            />
            <span className={styles.charCount}>{note.length}/800</span>
          </div>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <p className={styles.formHint}><ShieldAlert size={15} aria-hidden="true" /> Esta ação será registrada no histórico do suporte.</p>
          <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void submit()}>
            <Gavel size={17} aria-hidden="true" /> Confirmar decisão
          </button>
        </div>
      </section>
    </div>
  );
}
