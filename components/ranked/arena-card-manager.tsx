"use client";

import {
  CalendarPlus,
  CheckCircle2,
  CirclePlay,
  Crown,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { officialPlayers } from "@/data/arena";
import type { ArenaCard, ArenaCardMatch } from "@/lib/arena-card-types";
import type { RankedSupportIntent } from "./adapter";
import styles from "./ranked.module.css";
import { useDialogFocusTrap } from "./use-dialog-focus-trap";

interface ArenaCardManagerProps {
  readonly cards: readonly ArenaCard[];
  readonly busy: boolean;
  readonly onSubmit: (payload: RankedSupportIntent) => Promise<unknown>;
}

type MatchDraft = {
  matchId?: string;
  cardId: string;
  categoryId: ArenaCardMatch["categoryId"];
  playerAId: string;
  playerBId: string;
  matchType: ArenaCardMatch["type"];
  scheduledAt: string;
};

function playerName(id: string) {
  return officialPlayers.find((player) => player.id === id)?.name ?? id;
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function statusLabel(status: ArenaCard["status"]) {
  return status === "live" ? "Ao vivo" : status === "finished" ? "Finalizado" : status === "draft" ? "Rascunho" : "Anunciado";
}

export function ArenaCardManager({ cards, busy, onSubmit }: ArenaCardManagerProps) {
  const players = useMemo(
    () => [...officialPlayers].filter((player) => player.status === "active").sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [],
  );
  const [creating, setCreating] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardName, setCardName] = useState("AXB CARD");
  const [cardStartsAt, setCardStartsAt] = useState("");
  const [matchDraft, setMatchDraft] = useState<MatchDraft | null>(null);
  const [finishingCard, setFinishingCard] = useState<ArenaCard | null>(null);
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});
  const run = (task: Promise<unknown>) => { void task.catch(() => undefined); };

  const submitCreate = async () => {
    await onSubmit({ intent: "create-arena-card", name: cardName.trim(), startsAt: toIso(cardStartsAt) });
    setCreating(false);
    setCardName("AXB CARD");
    setCardStartsAt("");
  };

  const beginEditCard = (card: ArenaCard) => {
    setEditingCardId(editingCardId === card.id ? null : card.id);
    setCardName(card.name);
    setCardStartsAt(toLocalDateTime(card.startsAt));
  };

  const saveCard = async (card: ArenaCard) => {
    await onSubmit({
      intent: "update-arena-card",
      cardId: card.id,
      name: cardName.trim(),
      startsAt: toIso(cardStartsAt),
    });
  };

  const beginMatch = (card: ArenaCard, match?: ArenaCardMatch) => {
    setMatchDraft({
      cardId: card.id,
      ...(match ? { matchId: match.id } : {}),
      categoryId: match?.categoryId ?? "peso-medio",
      playerAId: match?.playerAId ?? players[0]?.id ?? "",
      playerBId: match?.playerBId ?? players[1]?.id ?? "",
      matchType: match?.type ?? "normal",
      scheduledAt: toLocalDateTime(match?.scheduledAt ?? card.startsAt),
    });
  };

  const saveMatch = async () => {
    if (!matchDraft) return;
    await onSubmit({
      intent: "upsert-arena-card-match",
      cardId: matchDraft.cardId,
      ...(matchDraft.matchId ? { matchId: matchDraft.matchId } : {}),
      categoryId: matchDraft.categoryId,
      playerAId: matchDraft.playerAId,
      playerBId: matchDraft.playerBId,
      matchType: matchDraft.matchType,
      scheduledAt: toIso(matchDraft.scheduledAt),
    });
    setMatchDraft(null);
  };

  const beginFinish = (card: ArenaCard) => {
    setFinishingCard(card);
    setScores(Object.fromEntries(card.matches.map((match) => [
      match.id,
      { a: String(match.playerAScore ?? 0), b: String(match.playerBScore ?? 0) },
    ])));
  };

  const finishCard = async () => {
    if (!finishingCard) return;
    await onSubmit({
      intent: "finish-arena-card",
      cardId: finishingCard.id,
      results: finishingCard.matches.map((match) => ({
        matchId: match.id,
        playerAScore: Number(scores[match.id]?.a ?? 0),
        playerBScore: Number(scores[match.id]?.b ?? 0),
      })),
    });
    setFinishingCard(null);
  };

  return (
    <section className={`${styles.supportPanel} ${styles.arenaCardManager}`} aria-labelledby="arena-card-manager-title">
      <div className={styles.arenaCardManagerHeader}>
        <div>
          <span className={styles.microLabel}>Eventos oficiais</span>
          <h2 id="arena-card-manager-title">Gerenciar cards</h2>
          <p>Crie confrontos, defina horários, inicie o evento e publique os resultados.</p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            setCardName(`AXB CARD ${String(cards.length + 1).padStart(2, "0")}`);
            setCardStartsAt("");
            setCreating(true);
          }}
        >
          <CalendarPlus size={17} aria-hidden="true" /> Criar Card
        </button>
      </div>

      <div className={styles.arenaCardsAdminList}>
        {cards.map((card) => {
          const editable = card.status === "announced" || card.status === "draft";
          return (
            <article key={card.id} className={styles.arenaCardAdminItem}>
              <div className={styles.arenaCardAdminSummary}>
                <div>
                  <span className={styles.statusPill}>{statusLabel(card.status)}</span>
                  <h3>{card.name}</h3>
                  <p>{card.matches.length} confronto(s) • {card.startsAt ? new Date(card.startsAt).toLocaleString("pt-BR") : "data a definir"}</p>
                </div>
                <div className={styles.arenaCardActions}>
                  {editable && <button type="button" className={styles.secondaryButton} onClick={() => beginEditCard(card)}><Pencil size={15} /> Editar Card</button>}
                  {editable && <button type="button" className={styles.primaryButton} disabled={busy || card.matches.length === 0} onClick={() => {
                    if (window.confirm(`Iniciar ${card.name} agora?`)) run(onSubmit({ intent: "start-arena-card", cardId: card.id }));
                  }}><CirclePlay size={15} /> Iniciar Card</button>}
                  {card.status === "live" && <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => beginFinish(card)}><CheckCircle2 size={15} /> Finalizar Card</button>}
                  <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => {
                    if (window.confirm(`Excluir permanentemente ${card.name}?`)) run(onSubmit({ intent: "delete-arena-card", cardId: card.id }));
                  }}><Trash2 size={15} /> Excluir</button>
                </div>
              </div>

              {editingCardId === card.id && editable && (
                <div className={styles.arenaCardEditor}>
                  <div className={styles.arenaCardMetaEditor}>
                    <div className={styles.field}><label htmlFor={`card-name-${card.id}`}>Nome do card</label><input id={`card-name-${card.id}`} value={cardName} onChange={(event) => setCardName(event.target.value)} /></div>
                    <div className={styles.field}><label htmlFor={`card-date-${card.id}`}>Data e hora geral</label><input id={`card-date-${card.id}`} type="datetime-local" value={cardStartsAt} onChange={(event) => setCardStartsAt(event.target.value)} /></div>
                    <button type="button" className={styles.secondaryButton} disabled={busy || cardName.trim().length < 3} onClick={() => run(saveCard(card))}><Save size={15} /> Salvar Card</button>
                  </div>
                  <div className={styles.arenaMatchAdminList}>
                    {card.matches.map((match) => (
                      <div key={match.id} className={styles.arenaMatchAdminItem}>
                        <div><strong>{playerName(match.playerAId)} × {playerName(match.playerBId)}</strong><span>{match.categoryId === "peso-pena" ? "Peso Leve" : match.categoryId === "peso-medio" ? "Peso Médio" : "Peso Pesado"} • {match.type === "belt" ? "Cinturão" : "Normal"}</span></div>
                        <button type="button" className={styles.iconButton} onClick={() => beginMatch(card, match)} aria-label={`Editar ${playerName(match.playerAId)} contra ${playerName(match.playerBId)}`}><Pencil size={16} /></button>
                        <button type="button" className={styles.iconButton} onClick={() => {
                          if (window.confirm("Remover este confronto?")) run(onSubmit({ intent: "delete-arena-card-match", cardId: card.id, matchId: match.id }));
                        }} aria-label="Remover confronto"><Trash2 size={16} /></button>
                      </div>
                    ))}
                    <button type="button" className={styles.secondaryButton} onClick={() => beginMatch(card)}><Plus size={16} /> Adicionar confronto</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {cards.length === 0 && <div className={styles.emptyCompact}>Nenhum card criado.</div>}
      </div>

      {creating && (
        <CardDialog title="Criar novo card" busy={busy} onClose={() => setCreating(false)}>
          <div className={styles.field}><label htmlFor="new-card-name">Nome</label><input id="new-card-name" value={cardName} onChange={(event) => setCardName(event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="new-card-date">Data e hora geral</label><input id="new-card-date" type="datetime-local" value={cardStartsAt} onChange={(event) => setCardStartsAt(event.target.value)} /></div>
          <button type="button" className={styles.primaryButton} disabled={busy || cardName.trim().length < 3} onClick={() => run(submitCreate())}><CalendarPlus size={17} /> Criar Card</button>
        </CardDialog>
      )}

      {matchDraft && (
        <CardDialog title={matchDraft.matchId ? "Editar confronto" : "Adicionar confronto"} busy={busy} onClose={() => setMatchDraft(null)}>
          <div className={styles.field}><label htmlFor="arena-category">Categoria</label><select id="arena-category" value={matchDraft.categoryId} onChange={(event) => setMatchDraft({ ...matchDraft, categoryId: event.target.value as MatchDraft["categoryId"] })}><option value="peso-pena">Peso Leve</option><option value="peso-medio">Peso Médio</option><option value="peso-pesado">Peso Pesado</option></select></div>
          <div className={styles.arenaPlayerSelects}>
            <div className={styles.field}><label htmlFor="arena-player-a">Jogador A</label><select id="arena-player-a" value={matchDraft.playerAId} onChange={(event) => setMatchDraft({ ...matchDraft, playerAId: event.target.value })}>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
            <div className={styles.field}><label htmlFor="arena-player-b">Jogador B</label><select id="arena-player-b" value={matchDraft.playerBId} onChange={(event) => setMatchDraft({ ...matchDraft, playerBId: event.target.value })}>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
          </div>
          <div className={styles.field}><label htmlFor="arena-match-type">Tipo</label><select id="arena-match-type" value={matchDraft.matchType} onChange={(event) => setMatchDraft({ ...matchDraft, matchType: event.target.value as MatchDraft["matchType"] })}><option value="normal">Normal</option><option value="belt">Valendo cinturão</option></select></div>
          <div className={styles.field}><label htmlFor="arena-match-time">Horário</label><input id="arena-match-time" type="datetime-local" value={matchDraft.scheduledAt} onChange={(event) => setMatchDraft({ ...matchDraft, scheduledAt: event.target.value })} /></div>
          {matchDraft.matchType === "belt" && <p className={styles.formHint}><Crown size={15} /> Este confronto será destacado como disputa de cinturão.</p>}
          <button type="button" className={styles.primaryButton} disabled={busy || matchDraft.playerAId === matchDraft.playerBId} onClick={() => run(saveMatch())}><Save size={17} /> Salvar confronto</button>
        </CardDialog>
      )}

      {finishingCard && (
        <CardDialog title={`Finalizar ${finishingCard.name}`} busy={busy} onClose={() => setFinishingCard(null)} wide>
          <p className={styles.formHint}>Informe todos os placares. Empates não são permitidos.</p>
          <div className={styles.arenaResultsGrid}>
            {finishingCard.matches.map((match) => (
              <div key={match.id} className={styles.arenaResultRow}>
                <label htmlFor={`score-a-${match.id}`}>{playerName(match.playerAId)}</label>
                <input id={`score-a-${match.id}`} type="number" min="0" max="999" value={scores[match.id]?.a ?? "0"} onChange={(event) => setScores({ ...scores, [match.id]: { a: event.target.value, b: scores[match.id]?.b ?? "0" } })} />
                <span>×</span>
                <input aria-label={`Gols de ${playerName(match.playerBId)}`} type="number" min="0" max="999" value={scores[match.id]?.b ?? "0"} onChange={(event) => setScores({ ...scores, [match.id]: { a: scores[match.id]?.a ?? "0", b: event.target.value } })} />
                <label>{playerName(match.playerBId)}</label>
              </div>
            ))}
          </div>
          <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => run(finishCard())}><CheckCircle2 size={17} /> Publicar resultados e finalizar</button>
        </CardDialog>
      )}
    </section>
  );
}

function CardDialog({
  title,
  busy,
  onClose,
  wide = false,
  children,
}: {
  readonly title: string;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly wide?: boolean;
  readonly children: React.ReactNode;
}) {
  const dialogRef = useDialogFocusTrap<HTMLElement>(true, () => { if (!busy) onClose(); });
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section ref={dialogRef} tabIndex={-1} className={`${styles.formDialog}${wide ? ` ${styles.formDialogWide}` : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.formDialogHeader}><div><span className={styles.microLabel}>Central de suporte</span><h2>{title}</h2></div><button ref={firstButtonRef} type="button" className={styles.iconButton} disabled={busy} onClick={onClose} aria-label="Fechar"><X /></button></div>
        <div className={styles.formGrid}>{children}</div>
      </section>
    </div>
  );
}
