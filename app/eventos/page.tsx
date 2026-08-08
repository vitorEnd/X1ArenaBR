import { CalendarClock, History, MapPin, MessageCircle } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { officialEvents, officialMatches } from "@/data/arena";
import { DISCORD_URL } from "@/lib/site";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Eventos", "Agenda, cards semanais e confrontos oficiais da WOF Arena X1 BR.");

export default function EventsPage() {
  const nextOfficialEvent = officialEvents.find((event) => event.status !== "finished");
  const nextOfficialMatches = nextOfficialEvent ? officialMatches.filter((match) => nextOfficialEvent.matchIds.includes(match.id)) : [];
  const finishedOfficialMatches = officialMatches.filter((match) => match.status === "finished");

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
            title={<>O próximo card <span className="title-accent">está em preparação</span></>}
            description="A programação completa será publicada aqui assim que os confrontos forem confirmados pela organização."
          />
          {officialEvents.length === 0 && (
            <div className="official-empty-event">
              <CalendarClock size={40} aria-hidden="true" />
              <div>
                <span>Próximo anúncio</span>
                <h2>Próximo card a ser anunciado</h2>
                <p>Inscrições, horários e confrontos serão divulgados pela comunidade no Discord.</p>
              </div>
              <div className="official-empty-event__place"><MapPin size={18} /><span>Local fixo<strong>Park</strong></span></div>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-gold"><MessageCircle size={18} /> Entrar no Discord</a>
            </div>
          )}
          {nextOfficialEvent && <div className="official-event-card">
            <div className="event-card-heading"><div><span>Card oficial</span><h2>{nextOfficialEvent.name}</h2></div><dl><div><dt>Data</dt><dd>{new Date(nextOfficialEvent.startsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: nextOfficialEvent.timeZone })}</dd></div><div><dt>Início</dt><dd>{new Date(nextOfficialEvent.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: nextOfficialEvent.timeZone })}</dd></div><div><dt>Local</dt><dd>{nextOfficialEvent.venue}</dd></div></dl></div>
            {nextOfficialMatches.length ? <div className="matches-grid">{nextOfficialMatches.map((match) => <MatchCard key={match.id} match={match} event={nextOfficialEvent} />)}</div> : <div className="empty-state"><CalendarClock size={34} /><h3>Confrontos a confirmar</h3><p>O evento foi anunciado, mas o card ainda não foi preenchido.</p></div>}
          </div>}
        </div>
      </section>

      <section className="section section--graphite">
        <div className="page-container">
          <SectionHeading
            eyebrow="Histórico de confrontos"
            title={<>Resultados que constroem <span className="title-accent">o legado</span></>}
            description="Quando os primeiros x1s forem concluídos, os resultados oficiais ficarão registrados aqui."
          />
          {finishedOfficialMatches.length > 0 ? (
            <>
              <div className="history-label"><History size={18} /><span>Resultados oficiais</span></div>
              <div className="matches-grid">
                {finishedOfficialMatches.map((match) => {
                  const event = officialEvents.find((item) => item.id === match.eventId);
                  return event ? <MatchCard key={match.id} match={match} event={event} /> : null;
                })}
              </div>
            </>
          ) : (
            <div className="official-empty-event">
              <History size={40} aria-hidden="true" />
              <div>
                <span>Histórico oficial</span>
                <h2>A Arena está pronta</h2>
                <p>Os resultados aparecerão aqui depois dos primeiros confrontos oficiais.</p>
              </div>
              <div className="official-empty-event__place"><MapPin size={18} /><span>Local fixo<strong>Park</strong></span></div>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-gold"><MessageCircle size={18} /> Entrar no Discord</a>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
