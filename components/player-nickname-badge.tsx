import type { PlayerNickname } from "@/lib/types";
import styles from "./player-nickname-badge.module.css";

type PlayerNicknameBadgeProps = {
  readonly nickname: PlayerNickname;
  readonly size?: "compact" | "regular" | "hero";
};

export function PlayerNicknameBadge({
  nickname,
  size = "regular",
}: PlayerNicknameBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[nickname.color]} ${styles[size]}`}
      aria-label={`Apelido: ${nickname.nickname}`}
      title={`Apelido: ${nickname.nickname}`}
    >
      <span className={styles.spark} aria-hidden="true" />
      <span className={styles.text}>{nickname.nickname}</span>
    </span>
  );
}
