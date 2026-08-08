"use client";

import { MessageCircle } from "lucide-react";
import { DISCORD_URL } from "@/lib/site";

export function MobileDiscordCta() {
  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mobile-discord-cta"
      aria-label="Entrar no Discord da Arena X1 Brasil (abre em nova aba)"
    >
      <MessageCircle size={19} aria-hidden="true" />
      Entrar na Arena
    </a>
  );
}
