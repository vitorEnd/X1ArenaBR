"use client";

import { Gavel, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  RankedSupportAccount,
  RankedSupportHistoryMatch,
  RankedSupportIntent,
  RankedSupportMatch,
} from "./adapter";
import styles from "./ranked.module.css";
import { useDialogFocusTrap } from "./use-dialog-focus-trap";

interface SupportActionDialogProps {
  readonly match?: RankedSupportMatch | RankedSupportHistoryMatch | null;
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
  const [playerAGoals, setPlayerAGoals] = useState(() =>
    String(match?.submittedScore?.playerAGoals ?? 0),
  );
  const [playerBGoals, setPlayerBGoals] = useState(() =>
    String(match?.submittedScore?.playerBGoals ?? 0),
  );
  const historyMatch = match?.state === "confirmed"
    ? match as RankedSupportHistoryMatch
    : null;
  const [playerAMmr, setPlayerAMmr] = useState(() =>
    String(historyMatch?.playerACurrentMmr ?? 800),
  );
  const [playerBMmr, setPlayerBMmr] = useState(() =>
    String(historyMatch?.playerBCurrentMmr ?? 800),
  );
  const [accountAction, setAccountAction] = useState<"freeze" | "unfreeze" | "ban" | "unban" | "penalize" | "adjust-mmr" | "set-nickname" | "delete-nickname" | "set-avatar" | "delete-avatar">(
    account?.banned ? "unban" : account?.frozen ? "unfreeze" : "freeze",
  );
  const [newMmr, setNewMmr] = useState(() => String(account?.mmr ?? 800));
  const [nickname, setNickname] = useState(() => account?.nickname?.nickname ?? "");
  const [nicknameColor, setNicknameColor] = useState<"purple" | "gold" | "red">(() => account?.nickname?.color ?? "purple");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
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
    if (accountAction === "set-nickname" && nickname.trim().length < 2) { setError("Informe um apelido com pelo menos 2 caracteres."); return; }
    if (internalNote.length < 6) {
      setError("Registre uma observação interna com pelo menos 6 caracteres.");
      return;
    }

    let payload: RankedSupportIntent;
    if (historyMatch) {
      const scoreA = Number(playerAGoals);
      const scoreB = Number(playerBGoals);
      const mmrA = Number(playerAMmr);
      const mmrB = Number(playerBMmr);
      if (
        !Number.isInteger(scoreA) || !Number.isInteger(scoreB) ||
        scoreA < 0 || scoreB < 0 || scoreA === scoreB
      ) {
        setError("Informe um placar válido e sem empate.");
        return;
      }
      if (!Number.isInteger(mmrA) || !Number.isInteger(mmrB) || mmrA < 800 || mmrB < 800) {
        setError("O MMR dos dois jogadores deve ser um número inteiro a partir de 800.");
        return;
      }
      payload = {
        intent: "correct-history-match",
        matchId: historyMatch.id,
        playerAGoals: scoreA,
        playerBGoals: scoreB,
        playerAMmr: mmrA,
        playerBMmr: mmrB,
        internalNote,
      };
    } else if (match) {
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
      if (accountAction === "set-nickname") {
        payload = { intent: "set-player-nickname", playerId: account.profileId, nickname: nickname.trim(), color: nicknameColor, internalNote };
      } else if (accountAction === "delete-nickname") {
        payload = { intent: "delete-player-nickname", playerId: account.profileId, internalNote };
      } else if (accountAction === "set-avatar") {
        if (!avatarDataUrl) { setError("Selecione uma imagem."); return; }
        payload = { intent: "set-player-avatar", playerId: account.profileId, avatarDataUrl, internalNote };
      } else if (accountAction === "delete-avatar") {
        payload = { intent: "delete-player-avatar", playerId: account.profileId, internalNote };
      } else if (accountAction === "adjust-mmr") {
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
          (accountAction === "freeze" || accountAction === "penalize" || accountAction === "ban") &&
          (!Number.isInteger(durationSeconds) ||
            durationSeconds < 60 ||
            durationSeconds > (accountAction === "ban" ? 360_000 : 31_536_000))
        ) {
          setError(
            accountAction === "ban"
              ? "Informe uma duração entre 1 minuto e 100 horas."
              : "Informe uma duração entre 1 minuto e 365 dias.",
          );
          return;
        }
        payload = {
          intent: "account-action",
          profileId: account.profileId,
          action: accountAction,
          ...((accountAction === "freeze" || accountAction === "penalize" || accountAction === "ban")
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
              {!historyMatch && <div className={styles.field}>
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
              </div>}
              {(historyMatch || resolution === "confirm") && (
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
              {historyMatch && (
                <div className={styles.scoreGrid}>
                  <div className={styles.field}>
                    <label htmlFor="support-mmr-a">MMR de {match.playerA.username}</label>
                    <input id="support-mmr-a" type="number" min="800" step="1" value={playerAMmr} onChange={(event) => setPlayerAMmr(event.target.value)} />
                  </div>
                  <strong aria-hidden="true">•</strong>
                  <div className={styles.field}>
                    <label htmlFor="support-mmr-b">MMR de {match.playerB.username}</label>
                    <input id="support-mmr-b" type="number" min="800" step="1" value={playerBMmr} onChange={(event) => setPlayerBMmr(event.target.value)} />
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
                  <option value="set-nickname">Definir/editar apelido</option>
                  <option value="delete-nickname">Excluir apelido</option>
                  <option value="set-avatar">Enviar foto do jogador</option>
                  <option value="delete-avatar">Excluir foto do jogador</option>
                  <option value="freeze">Congelar jogador</option>
                  <option value="unfreeze">Descongelar jogador</option>
                  <option value="penalize">Aplicar punição</option>
                  <option value="adjust-mmr">Corrigir MMR</option>
                  <option value="ban">Banir jogador por tempo</option>
                  <option value="unban">Desbanir jogador</option>
                </select>
              </div>
              {accountAction === "set-avatar" && (
                <div className={styles.field}><label htmlFor="support-player-avatar">Imagem do jogador</label><input id="support-player-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { setError("A imagem deve ter no máximo 5 MB."); return; } const reader = new FileReader(); reader.onload = () => setAvatarDataUrl(String(reader.result ?? "")); reader.readAsDataURL(file); }} /><small>PNG, JPG ou WebP · máximo 5 MB</small></div>
              )}
              {accountAction === "set-nickname" && (
                <>
                  <div className={styles.field}><label htmlFor="support-nickname">Apelido</label><input id="support-nickname" value={nickname} maxLength={48} onChange={(event) => setNickname(event.target.value)} placeholder="Ex.: Problema da Divisão" /></div>
                  <div className={styles.field}><label htmlFor="support-nickname-color">Cor</label><select id="support-nickname-color" value={nicknameColor} onChange={(event) => setNicknameColor(event.target.value as typeof nicknameColor)}><option value="purple">Roxo</option><option value="gold">Dourado</option><option value="red">Vermelho</option></select></div>
                </>
              )}
              {accountAction === "adjust-mmr" && (
                <div className={styles.field}>
                  <label htmlFor="support-new-mmr">Novo MMR absoluto</label>
                  <input id="support-new-mmr" type="number" min="800" step="1" value={newMmr} onChange={(event) => setNewMmr(event.target.value)} />
                </div>
              )}
              {(accountAction === "freeze" || accountAction === "penalize" || accountAction === "ban") && (
                <div className={styles.field}>
                  <label htmlFor="support-duration">
                    Duração em minutos {accountAction === "ban" ? "(máximo de 100 horas)" : ""}
                  </label>
                  <input
                    id="support-duration"
                    type="number"
                    min="1"
                    max={accountAction === "ban" ? 6000 : 525600}
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
