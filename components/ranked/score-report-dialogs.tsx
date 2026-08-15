"use client";

import { AlertTriangle, Flag, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RankedLobbyView, RankedReportCategory } from "./adapter";
import styles from "./ranked.module.css";
import { useDialogFocusTrap } from "./use-dialog-focus-trap";

interface BaseDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

interface ScoreDialogProps extends BaseDialogProps {
  readonly match: RankedLobbyView;
  readonly busy: boolean;
  readonly onSubmit: (playerAGoals: number, playerBGoals: number) => Promise<unknown>;
}

export function ScoreDialog({ open, onClose, match, busy, onSubmit }: ScoreDialogProps) {
  const [playerAGoals, setPlayerAGoals] = useState("0");
  const [playerBGoals, setPlayerBGoals] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const closeWhenAvailable = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  const dialogRef = useDialogFocusTrap<HTMLElement>(open, closeWhenAvailable);

  useEffect(() => {
    if (open) firstInputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const scoreA = Number(playerAGoals);
    const scoreB = Number(playerBGoals);

    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
      setError("Informe gols inteiros e não negativos.");
      return;
    }
    if (scoreA === scoreB) {
      setError("A Ranked não permite empate. O X1 precisa ter um vencedor.");
      return;
    }

    setError(null);
    try {
      await onSubmit(scoreA, scoreB);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível enviar o placar.";
      setError(message);
    }
  };

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section ref={dialogRef} tabIndex={-1} className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="score-title">
        <div className={styles.formDialogHeader}>
          <div>
            <span className={styles.microLabel}>Resultado oficial</span>
            <h2 id="score-title">Informar placar</h2>
          </div>
          <button type="button" className={styles.iconButton} disabled={busy} onClick={closeWhenAvailable} aria-label="Fechar">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.scoreGrid}>
            <div className={styles.field}>
              <label htmlFor="score-player-a">{match.playerA.username}</label>
              <input
                ref={firstInputRef}
                id="score-player-a"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={playerAGoals}
                onChange={(event) => setPlayerAGoals(event.target.value)}
              />
            </div>
            <strong aria-hidden="true">×</strong>
            <div className={styles.field}>
              <label htmlFor="score-player-b">{match.playerB.username}</label>
              <input
                id="score-player-b"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={playerBGoals}
                onChange={(event) => setPlayerBGoals(event.target.value)}
              />
            </div>
          </div>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <p className={styles.formHint}>
            O adversário terá três minutos para aprovar ou contestar. Revise antes de enviar.
          </p>
          <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void submit()}>
            <Flag size={17} aria-hidden="true" /> Enviar placar
          </button>
        </div>
      </section>
    </div>
  );
}

const reportCategories: ReadonlyArray<{
  readonly value: RankedReportCategory;
  readonly label: string;
}> = [
  { value: "room_not_created", label: "Sala não criada" },
  { value: "incorrect_password", label: "Senha incorreta" },
  { value: "opponent_absent", label: "Adversário ausente" },
  { value: "abandonment", label: "Abandono" },
  { value: "technical_problem", label: "Problema técnico" },
  { value: "misconduct", label: "Conduta inadequada" },
  { value: "other", label: "Outro" },
] as const;

interface ReportDialogProps extends BaseDialogProps {
  readonly busy: boolean;
  readonly onSubmit: (category: RankedReportCategory, observation: string) => Promise<unknown>;
}

export function ReportDialog({ open, onClose, busy, onSubmit }: ReportDialogProps) {
  const [category, setCategory] = useState<RankedReportCategory>(reportCategories[0].value);
  const [observation, setObservation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const closeWhenAvailable = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  const dialogRef = useDialogFocusTrap<HTMLElement>(open, closeWhenAvailable);

  useEffect(() => {
    if (open) selectRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const cleanObservation = observation.trim();
    if (cleanObservation.length < 10) {
      setError("Explique o problema com pelo menos 10 caracteres.");
      return;
    }
    setError(null);
    try {
      await onSubmit(category, cleanObservation);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível enviar o reporte.";
      setError(message);
    }
  };

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section ref={dialogRef} tabIndex={-1} className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className={styles.formDialogHeader}>
          <div>
            <span className={styles.microLabel}>Acionar suporte</span>
            <h2 id="report-title">Reportar problema</h2>
          </div>
          <button type="button" className={styles.iconButton} disabled={busy} onClick={closeWhenAvailable} aria-label="Fechar">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="report-category">Categoria</label>
            <select
              ref={selectRef}
              id="report-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as RankedReportCategory)}
            >
              {reportCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="report-observation">Observação</label>
            <textarea
              id="report-observation"
              maxLength={600}
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Conte exatamente o que aconteceu para o suporte analisar."
            />
            <span className={styles.charCount}>{observation.length}/600</span>
          </div>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <p className={styles.formHint}>
            <AlertTriangle size={15} aria-hidden="true" /> O envio congela o lobby e impede novas partidas até a análise.
          </p>
          <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void submit()}>
            <AlertTriangle size={17} aria-hidden="true" /> Confirmar reporte
          </button>
        </div>
      </section>
    </div>
  );
}
