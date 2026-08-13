import {
  Crown,
  Flag,
  Gem,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  type LucideIcon,
} from "lucide-react";
import type { RankedTier } from "./adapter";
import styles from "./rank-emblem.module.css";

const tierPresentation: Record<
  RankedTier,
  {
    readonly label: string;
    readonly icon: LucideIcon;
    readonly accentIcon: LucideIcon;
    readonly stars: number;
  }
> = {
  novato: { label: "Novato", icon: Shield, accentIcon: Shield, stars: 0 },
  pro: { label: "Pro", icon: ShieldCheck, accentIcon: ShieldCheck, stars: 1 },
  craque: { label: "Craque", icon: Star, accentIcon: Star, stars: 2 },
  desafiante: { label: "Desafiante", icon: Swords, accentIcon: Swords, stars: 3 },
  immortal: { label: "Immortal", icon: Gem, accentIcon: Sparkles, stars: 4 },
  champion: { label: "Champion", icon: Crown, accentIcon: Crown, stars: 5 },
};

export const rankedTierLabels = Object.fromEntries(
  Object.entries(tierPresentation).map(([tier, presentation]) => [
    tier,
    presentation.label,
  ]),
) as Record<RankedTier, string>;

interface RankEmblemProps {
  readonly tier: RankedTier | null;
  readonly size?: "sm" | "md" | "lg" | "hero";
  readonly topPosition?: number | null;
  readonly mmr?: number | null;
  readonly showLabel?: boolean;
}

export function RankEmblem({
  tier,
  size = "md",
  topPosition = null,
  mmr = null,
  showLabel = true,
}: RankEmblemProps) {
  if (!tier) {
    return (
      <div className={`${styles.wrap} ${styles[`size_${size}`]}`}>
        <div
          className={`${styles.badge} ${styles.placement}`}
          aria-label="Elo em colocação"
          role="img"
        >
          <span className={styles.aura} aria-hidden="true" />
          <span className={styles.frame} aria-hidden="true" />
          <span className={styles.plate} aria-hidden="true" />
          <Flag className={styles.mainIcon} strokeWidth={1.7} aria-hidden="true" />
          <span className={styles.placementDots} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        {showLabel && <span className={styles.label}>Em colocação</span>}
      </div>
    );
  }

  const presentation = tierPresentation[tier];
  const Icon = presentation.icon;
  const AccentIcon = presentation.accentIcon;
  const championLabel =
    tier === "champion" && topPosition && mmr !== null
      ? `TOP ${topPosition} • ${new Intl.NumberFormat("pt-BR").format(mmr)} MMR`
      : presentation.label;

  return (
    <div className={`${styles.wrap} ${styles[`size_${size}`]}`}>
      <div
        className={`${styles.badge} ${styles[tier]}`}
        aria-label={`Elo ${championLabel}`}
        role="img"
      >
        <span className={styles.aura} aria-hidden="true" />
        <span className={styles.rays} aria-hidden="true" />
        <span className={styles.wingLeft} aria-hidden="true" />
        <span className={styles.wingRight} aria-hidden="true" />
        <span className={styles.frame} aria-hidden="true" />
        <span className={styles.plate} aria-hidden="true" />
        <span className={styles.innerRing} aria-hidden="true" />
        <Icon className={styles.mainIcon} strokeWidth={1.55} aria-hidden="true" />
        <AccentIcon className={styles.accentIcon} strokeWidth={1.55} aria-hidden="true" />
        <span className={styles.rankStars} aria-hidden="true">
          {Array.from({ length: presentation.stars }, (_, index) => (
            <Star key={index} fill="currentColor" />
          ))}
        </span>
        <span className={styles.baseBars} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      {showLabel && <span className={styles.label}>{championLabel}</span>}
    </div>
  );
}
