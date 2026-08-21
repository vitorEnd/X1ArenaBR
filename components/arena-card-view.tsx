import {
  CalendarDays,
  Clock3,
  Crown,
  Goal,
  MapPin,
  Radio,
  Swords,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { officialPlayers } from "@/data/arena";
import type { ArenaCard, ArenaCardMatch } from "@/lib/arena-card-types";
import type { CategoryId } from "@/lib/types";

const categoryLabels: Record<CategoryId, string> = {
  "peso-pena": "Peso Leve",
  "peso-medio": "Peso Médio",
  "peso-pesado": "Peso Pesado",
};

const statusLabels: Record<ArenaCard["status"], string> = {
  draft: "Rascunho",
  announced: "Confirmado",
  live: "Ao vivo",
  finished: "Finalizado",
};

type ArenaCardVariant = "schedule" | "history";

function formatDate(value: string | null) {
  if (!value) return "Data a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "Horário a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function playerName(id: string) {
  return officialPlayers.find((player) => player.id === id)?.name ?? id;
}

function playerSlug(id: string) {
  return officialPlayers.find((player) => player.id === id)?.slug ?? id;
}

function matchStatusLabel(status: ArenaCardMatch["status"]) {
  if (status === "live") return "Ao vivo";
  if (status === "finished") return "Finalizado";
  return "Confirmado";
}

function matchCountLabel(count: number) {
  return `${String(count).padStart(2, "0")} ${count === 1 ? "confronto" : "confrontos"}`;
}

function ArenaMatch({
  match,
  card,
  variant,
}: {
  match: ArenaCardMatch;
  card: ArenaCard;
  variant: ArenaCardVariant;
}) {
  const scheduledAt = match.scheduledAt ?? card.startsAt;
  const hasScore = match.playerAScore !== null && match.playerBScore !== null;
  const playerAWon = match.winnerPlayerId === match.playerAId;
  const playerBWon = match.winnerPlayerId === match.playerBId;
  const categoryLabel = categoryLabels[match.categoryId];
  const matchLabel = `${playerName(match.playerAId)} contra ${playerName(match.playerBId)}`;

  return (
    <article
      className={`match-card arena-match-card arena-match-card--${variant}${match.type === "belt" ? " arena-match-card--belt" : ""}`}
      aria-label={matchLabel}
    >
      {match.type === "belt" && (
        <div className="arena-belt-banner">
          <Crown aria-hidden="true" />
          <div>
            <span>Valendo cinturão</span>
            <strong>Disputa pelo título</strong>
            <small>{categoryLabel}</small>
          </div>
          <i aria-hidden="true" />
        </div>
      )}

      <div className="match-card__top">
        <span className={`status-badge status-badge--${match.status}`}>
          {match.status === "live" && <span className="arena-live-dot" aria-hidden="true" />}
          {matchStatusLabel(match.status)}
        </span>
        <span className="arena-match-number">Confronto {String(match.position).padStart(2, "0")}</span>
      </div>

      <div className="match-card__meta">
        <span><CalendarDays size={14} aria-hidden="true" /> {formatDate(scheduledAt)}</span>
        <span><Clock3 size={14} aria-hidden="true" /> {formatTime(scheduledAt)}</span>
        <span><MapPin size={14} aria-hidden="true" /> Park</span>
      </div>

      <div className="match-card__versus">
        <div className={playerAWon ? "match-card__player match-card__player--winner" : "match-card__player"}>
          <span>
            Jogador A
            {playerAWon && <em><Trophy size={11} aria-hidden="true" /> Vencedor</em>}
          </span>
          <Link href={`/jogadores/${playerSlug(match.playerAId)}`}>{playerName(match.playerAId)}</Link>
        </div>

        {hasScore ? (
          <div className="match-card__score" aria-label={`Placar final: ${match.playerAScore} a ${match.playerBScore}`}>
            <span>Placar final</span>
            <div aria-hidden="true"><b>{match.playerAScore}</b><i>—</i><b>{match.playerBScore}</b></div>
          </div>
        ) : (
          <div className="match-card__vs" aria-hidden="true"><Swords size={18} /><b>VS</b></div>
        )}

        <div className={playerBWon ? "match-card__player match-card__player--winner" : "match-card__player"}>
          <span>
            Jogador B
            {playerBWon && <em><Trophy size={11} aria-hidden="true" /> Vencedor</em>}
          </span>
          <Link href={`/jogadores/${playerSlug(match.playerBId)}`}>{playerName(match.playerBId)}</Link>
        </div>
      </div>

      <div className="match-card__bottom">
        <span>{categoryLabel}</span>
        <span className="arena-match-type">
          {match.type === "belt" && <Crown size={13} aria-hidden="true" />}
          {match.type === "belt" ? "Cinturão" : "Confronto normal"}
        </span>
      </div>
    </article>
  );
}

export function ArenaCardView({
  card,
  variant = "schedule",
}: {
  readonly card: ArenaCard;
  readonly variant?: ArenaCardVariant;
}) {
  const categories = (["peso-medio", "peso-pena", "peso-pesado"] as const)
    .map((categoryId) => ({
      categoryId,
      matches: card.matches.filter((match) => match.categoryId === categoryId),
    }))
    .filter((group) => group.matches.length > 0);
  const beltMatches = card.matches.filter((match) => match.type === "belt").length;
  const completedMatches = card.matches.filter((match) => match.status === "finished").length;
  const totalGoals = card.matches.reduce((total, match) => {
    if (match.playerAScore === null || match.playerBScore === null) return total;
    return total + match.playerAScore + match.playerBScore;
  }, 0);
  const cardHeadingId = `arena-card-${card.id}-title`;
  const CardHeading = variant === "history" ? "h4" : "h3";
  const CategoryHeading = variant === "history" ? "h5" : "h4";

  return (
    <article
      className={`official-event-card arena-card-view arena-card-view--${card.status} arena-card-view--${variant}`}
      aria-labelledby={cardHeadingId}
    >
      <header className="event-card-heading">
        <div className="event-card-heading__identity">
          <span className="event-card-heading__eyebrow">
            {card.status === "live" && <Radio size={14} aria-hidden="true" />}
            {variant === "history" ? "Registro oficial" : card.status === "live" ? "Card em andamento" : "Card oficial"}
          </span>
          <CardHeading id={cardHeadingId}>{card.name}</CardHeading>
          <p className="event-card-heading__schedule">
            <span><CalendarDays size={15} aria-hidden="true" /> <time dateTime={card.startsAt ?? undefined}>{formatDate(card.startsAt)}</time></span>
            <span><Clock3 size={15} aria-hidden="true" /> {formatTime(card.startsAt)}</span>
            <span><MapPin size={15} aria-hidden="true" /> {card.venue}</span>
          </p>
        </div>

        <div className="event-card-heading__overview">
          <span className={`event-card-status event-card-status--${card.status}`}>{statusLabels[card.status]}</span>
          <dl>
            <div><dt>Confrontos</dt><dd>{card.matches.length}</dd></div>
            <div><dt>Cinturões</dt><dd>{beltMatches}</dd></div>
            {variant === "history" ? (
              <>
                <div><dt>Finalizados</dt><dd>{completedMatches}</dd></div>
                <div><dt>Gols</dt><dd><Goal size={15} aria-hidden="true" /> {totalGoals}</dd></div>
              </>
            ) : (
              <div><dt>Categorias</dt><dd>{categories.length}</dd></div>
            )}
          </dl>
        </div>
      </header>

      <div className="arena-card-categories">
        {categories.map((group) => {
          const categoryHeadingId = `${card.id}-${group.categoryId}`;
          return (
            <section key={group.categoryId} className="arena-card-category" aria-labelledby={categoryHeadingId}>
              <div className="arena-card-category__heading">
                <CategoryHeading id={categoryHeadingId}>{categoryLabels[group.categoryId]}</CategoryHeading>
                <span>{matchCountLabel(group.matches.length)}</span>
              </div>
              <div className="matches-grid">
                {group.matches.map((match) => (
                  <ArenaMatch key={match.id} match={match} card={card} variant={variant} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
