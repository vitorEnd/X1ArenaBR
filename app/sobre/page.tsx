import { ArrowRight, Crown, Infinity as InfinityIcon, MapPin, MessageCircle, Shield, Swords, Users } from "lucide-react";
import Image from "next/image";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { creators } from "@/data/arena";
import { DISCORD_URL } from "@/lib/site";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Sobre a Arena", "Conheça a proposta, a comunidade e os criadores da WOF Arena X1 BR.");

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="World of Football • Brasil" title="Sobre a Arena" description="Uma comunidade feita para transformar confrontos x1 em rivalidades, evolução e legado dentro do World of Football." />
      <section className="section about-manifesto-section">
        <div className="page-container about-manifesto">
          <div className="about-manifesto__image"><Image src="/images/arena-field.jpg" alt="Campo do Park no World of Football" fill sizes="(max-width: 900px) 100vw, 52vw" /></div>
          <div className="about-manifesto__copy"><p className="section-kicker">A proposta</p><h2>Não é torneio.<br /><span className="title-accent">É trajetória.</span></h2><p>A WOF Arena X1 BR é uma competição semanal de x1. Não existe chaveamento, mata-mata ou eliminação. Cada partida é um capítulo separado, e perder nunca tira um jogador da Arena.</p><p>Vitórias, derrotas, pontos, saldo de gols, rivalidades, revanches, desafios e cinturões formam uma história que continua crescendo.</p></div>
        </div>
      </section>
      <section className="about-pillars"><div className="page-container about-pillars__grid"><div><Swords /><span>Rivalidade</span><p>Confrontos que podem virar desafios e revanches.</p></div><div><InfinityIcon /><span>Evolução contínua</span><p>Sem temporadas e sem apagar os resultados.</p></div><div><Crown /><span>Prestígio</span><p>Top 5, desafios e cinturões em três categorias.</p></div><div><Users /><span>Comunidade</span><p>Eventos semanais construídos dentro do Discord.</p></div></div></section>
      <section className="section section--graphite">
        <div className="page-container"><SectionHeading eyebrow="Quem constrói a Arena" title={<>Três nomes.<br /><span className="title-accent">Uma comunidade.</span></>} description="Sem cargos ou biografias inventadas: apenas os nomes informados oficialmente, com a estrutura pronta para evoluir." /><div className="about-creators-list">{creators.map((creator, index) => <article key={creator.id}><span>0{index + 1}</span><Shield size={22} /><h2>{creator.name}</h2></article>)}</div></div>
      </section>
      <section className="section about-location-section"><div className="page-container about-location"><div><MapPin size={34} /><p className="section-kicker">A casa dos eventos</p><h2>Todos os x1<br /><span>no Park</span></h2></div><div><p>É no Park que a história acontece: uma arena comum para cada categoria e cada rivalidade.</p><a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-gold"><MessageCircle size={18} /> Entrar no Discord <ArrowRight size={17} /></a></div></div></section>
    </>
  );
}
