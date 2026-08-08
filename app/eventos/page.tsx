import { CalendarClock, History, MapPin, MessageCircle } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { DEMO_DATA_LABEL, DEMO_DATA_NOTICE, exampleEvents, exampleMatches, officialEvents, officialMatches } from "@/data/arena";
import { DISCORD_URL } from "@/lib/site";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Eventos", "Cards semanais, confrontos e histórico de eventos da WOF Arena X1 BR.");

export default function EventsPage() {
  const exampleUpcoming = exampleEvents.find((event) => event.id === "example-event-upcoming")!;
  const exampleHistory = exampleEvents.find((event) => event.id === "example-event-history")!;
  const nextOfficialEvent = officialEvents.find((event) => event.status !== "finished") ?? officialEvents[0];
  const nextOfficialMatches = nextOfficialEvent ? officialMatches.filter((match) => nextOfficialEvent.matchIds.includes(match.id)) : [];
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
            title={<>O próximo card <span className="title-accent">ainda está aberto</span></>}
            description="Os confrontos oficiais aparecem aqui assim que forem confirmados pela organização."
          />
          {officialEvents.length === 0 && (
            <div className="official-empty-event">
              <CalendarClock size={40} aria-hidden="true" />
              <div>
                <span>Sem card oficial cadastrado</span>
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
            eyebrow="Visualização do card"
            title={<>Como cada confronto <span className="title-accent">ganha a Arena</span></>}
            description="Abaixo está uma demonstração funcional do formato. Os nomes, datas e números não são registros oficiais."
          />
          <div className="demo-notice demo-notice--block" role="note"><span className="data-badge">{DEMO_DATA_LABEL}</span><p>{DEMO_DATA_NOTICE}</p></div>
          <div className="event-card-heading">
            <div><span>Card de demonstração</span><h2>{exampleUpcoming.name}</h2></div>
            <dl><div><dt>Data</dt><dd>15 AGO 2026</dd></div><div><dt>Início</dt><dd>20:00</dd></div><div><dt>Local</dt><dd>PARK</dd></div></dl>
          </div>
          <div className="matches-grid">
            {exampleMatches.filter((match) => match.eventId === exampleUpcoming.id).map((match) => <MatchCard key={match.id} match={match} event={exampleUpcoming} />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page-container">
          <SectionHeading
            eyebrow="Histórico de confrontos"
            title={<>Resultados que constroem <span className="title-accent">o legado</span></>}
            description="Vitórias, derrotas, placares e métodos ficam preparados para formar a história permanente de cada jogador."
          />
          <div className="history-label"><History size={18} /><span>Exemplo de histórico finalizado • não oficial</span></div>
          <div className="matches-grid">
            {exampleMatches.filter((match) => match.eventId === exampleHistory.id).map((match) => <MatchCard key={match.id} match={match} event={exampleHistory} />)}
          </div>
        </div>
      </section>
    </>
  );
}
