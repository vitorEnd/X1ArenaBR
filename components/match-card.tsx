import { CalendarDays, Clock3, MapPin, Swords } from "lucide-react";
import { categories, officialPlayers } from "@/data/arena";
import type { Event, Match } from "@/lib/types";

const typeLabels: Record<Match["type"], string> = {
  normal: "Normal",
  challenge: "Desafio",
  rematch: "Revanche",
  belt: "Cinturão",
  unification: "Unificação",
};

const statusLabels: Record<Match["status"], string> = {
  awaiting: "Aguardando",
  confirmed: "Confirmado",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

const methodLabels: Record<NonNullable<Match["result"]>["method"], string> = {
  regular: "Tempo regular",
  "golden-goal": "Gol de ouro",
  knockout: "Nocaute",
  walkover: "W.O.",
};

export function MatchCard({ match, event }: { match: Match; event: Event }) {
  const playerA = officialPlayers.find((player) => player.id === match.playerAId);
  const playerB = officialPlayers.find((player) => player.id === match.playerBId);
  const category = categories.find((item) => item.id === match.categoryId);
  const startsAt = new Date(match.scheduledAt ?? event.startsAt);
  const score = match.result?.score;

  return (
    <article className="match-card">
      <div className="match-card__top">
        <span className={`status-badge status-badge--${match.status}`}>
          {statusLabels[match.status]}
        </span>
        <span>{typeLabels[match.type]}</span>
      </div>
      <div className="match-card__meta">
        <span><CalendarDays size={14} /> {startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: event.timeZone })}</span>
        <span><Clock3 size={14} /> {startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: event.timeZone })}</span>
        <span><MapPin size={14} /> {event.venue}</span>
      </div>
      <div className="match-card__versus">
        <div>
          <span>A</span>
          <strong>{playerA?.name ?? "Jogador a definir"}</strong>
        </div>
        {score ? (
          <div className="match-card__score" aria-label={`Placar ${score.playerA} a ${score.playerB}`}>
            <b>{score.playerA}</b><i>—</i><b>{score.playerB}</b>
          </div>
        ) : (
          <div className="match-card__vs"><Swords size={19} /><b>VS</b></div>
        )}
        <div>
          <span>B</span>
          <strong>{playerB?.name ?? "Jogador a definir"}</strong>
        </div>
      </div>
      <div className="match-card__bottom">
        <span>{category?.name}</span>
        {match.result && <span>{methodLabels[match.result.method]}</span>}
      </div>
    </article>
  );
}
