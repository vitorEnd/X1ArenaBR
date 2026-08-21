import { CalendarClock, History, MapPin, MessageCircle } from "lucide-react";
import { ArenaCardView } from "@/components/arena-card-view";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import type { ArenaCard } from "@/lib/arena-card-types";
import { getPublicArenaCards } from "@/lib/arena-cards-server";
import { createPageMetadata } from "@/lib/metadata";
import { DISCORD_URL } from "@/lib/site";

export const metadata = createPageMetadata(
  "Eventos",
  "Agenda, cards semanais e confrontos oficiais da WOF Arena X1 BR.",
);
export const dynamic = "force-dynamic";

function timestamp(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function historyYear(card: ArenaCard) {
  if (!card.startsAt || timestamp(card.startsAt) === Number.NEGATIVE_INFINITY) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(card.startsAt));
}

function historyDateParts(card: ArenaCard) {
  if (!card.startsAt || timestamp(card.startsAt) === Number.NEGATIVE_INFINITY) {
    return { day: "—", month: "Data a definir" };
  }

  const date = new Date(card.startsAt);
  return {
    day: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      timeZone: "America/Sao_Paulo",
    }).format(date).replace(".", ""),
  };
}

function groupHistory(cards: readonly ArenaCard[]) {
  const groups = new Map<string, ArenaCard[]>();
  for (const card of cards) {
    const year = historyYear(card);
    groups.set(year, [...(groups.get(year) ?? []), card]);
  }
  return [...groups].map(([year, groupedCards]) => ({ year, cards: groupedCards }));
}

export default async function EventsPage() {
  const cards = await getPublicArenaCards();
  const currentCards = cards
    .filter((card) => card.status !== "finished")
    .sort((first, second) => {
      if (first.status === "live" && second.status !== "live") return -1;
      if (second.status === "live" && first.status !== "live") return 1;
      const firstTime = timestamp(first.startsAt);
      const secondTime = timestamp(second.startsAt);
      if (firstTime === Number.NEGATIVE_INFINITY) return 1;
      if (secondTime === Number.NEGATIVE_INFINITY) return -1;
      return firstTime - secondTime;
    });
  const finishedCards = cards
    .filter((card) => card.status === "finished")
    .sort((first, second) => timestamp(second.startsAt) - timestamp(first.startsAt));
  const historyGroups = groupHistory(finishedCards);

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
            <div className="arena-cards-stack arena-cards-stack--schedule">
              {currentCards.map((card) => <ArenaCardView key={card.id} card={card} />)}
            </div>
          ) : (
            <div className="official-empty-event">
              <CalendarClock size={40} aria-hidden="true" />
              <div><span>Próximo anúncio</span><h2>Próximo card a ser anunciado</h2><p>A programação será divulgada pela organização e pela comunidade.</p></div>
              <div className="official-empty-event__place"><MapPin size={18} aria-hidden="true" /><span>Local fixo<strong>Park</strong></span></div>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-gold"><MessageCircle size={18} aria-hidden="true" /> Entrar no Discord</a>
            </div>
          )}
        </div>
      </section>

      <section className="section section--graphite">
        <div className="page-container">
          <SectionHeading
            eyebrow="Arquivo oficial"
            title={<>A história de cada card, <span className="title-accent">em campo</span></>}
            description="Uma linha do tempo com todos os cards finalizados, placares e decisões oficiais da Arena."
          />
          {historyGroups.length > 0 ? (
            <div className="event-history">
              {historyGroups.map((group) => (
                <section key={group.year} className="event-history__year" aria-labelledby={`event-history-${group.year.replaceAll(" ", "-")}`}>
                  <header className="event-history__year-heading">
                    <div>
                      <span>Arquivo anual</span>
                      <h3 id={`event-history-${group.year.replaceAll(" ", "-")}`}>{group.year}</h3>
                    </div>
                    <p>{group.cards.length} {group.cards.length === 1 ? "card finalizado" : "cards finalizados"}</p>
                  </header>

                  <ol className="event-history__timeline">
                    {group.cards.map((card) => {
                      const date = historyDateParts(card);
                      return (
                        <li key={card.id} className="event-history__entry">
                          <div className="event-history__date" aria-label={card.startsAt ? `Evento em ${date.day} de ${date.month}` : date.month}>
                            <strong>{date.day}</strong>
                            <span>{date.month}</span>
                          </div>
                          <ArenaCardView card={card} variant="history" />
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          ) : (
            <div className="official-empty-event">
              <History size={40} aria-hidden="true" />
              <div><span>Histórico oficial</span><h2>O primeiro card está chegando</h2><p>Os resultados aparecerão aqui quando o evento for finalizado.</p></div>
              <div className="official-empty-event__place"><MapPin size={18} aria-hidden="true" /><span>Local fixo<strong>Park</strong></span></div>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-gold"><MessageCircle size={18} aria-hidden="true" /> Entrar no Discord</a>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
