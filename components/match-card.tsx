import { CalendarDays, Clock3, MapPin, Swords } from "lucide-react";
import { OfficialPlayerAvatar } from "@/components/official-player-avatar";
import { categories, officialPlayers } from "@/data/arena";
import { createPlayerNicknameMap } from "@/lib/player-nicknames";
import type { Event, Match, Player, PlayerNickname } from "@/lib/types";
import { PlayerNicknameBadge } from "./player-nickname-badge";

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

export function MatchCard({
  match,
  event,
  nicknames = [],
  players = officialPlayers,
}: {
  match: Match;
  event: Event;
  nicknames?: readonly PlayerNickname[];
  players?: readonly Player[];
}) {
  const playerA = players.find((player) => player.id === match.playerAId);
  const playerB = players.find((player) => player.id === match.playerBId);
  const category = categories.find((item) => item.id === match.categoryId);
  const startsAt = new Date(match.scheduledAt ?? event.startsAt);
  const score = match.result?.score;
  const nicknameByPlayer = createPlayerNicknameMap(nicknames);

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
          <div className="match-card__participant-avatar">
            <OfficialPlayerAvatar
              player={playerA}
              size={104}
              sizes="52px"
              alt=""
              fallbackSize={21}
            />
          </div>
          <span>A</span>
          <strong>{playerA?.name ?? "Jogador a definir"}</strong>
          {nicknameByPlayer.get(match.playerAId) && (
            <PlayerNicknameBadge
              nickname={nicknameByPlayer.get(match.playerAId)!}
              size="compact"
            />
          )}
        </div>
        {score ? (
          <div className="match-card__score" aria-label={`Placar ${score.playerA} a ${score.playerB}`}>
            <b>{score.playerA}</b><i>—</i><b>{score.playerB}</b>
          </div>
        ) : (
          <div className="match-card__vs"><Swords size={19} /><b>VS</b></div>
        )}
        <div>
          <div className="match-card__participant-avatar">
            <OfficialPlayerAvatar
              player={playerB}
              size={104}
              sizes="52px"
              alt=""
              fallbackSize={21}
            />
          </div>
          <span>B</span>
          <strong>{playerB?.name ?? "Jogador a definir"}</strong>
          {nicknameByPlayer.get(match.playerBId) && (
            <PlayerNicknameBadge
              nickname={nicknameByPlayer.get(match.playerBId)!}
              size="compact"
            />
          )}
        </div>
      </div>
      <div className="match-card__bottom">
        <span>{category?.name}</span>
        {match.result && <span>{methodLabels[match.result.method]}</span>}
      </div>
    </article>
  );
}
