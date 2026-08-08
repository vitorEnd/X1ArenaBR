import { ArrowRightLeft, Crown, ShieldCheck } from "lucide-react";
import { CategoryComparison } from "@/components/category-comparison";
import { ChampionsGrid } from "@/components/champions-grid";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { arenaRules } from "@/data/arena";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Categorias e cinturões", "Peso Pena, Peso Médio e Peso Pesado: atributos, regras e cinturões da Arena X1 Brasil.");

export default function CategoriesPage() {
  return (
    <>
      <PageHero eyebrow="Três divisões • Três cinturões" title="Categorias" description="Cada categoria define limites de altura, largura e impulso. Escolha a divisão que combina com o seu estilo e entre na disputa." />
      <section className="section">
        <div className="page-container">
          <SectionHeading eyebrow="Ficha técnica" title={<>Compare os <span className="title-accent">atributos</span></>} description="Os valores abaixo são regras oficiais fornecidas pela Arena. Todos os outros atributos do personagem permanecem livres." />
          <CategoryComparison />
        </div>
      </section>
      <section className="section section--graphite">
        <div className="page-container">
          <SectionHeading eyebrow="Cinturões da Arena" title={<>Prestígio que precisa ser <span className="title-accent">defendido</span></>} description="O campeão é exibido com C e fora da numeração comum do ranking. Nenhum nome é mostrado até haver informação oficial." />
          <ChampionsGrid />
        </div>
      </section>
      <section className="section category-change-section">
        <div className="page-container category-change-layout">
          <div>
            <p className="section-kicker">Mudança de categoria</p>
            <h2 className="section-title">Seu histórico viaja <span className="title-accent">com você</span></h2>
            <p className="section-lead">{arenaRules.categoryChange.eligibility} Ao mudar, o jogador preserva o que já construiu.</p>
          </div>
          <div className="category-change-card">
            <ArrowRightLeft size={34} aria-hidden="true" />
            <ul>{arenaRules.categoryChange.carries.map((item) => <li key={item}><ShieldCheck size={17} />{item}</li>)}</ul>
            <p>{arenaRules.categoryChange.placement}</p>
            <p>{arenaRules.categoryChange.previousMatches}</p>
            <div><Crown size={19} /><span>{arenaRules.categoryChange.championException}</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
