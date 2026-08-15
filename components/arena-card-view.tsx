import { CalendarDays, Clock3, Crown, MapPin, Radio, Swords } from "lucide-react";
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

function ArenaMatch({ match, card }: { match: ArenaCardMatch; card: ArenaCard }) {
  const scheduledAt = match.scheduledAt ?? card.startsAt;
  const hasScore = match.playerAScore !== null && match.playerBScore !== null;
  return (
    <article className={`match-card arena-match-card${match.type === "belt" ? " arena-match-card--belt" : ""}`}>
      <div className="match-card__top">
        <span className={`status-badge status-badge--${match.status}`}>
          {match.status === "live" ? "Ao vivo" : match.status === "finished" ? "Finalizado" : "Confirmado"}
        </span>
        <span className="arena-match-type">
          {match.type === "belt" && <Crown size={14} aria-hidden="true" />}
          {match.type === "belt" ? "Valendo cinturão" : "Confronto normal"}
        </span>
      </div>
      <div className="match-card__meta">
        <span><CalendarDays size={14} /> {formatDate(scheduledAt)}</span>
        <span><Clock3 size={14} /> {formatTime(scheduledAt)}</span>
        <span><MapPin size={14} /> Park</span>
      </div>
      <div className="match-card__versus">
        <div><span>A</span><Link href={`/jogadores/${playerSlug(match.playerAId)}`}>{playerName(match.playerAId)}</Link></div>
        {hasScore ? (
          <div className="match-card__score" aria-label={`Placar ${match.playerAScore} a ${match.playerBScore}`}>
            <b>{match.playerAScore}</b><i>—</i><b>{match.playerBScore}</b>
          </div>
        ) : (
          <div className="match-card__vs"><Swords size={19} /><b>VS</b></div>
        )}
        <div><span>B</span><Link href={`/jogadores/${playerSlug(match.playerBId)}`}>{playerName(match.playerBId)}</Link></div>
      </div>
      <div className="match-card__bottom">
        <span>{categoryLabels[match.categoryId]}</span>
        {match.winnerPlayerId && <span>Vencedor: {playerName(match.winnerPlayerId)}</span>}
      </div>
    </article>
  );
}

export function ArenaCardView({ card }: { readonly card: ArenaCard }) {
  const categories = (["peso-medio", "peso-pena", "peso-pesado"] as const)
    .map((categoryId) => ({
      categoryId,
      matches: card.matches.filter((match) => match.categoryId === categoryId),
    }))
    .filter((group) => group.matches.length > 0);

  return (
    <article className={`official-event-card arena-card-view arena-card-view--${card.status}`}>
      <div className="event-card-heading">
        <div>
          <span>{card.status === "live" ? "Card em andamento" : "Card oficial"}</span>
          <h2>{card.name}</h2>
        </div>
        <dl>
          <div><dt>Status</dt><dd>{card.status === "live" && <Radio size={14} />} {statusLabels[card.status]}</dd></div>
          <div><dt>Data</dt><dd>{formatDate(card.startsAt)}</dd></div>
          <div><dt>Local</dt><dd>{card.venue}</dd></div>
        </dl>
      </div>
      <div className="arena-card-categories">
        {categories.map((group) => (
          <section key={group.categoryId} className="arena-card-category" aria-labelledby={`${card.id}-${group.categoryId}`}>
            <div className="arena-card-category__heading">
              <span>{String(group.matches.length).padStart(2, "0")} confrontos</span>
              <h3 id={`${card.id}-${group.categoryId}`}>{categoryLabels[group.categoryId]}</h3>
            </div>
            <div className="matches-grid">
              {group.matches.map((match) => <ArenaMatch key={match.id} match={match} card={card} />)}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
