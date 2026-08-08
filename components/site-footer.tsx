import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { DISCORD_URL, navigation } from "@/lib/site";
import { BrandMark } from "./brand-mark";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="page-container site-footer__grid">
        <div className="site-footer__brand">
          <BrandMark />
          <p>Comunidade competitiva de World of Football.</p>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-discord"
          >
            <MessageCircle size={18} aria-hidden="true" />
            discord.gg/DsB6udDVeh
          </a>
        </div>

        <div>
          <p className="footer-kicker">Navegação</p>
          <nav className="footer-nav" aria-label="Navegação do rodapé">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="footer-kicker">Quem constrói a Arena</p>
          <ul className="footer-creators">
            <li>Itz</li>
            <li>Vtzinn021</li>
            <li>Apenas João00325</li>
          </ul>
        </div>
      </div>

      <div className="page-container site-footer__bottom">
        <span>© {year} WOF Arena X1 BR</span>
        <span>
          Projeto comunitário e fan-made, sem afiliação declarada com o UFC ou
          com os responsáveis por World of Football.
        </span>
      </div>
    </footer>
  );
}
