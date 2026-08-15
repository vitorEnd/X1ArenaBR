import { CalendarClock, History, MapPin, MessageCircle } from "lucide-react";
import { ArenaCardView } from "@/components/arena-card-view";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { getPublicArenaCards } from "@/lib/arena-cards-server";
import { createPageMetadata } from "@/lib/metadata";
import { DISCORD_URL } from "@/lib/site";

export const metadata = createPageMetadata(
  "Eventos",
  "Agenda, cards semanais e confrontos oficiais da WOF Arena X1 BR.",
);
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const cards = await getPublicArenaCards();
  const currentCards = cards.filter((card) => card.status !== "finished");
  const finishedCards = cards.filter((card) => card.status === "finished");

  return (
    <>
      <PageHero
        eyebrow="Cards semanais • Park"
        title="Eventos"
        description="Um evento é o dia dos x1s da semana. Cada confronto é independente: não há chaveamento, mata-mata ou eliminação."
      />

      <section className="section">
        <div className="page-container">
          <SectionHeading
            eyebrow="Agenda oficial"
            title={<>O próximo card <span className="title-accent">começa aqui</span></>}
            description="Confrontos, horários e disputas de cinturão publicados oficialmente pela organização."
          />
          {currentCards.length > 0 ? (
            <div className="arena-cards-stack">
              {currentCards.map((card) => <ArenaCardView key={card.id} card={card} />)}
            </div>
          ) : (
            <div className="official-empty-event">
              <CalendarClock size={40} aria-hidden="true" />
              <div><span>Próximo anúncio</span><h2>Próximo card a ser anunciado</h2><p>A programação será divulgada pela organização e pela comunidade.</p></div>
              <div className="official-empty-event__place"><MapPin size={18} /><span>Local fixo<strong>Park</strong></span></div>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-gold"><MessageCircle size={18} /> Entrar no Discord</a>
            </div>
          )}
        </div>
      </section>

      <section className="section section--graphite">
        <div className="page-container">
          <SectionHeading
            eyebrow="Histórico de confrontos"
            title={<>Resultados que constroem <span className="title-accent">o legado</span></>}
            description="Cards finalizados e seus resultados oficiais permanecem registrados na Arena."
          />
          {finishedCards.length > 0 ? (
            <div className="arena-cards-stack">
              {finishedCards.map((card) => <ArenaCardView key={card.id} card={card} />)}
            </div>
          ) : (
            <div className="official-empty-event">
              <History size={40} aria-hidden="true" />
              <div><span>Histórico oficial</span><h2>O primeiro card está chegando</h2><p>Os resultados aparecerão aqui quando o evento for finalizado.</p></div>
              <div className="official-empty-event__place"><MapPin size={18} /><span>Local fixo<strong>Park</strong></span></div>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-gold"><MessageCircle size={18} /> Entrar no Discord</a>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
