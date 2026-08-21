import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ArenaStats, CommunityBanner, CreatorsSection, HowItWorksSection, NextEventSection, RankingsCta } from "@/components/home-sections";
import { CategoryComparison } from "@/components/category-comparison";
import { ChampionsGrid } from "@/components/champions-grid";
import { HomeHero } from "@/components/home-hero";
import { RankingExplorer } from "@/components/ranking-explorer";
import { SectionHeading } from "@/components/section-heading";
import { Ticker } from "@/components/ticker";
import { getCategoryPlayerRankingKey } from "@/lib/arena-competition";
import { getPublicArenaCompetitionData } from "@/lib/arena-cards-server";
import { createPageMetadata } from "@/lib/metadata";
import { getPublicPlayerNicknames } from "@/lib/player-nicknames-server";

export const metadata = createPageMetadata(
  "WOF Arena X1 BR | Rankings, Eventos e Cinturões",
  "A comunidade competitiva de x1 do World of Football. Participe de eventos semanais, suba no ranking e dispute os cinturões da Arena X1 Brasil.",
  true,
);

export const dynamic = "force-dynamic";

export default async function Home() {
  const [competition, nicknames] = await Promise.all([
    getPublicArenaCompetitionData(),
    getPublicPlayerNicknames(),
  ]);
  const entriesByPlayer = new Map(
    competition.rankingEntries.map((entry) => [
      getCategoryPlayerRankingKey(entry.categoryId, entry.playerId),
      entry,
    ]),
  );
  return (
    <>
      <HomeHero />
      <Ticker />
      <ArenaStats />

      <NextEventSection cards={competition.cards} nicknames={nicknames} />

      <section className="section section--graphite">
        <div className="page-container">
          <SectionHeading
            eyebrow="Cinturões AXB"
            title={<>O topo tem <span className="title-accent">outro peso</span></>}
            description="Três categorias, três cinturões e uma responsabilidade: defender o posto contra os melhores da Arena."
          />
          <ChampionsGrid
            entriesByPlayer={entriesByPlayer}
            championsByCategory={competition.championsByCategory}
            nicknames={nicknames}
          />
          <Link href="/categorias" className="button-ghost section-cta">
            Conhecer os cinturões <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="section ranking-home-section">
        <div className="page-container">
          <SectionHeading
            eyebrow="Ranking em destaque"
            title={<>Cada resultado <span className="title-accent">muda o jogo</span></>}
            description="A classificação nunca zera. Pontos, saldo de gols e confrontos diretos mantêm a disputa em movimento durante toda a história da Arena."
          />
          <RankingExplorer
            compact
            entriesByPlayer={entriesByPlayer}
            championIdsByCategory={competition.championIdsByCategory}
            nicknames={nicknames}
          />
          <RankingsCta />
        </div>
      </section>

      <section className="section section--graphite categories-home-section">
        <div className="page-container">
          <SectionHeading
            eyebrow="Categorias oficiais"
            title={<>Escolha o seu <span className="title-accent">estilo de jogo</span></>}
            description="Altura, largura e impulso definem o perfil de cada divisão. Os demais atributos do personagem são livres."
          />
          <CategoryComparison />
          <Link href="/categorias" className="button-ghost section-cta">
            Comparar categorias <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <HowItWorksSection />
      <CommunityBanner />
      <CreatorsSection />
    </>
  );
}
