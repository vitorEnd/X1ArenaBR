import { ArrowDownUp, Calculator, Infinity as InfinityIcon, Trophy } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { RankingExplorer } from "@/components/ranking-explorer";
import { SectionHeading } from "@/components/section-heading";
import { arenaRules } from "@/data/arena";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Rankings", "Ranking contínuo por categoria, pontos e saldo de gols da Arena X1 Brasil.");

export default function RankingsPage() {
  return (
    <>
      <PageHero eyebrow="Classificação contínua • Sem temporadas" title="Rankings" description="Toda vitória soma, toda derrota conta e nenhum resultado é apagado. O campeão ocupa a posição C; a fila de desafiantes começa no #1." />
      <section className="ranking-rule-strip">
        <div className="page-container ranking-rule-strip__grid">
          <div><Calculator /><span>Fórmula</span><strong>(V × 2) − D</strong></div>
          <div><Trophy /><span>Vitória</span><strong>+2 PONTOS</strong></div>
          <div><ArrowDownUp /><span>Derrota</span><strong>−1 PONTO</strong></div>
          <div><InfinityIcon /><span>Histórico</span><strong>NUNCA ZERA</strong></div>
        </div>
      </section>
      <section className="section">
        <div className="page-container">
          <SectionHeading eyebrow="Classificação por categoria" title={<>A corrida até <span className="title-accent">o cinturão</span></>} description="Filtre a divisão e busque um jogador. As posições continuam preservadas mesmo quando a lista é filtrada." />
          <RankingExplorer />
        </div>
      </section>
      <section className="section section--graphite">
        <div className="page-container ranking-criteria-layout">
          <SectionHeading eyebrow="Critérios oficiais" title={<>Quando os pontos <span className="title-accent">empatam</span></>} description="Os critérios são aplicados na ordem definida pela Arena. O código também aceita uma decisão manual da organização quando necessária." />
          <ol className="criteria-list">
            {arenaRules.tieBreakers.map((criterion, index) => <li key={criterion}><span>0{index + 1}</span><strong>{criterion}</strong></li>)}
          </ol>
        </div>
      </section>
    </>
  );
}
