import type { Metadata } from "next";
import { ArrowLeft, Crown, History, Shield, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchCard } from "@/components/match-card";
import { DEMO_DATA_LABEL, categories, exampleEvents, exampleMatches, examplePlayers, exampleRankingEntries, officialBeltHistory, officialEvents, officialMatches, officialPlayers, officialRankingEntries } from "@/data/arena";
import { buildCategoryRanking, calculateGoalDifference, calculateRankingPoints } from "@/lib/ranking";

type PlayerPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...officialPlayers, ...examplePlayers].map((player) => ({ slug: player.slug }));
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const player = [...officialPlayers, ...examplePlayers].find((item) => item.slug === slug);
  if (!player) return { title: "Jogador não encontrado" };
  const description = `${player.dataStatus === "example" ? "Perfil demonstrativo" : "Perfil oficial"} de ${player.name} na WOF Arena X1 BR.`;
  return { title: player.name, description, openGraph: { title: player.name, description, images: [{ url: "/og.png", width: 1736, height: 906, alt: "WOF Arena X1 BR — Onde cada X1 vira história" }] }, twitter: { title: player.name, description, images: ["/og.png"] } };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { slug } = await params;
  const player = [...officialPlayers, ...examplePlayers].find((item) => item.slug === slug);
  if (!player) notFound();
  const category = categories.find((item) => item.id === player.currentCategoryId)!;
  const sourceRankingEntries = player.dataStatus === "official" ? officialRankingEntries : exampleRankingEntries;
  const entry = sourceRankingEntries.find((item) => item.playerId === player.id);
  const ranking = buildCategoryRanking(sourceRankingEntries, player.currentCategoryId);
  const standing = ranking.standings.find((item) => item.playerId === player.id);
  const sourceMatches = player.dataStatus === "official" ? officialMatches : exampleMatches;
  const sourceEvents = player.dataStatus === "official" ? officialEvents : exampleEvents;
  const history = sourceMatches.filter((match) => match.playerAId === player.id || match.playerBId === player.id);
  const beltHistory = officialBeltHistory.filter((record) => record.playerId === player.id);

  return (
    <>
      <section className="player-profile-hero">
        <div className="page-container player-profile-hero__inner">
          <Link href="/jogadores" className="profile-back"><ArrowLeft size={17} /> Voltar aos jogadores</Link>
          <div className="player-profile-hero__avatar"><UserRound size={62} aria-hidden="true" /></div>
          <div className="player-profile-hero__copy">
            <span className={player.dataStatus === "example" ? "data-badge" : "status-badge"}>{player.dataStatus === "example" ? DEMO_DATA_LABEL : "REGISTRO OFICIAL"}</span>
            <p>{category.name} • {player.status === "active" ? "Ativo" : "Inativo"}</p>
            <h1>{player.name}</h1>
          </div>
          <div className="player-profile-hero__rank"><span>Ranking</span><strong>{standing?.marker ?? "—"}</strong><small>{category.shortName}</small></div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="page-container">
          <div className="profile-stats-grid">
            <div><span>Pontos</span><strong>{entry ? calculateRankingPoints(entry.wins, entry.losses) : "—"}</strong></div>
            <div><span>Vitórias</span><strong>{entry?.wins ?? "—"}</strong></div>
            <div><span>Derrotas</span><strong>{entry?.losses ?? "—"}</strong></div>
            <div><span>Gols marcados</span><strong>{entry?.goalsFor ?? "—"}</strong></div>
            <div><span>Gols sofridos</span><strong>{entry?.goalsAgainst ?? "—"}</strong></div>
            <div><span>Saldo de gols</span><strong>{entry ? `${calculateGoalDifference(entry.goalsFor, entry.goalsAgainst) > 0 ? "+" : ""}${calculateGoalDifference(entry.goalsFor, entry.goalsAgainst)}` : "—"}</strong></div>
          </div>
          <div className="profile-form-row"><span>Sequência recente</span><div>{entry?.recentForm.map((result, index) => <i key={`${result}-${index}`} className={result === "win" ? "is-win" : "is-loss"}>{result === "win" ? "V" : "D"}</i>)}</div></div>
        </div>
      </section>

      <section className="section section--graphite">
        <div className="page-container">
          <div className="profile-section-heading"><History size={24} /><div><p className="section-kicker">Confrontos</p><h2>Histórico demonstrativo</h2></div></div>
          {history.length ? (
            <div className="matches-grid">
              {history.map((match) => {
                const event = sourceEvents.find((item) => item.id === match.eventId)!;
                return <MatchCard key={match.id} match={match} event={event} />;
              })}
            </div>
          ) : (
            <div className="empty-state"><History size={34} /><h3>Nenhum confronto registrado</h3><p>Este perfil de demonstração ainda não possui histórico vinculado.</p></div>
          )}
        </div>
      </section>

      <section className="section profile-belt-section">
        <div className="page-container profile-belt-card">
          <div><Crown size={38} /><span>Histórico de cinturão</span><h2>{beltHistory.length ? `${beltHistory.length} registro${beltHistory.length === 1 ? "" : "s"} oficial${beltHistory.length === 1 ? "" : "is"}` : "Nenhuma conquista oficial"}</h2><p>{beltHistory.length ? "Conquistas, defesas e movimentações de cinturão registradas pela Arena." : "Defesas, conquistas, perdas e unificações serão listadas aqui quando houver dados oficiais."}</p></div>
          <Shield size={110} aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
