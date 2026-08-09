"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { DISCORD_URL } from "@/lib/site";

export function MobileDiscordCta() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/matchmaking") ||
    pathname.startsWith("/ranked") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/conta") ||
    pathname.startsWith("/suporte")
  ) {
    return null;
  }

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
