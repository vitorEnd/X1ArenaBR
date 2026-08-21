import { UserRound } from "lucide-react";
import Image from "next/image";
import type { Player } from "@/lib/types";

type OfficialPlayerAvatarProps = {
  readonly player: Pick<Player, "name" | "avatarUrl"> | null | undefined;
  readonly size: number;
  readonly sizes: string;
  readonly alt?: string;
  readonly className?: string;
  readonly fallbackSize?: number;
};

export function OfficialPlayerAvatar({
  player,
  size,
  sizes,
  alt = "",
  className,
  fallbackSize = Math.round(size * 0.42),
}: OfficialPlayerAvatarProps) {
  if (!player?.avatarUrl) {
    return <UserRound size={fallbackSize} aria-hidden="true" focusable="false" />;
  }

  return (
    <Image
      src={player.avatarUrl}
      alt={alt}
      width={size}
      height={size}
      sizes={sizes}
      className={["official-player-avatar", className].filter(Boolean).join(" ")}
    />
  );
}
