import { PlayerDirectory } from "@/components/player-directory";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Jogadores", "Diretório e perfis individuais de jogadores da WOF Arena X1 BR.");

export default function PlayersPage() {
  return (
    <>
      <PageHero eyebrow="Nomes • Números • Histórias" title="Jogadores" description="Conheça os competidores oficiais que já fazem parte da Arena X1 Brasil." />
      <section className="section">
        <div className="page-container">
          <SectionHeading eyebrow="Diretório da Arena" title={<>Encontre quem está <span className="title-accent">na disputa</span></>} description="Busque por nome, filtre por categoria e acompanhe os jogadores inscritos na Arena." />
          <PlayerDirectory />
        </div>
      </section>
    </>
  );
}
