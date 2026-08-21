import { PlayerDirectory } from "@/components/player-directory";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import {
  getPublicOfficialPlayers,
  getPublicPlayerRankingEntries,
} from "@/lib/arena-cards-server";
import { createPageMetadata } from "@/lib/metadata";
import { getPublicPlayerNicknames } from "@/lib/player-nicknames-server";

export const metadata = createPageMetadata("Jogadores", "Diretório e perfis individuais de jogadores da WOF Arena X1 BR.");

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [rankingEntries, nicknames, players] = await Promise.all([
    getPublicPlayerRankingEntries(),
    getPublicPlayerNicknames(),
    getPublicOfficialPlayers(),
  ]);
  const entriesByPlayer = new Map(
    rankingEntries.map((entry) => [entry.playerId, entry]),
  );

  return (
    <>
      <PageHero eyebrow="Nomes • Números • Histórias" title="Jogadores" description="Conheça os competidores oficiais que já fazem parte da Arena X1 Brasil." />
      <section className="section">
        <div className="page-container">
          <SectionHeading eyebrow="Diretório da Arena" title={<>Encontre quem está <span className="title-accent">na disputa</span></>} description="Busque por nome, filtre por categoria e acompanhe os jogadores inscritos na Arena." />
          <PlayerDirectory
            entries={entriesByPlayer}
            nicknames={nicknames}
            players={players}
          />
        </div>
      </section>
    </>
  );
}
