import { UserRound } from "lucide-react";
import styles from "./ranked.module.css";

interface PlayerAvatarProps {
  readonly src: string | null;
  readonly name: string;
  readonly size?: "sm" | "md" | "lg";
}

export function PlayerAvatar({ src, name, size = "md" }: PlayerAvatarProps) {
  return (
    <span className={`${styles.avatar} ${styles[`avatar_${size}`]}`}>
      {src ? (
        // User-controlled Supabase URLs are intentionally rendered without next/image host coupling.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Avatar de ${name}`} />
      ) : (
        <UserRound aria-hidden="true" />
      )}
    </span>
  );
}

