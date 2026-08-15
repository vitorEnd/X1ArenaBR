"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  Crown,
  MapPin,
  MessageCircle,
  Shield,
  Trophy,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { creators, howItWorks } from "@/data/arena";
import type { ArenaCard } from "@/lib/arena-card-types";
import { DISCORD_URL } from "@/lib/site";
import { ArenaCardView } from "./arena-card-view";
import { BrandMark } from "./brand-mark";
import { SectionHeading } from "./section-heading";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) return;
    let frame = 0;
    const start = performance.now();
    const duration = 750;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reducedMotion, value]);

  return <span ref={ref}>{reducedMotion ? value : display}{suffix}</span>;
}

export function ArenaStats() {
  const stats = [
    { value: 3, suffix: "", label: "Categorias oficiais" },
    { message: "Bem-Vindo ao Arena x1 BR Oficial!" },
    { value: 2, suffix: " pts", label: "Por vitória" },
    { value: 1, suffix: "", label: "Arena: o Park" },
  ] as const;

  return (
    <section className="arena-stats" aria-label="Estatísticas gerais da Arena">
      <div className="page-container arena-stats__grid">
        {stats.map((stat) => (
          <div key={"message" in stat ? stat.message : stat.label}>
            {"message" in stat ? (
              <strong className="arena-welcome">{stat.message}</strong>
            ) : (
              <>
                <strong><AnimatedNumber value={stat.value} suffix={stat.suffix} /></strong>
                <span>{stat.label}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function NextEventSection({ cards }: { readonly cards: readonly ArenaCard[] }) {
  const nextOfficialCard = cards.find((card) => card.status === "live")
    ?? cards.find((card) => card.status === "announced");
  const hasOfficialEvent = Boolean(nextOfficialCard);
  return (
    <section id="proximo-evento" className="section next-event-section">
      <div className="page-container">
        <SectionHeading
          eyebrow="Próximo evento"
          title={<>O próximo capítulo <span className="title-accent">começa aqui</span></>}
          description="Cada evento reúne confrontos x1 independentes. Não existe eliminação: cada resultado passa a fazer parte da sua história na Arena."
        />

        {!hasOfficialEvent && (
          <motion.div
            className="event-empty-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
          >
            <div className="event-empty-card__number">AXB / CARD</div>
            <div className="event-empty-card__icon"><CalendarClock size={38} /></div>
            <div className="event-empty-card__copy">
              <span>Programação oficial</span>
              <h3>Próximo card a ser anunciado</h3>
              <p>
                Acompanhe o Discord para saber quando as inscrições e os próximos confrontos forem confirmados.
              </p>
            </div>
            <div className="event-empty-card__venue">
              <MapPin size={18} aria-hidden="true" />
              <span><small>Todos os eventos</small><strong>NO PARK</strong></span>
            </div>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-gold">
              Ver no Discord <ArrowRight size={18} />
            </a>
          </motion.div>
        )}
        {nextOfficialCard && <ArenaCardView card={nextOfficialCard} />}
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const icons = [MessageCircle, Shield, CalendarClock, CircleDot, Check, ArrowRight, Trophy, Crown, Shield];
  return (
    <section className="section process-section">
      <div className="page-container">
        <SectionHeading
          eyebrow="Como funciona"
          title={<>Do primeiro passo ao <span className="title-accent">cinturão</span></>}
          description="Uma jornada contínua: você entra, compete, soma pontos e cria o próprio caminho até o topo."
        />
        <ol className="arena-process">
          {howItWorks.map((step, index) => {
            const Icon = icons[index];
            return (
              <motion.li
                key={step}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.45 }}
                transition={{ delay: (index % 3) * 0.07 }}
              >
                <span className="arena-process__number">{String(index + 1).padStart(2, "0")}</span>
                <Icon size={22} aria-hidden="true" />
                <strong>{step}</strong>
                {index < howItWorks.length - 1 && <ChevronRight className="arena-process__arrow" size={18} aria-hidden="true" />}
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function CommunityBanner() {
  return (
    <section className="section community-section">
      <div className="page-container community-banner">
        <div className="community-banner__lines" aria-hidden="true" />
        <div className="community-banner__visual" aria-hidden="true">
          <Image
            src="/images/player-yellow.png"
            alt=""
            width={666}
            height={375}
            className="community-player"
          />
        </div>
        <div className="community-banner__content">
          <BrandMark compact />
          <p className="eyebrow">Comunidade AXB</p>
          <h2>Sua história na Arena começa agora</h2>
          <p>
            Entre na comunidade, acompanhe os próximos eventos, encontre rivais e faça sua inscrição.
          </p>
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="button-dark">
            <MessageCircle size={19} aria-hidden="true" /> Entrar no Discord
          </a>
        </div>
      </div>
    </section>
  );
}

export function CreatorsSection() {
  return (
    <section className="section section--graphite creators-section">
      <div className="page-container">
        <SectionHeading
          eyebrow="Comunidade em movimento"
          title={<>Quem constrói <span className="title-accent">a Arena</span></>}
          description="Três nomes na origem da WOF Arena X1 BR e uma comunidade pronta para escrever sua própria história."
        />
        <div className="creators-grid">
          {creators.map((creator, index) => (
            <motion.article
              key={creator.id}
              className="creator-card"
              initial={{ opacity: 0, x: -18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ delay: index * 0.08 }}
            >
              <span>0{index + 1}</span>
              <div className="creator-card__avatar"><UserRound size={25} aria-hidden="true" /></div>
              <h3>{creator.name}</h3>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RankingsCta() {
  return (
    <Link href="/rankings" className="button-ghost section-cta">
      Ver ranking completo <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}
