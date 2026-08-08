"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowDown, ArrowRight, MapPin, Radio, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { DISCORD_URL } from "@/lib/site";

export function HomeHero() {
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const playerX = useSpring(pointerX, { stiffness: 55, damping: 18 });
  const playerY = useSpring(pointerY, { stiffness: 55, damping: 18 });
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const fieldY = useTransform(scrollYProgress, [0, 1], ["0%", "-4%"]);
  const fieldScale = useTransform(scrollYProgress, [0, 1], [1.03, 1.11]);

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (
      reducedMotion ||
      event.pointerType !== "mouse" ||
      !window.matchMedia("(min-width: 901px) and (hover: hover) and (pointer: fine)").matches
    ) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 24);
    pointerY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 16);
  }

  return (
    <section
      ref={heroRef}
      className="home-hero"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
    >
      <motion.div
        className="hero-field"
        style={reducedMotion ? undefined : { y: fieldY, scale: fieldScale }}
      >
        <Image
          src="/images/arena-field.jpg"
          alt="Campo do Park no World of Football, palco dos confrontos da Arena X1 Brasil"
          fill
          priority
          sizes="100vw"
          className="hero-field__image"
        />
      </motion.div>
      <div className="hero-overlay" />
      <div className="hero-stadium-lights" aria-hidden="true" />
      <div className="hero-diagonal hero-diagonal--one" aria-hidden="true" />
      <div className="hero-diagonal hero-diagonal--two" aria-hidden="true" />

      <motion.div
        className="hero-player"
        style={reducedMotion ? undefined : { x: playerX, y: playerY }}
        initial={{ opacity: 0, x: 45 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.75, delay: 0.35 }}
        aria-hidden="true"
      >
        <Image
          src="/images/player-yellow-glasses.png"
          alt=""
          width={666}
          height={375}
          priority
          className="hero-player__image"
        />
      </motion.div>

      <div className="hero-hud hero-hud--top" aria-hidden="true">
        <span>
          <Radio size={13} /> AXB LIVE SYSTEM
        </span>
        <span>BR • 01</span>
      </div>
      <div className="hero-hud hero-hud--side" aria-hidden="true">
        <span>ARENA STATUS</span>
        <strong>COMUNIDADE ATIVA</strong>
        <i />
      </div>

      <div className="page-container hero-content">
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18 }}
        >
          World of Football • X1 competitivo
        </motion.p>
        <div className="hero-title-mask">
          <motion.h1
            className="display-title"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.72, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            Onde cada X1 <span>vira história</span>
          </motion.h1>
        </div>
        <motion.p
          className="hero-description"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46 }}
        >
          Eventos semanais, ranking contínuo, rivalidades, desafios e
          cinturões. Entre na Arena e construa o seu legado.
        </motion.p>
        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58 }}
        >
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="button-gold"
          >
            <Shield size={18} aria-hidden="true" />
            Entrar no Discord
          </a>
          <Link href="/rankings" className="button-ghost">
            Ver rankings <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </motion.div>
      </div>

      <div className="page-container hero-bottom-rail">
        <div>
          <span>Frequência</span>
          <strong>Semanal</strong>
        </div>
        <div>
          <span>Local oficial</span>
          <strong>
            <MapPin size={15} aria-hidden="true" /> Park
          </strong>
        </div>
        <div>
          <span>Classificação</span>
          <strong>Contínua</strong>
        </div>
      </div>

      <a href="#proximo-evento" className="scroll-indicator">
        <span>Explorar</span>
        <ArrowDown size={16} aria-hidden="true" />
      </a>
    </section>
  );
}
