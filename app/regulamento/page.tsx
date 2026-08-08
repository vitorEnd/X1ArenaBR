import { ArrowRightLeft, Calculator, CircleAlert, Infinity as InfinityIcon, MapPin, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { arenaRules, glossary } from "@/data/arena";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Regulamento", "Formato, pontuação, desempates, categorias e glossário oficial da WOF Arena X1 BR.");

export default function RulesPage() {
  return (
    <>
      <PageHero eyebrow="Regras oficiais • Ranking contínuo" title="Regulamento" description="A estrutura que mantém cada confronto justo, cada resultado permanente e o caminho até o cinturão transparente." />
      <section className="section rules-intro-section">
        <div className="narrow-container rules-prose">
          <p className="section-kicker">Formato da Arena</p>
          <h2>Competição semanal.<br /><span className="title-accent">História permanente.</span></h2>
          <p>{arenaRules.competition.summary}</p>
          <p>{arenaRules.competition.format}</p>
          <div className="rules-facts"><div><InfinityIcon /><span>Ranking contínuo</span><strong>Sem temporadas ou resets</strong></div><div><MapPin /><span>Local oficial</span><strong>Todos os eventos no Park</strong></div></div>
          <p>{arenaRules.competition.rankingContinuity}</p>
          <h3>A história de cada jogador é construída por:</h3>
          <ul className="rules-chip-list">{arenaRules.competition.playerHistory.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section className="section section--graphite">
        <div className="page-container rules-grid">
          <article className="rule-card rule-card--score"><Calculator size={30} /><span>Pontuação</span><h2>Vitória <b>+2</b><br />Derrota <b>−1</b></h2><code>{arenaRules.scoring.formula}</code></article>
          <article className="rule-card"><ShieldCheck size={30} /><span>Saldo de gols</span><h2>Gols marcados<br />menos sofridos</h2><code>{arenaRules.goalDifference.formula}</code></article>
          <article className="rule-card rule-card--wide"><CircleAlert size={30} /><span>Critérios de desempate</span><ol>{arenaRules.tieBreakers.map((item, index) => <li key={item}><b>0{index + 1}</b>{item}</li>)}</ol></article>
        </div>
      </section>

      <section className="section">
        <div className="narrow-container rules-prose">
          <p className="section-kicker">Entrada e movimentação</p>
          <h2>Escolha, evolua<br /><span className="title-accent">e mude quando quiser</span></h2>
          <h3>Primeira categoria</h3><p>{arenaRules.firstCategory}</p>
          <div className="rules-divider" />
          <h3><ArrowRightLeft size={22} /> Mudança de categoria</h3><p>{arenaRules.categoryChange.eligibility}</p>
          <p>Ao mudar, o jogador leva:</p><ul>{arenaRules.categoryChange.carries.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>{arenaRules.categoryChange.placement}</p><p>{arenaRules.categoryChange.previousMatches}</p><p>{arenaRules.categoryChange.championException}</p>
          <div className="rules-divider" />
          <h3>Jogador inativo</h3><p>{arenaRules.inactivePlayer}</p>
          <h3>Ex-campeão</h3><p>{arenaRules.formerChampion}</p>
        </div>
      </section>

      <section className="section section--graphite glossary-section">
        <div className="page-container">
          <p className="section-kicker">Termos da Arena</p><h2 className="section-title">Glossário <span className="title-accent">AXB</span></h2>
          <dl className="glossary-grid">{glossary.map((item, index) => <div key={item.term}><span>{String(index + 1).padStart(2, "0")}</span><dt>{item.term}</dt><dd>{item.definition}</dd></div>)}</dl>
        </div>
      </section>
    </>
  );
}
