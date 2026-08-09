import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { SupportDashboard } from "@/components/ranked/support-dashboard";
import styles from "@/components/ranked/ranked.module.css";

export const metadata: Metadata = {
  title: "Central de Suporte Ranked",
  description: "Área operacional protegida da AXB Ranked.",
  robots: { index: false, follow: false },
};

export default function SupportPage() {
  return (
    <div className={styles.rankedPage}>
      <header className={styles.rankedHero}>
        <div className="page-container">
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>Operação segura • Acesso restrito</span>
              <h1 className={styles.heroTitle}>Central de <span>suporte.</span></h1>
              <p className={styles.heroLead}>
                Fila, lobbies, conflitos e decisões reunidos em uma operação auditável.
              </p>
            </div>
            <div className={styles.heroRail}>
              <div><ShieldCheck aria-hidden="true" /><p><span>Autorização</span><strong>Servidor + RLS</strong></p></div>
            </div>
          </div>
        </div>
      </header>
      <section className={styles.contentSection}>
        <div className="page-container">
          <SupportDashboard />
        </div>
      </section>
    </div>
  );
}

