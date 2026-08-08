import { PlayerDirectory } from "@/components/player-directory";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata("Jogadores", "Diretório e perfis individuais de jogadores da WOF Arena X1 BR.");

export default function PlayersPage() {
  return (
    <>
      <PageHero eyebrow="Nomes • Números • Histórias" title="Jogadores" description="Cada perfil reúne categoria, classificação, estatísticas e histórico de confrontos. Os registros abaixo demonstram a interface e não são oficiais." />
      <section className="section">
        <div className="page-container">
          <SectionHeading eyebrow="Diretório da Arena" title={<>Encontre quem está <span className="title-accent">na disputa</span></>} description="Busque por nome ou filtre por categoria. Novos dados poderão ser conectados a uma API sem alterar a estrutura visual." />
          <PlayerDirectory />
        </div>
      </section>
    </>
  );
}
