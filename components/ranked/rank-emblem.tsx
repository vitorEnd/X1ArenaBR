import {
  Award,
  Crown,
  Gem,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { RankedTier } from "./adapter";
import styles from "./ranked.module.css";

const tierPresentation: Record<
  RankedTier,
  { readonly label: string; readonly icon: LucideIcon; readonly ornaments: number }
> = {
  novato: { label: "Novato", icon: Shield, ornaments: 0 },
  pro: { label: "Pro", icon: ShieldCheck, ornaments: 1 },
  craque: { label: "Craque", icon: Star, ornaments: 2 },
  desafiante: { label: "Desafiante", icon: Swords, ornaments: 3 },
  immortal: { label: "Immortal", icon: Gem, ornaments: 4 },
  champion: { label: "Champion", icon: Crown, ornaments: 5 },
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
      <div className={`${styles.emblemWrap} ${styles[`emblemSize_${size}`]}`}>
        <div className={`${styles.emblem} ${styles.emblemPlacement}`} aria-hidden="true">
          <span className={styles.emblemHalo} />
          <Award className={styles.emblemIcon} strokeWidth={1.4} />
          <span className={styles.emblemCore}>?</span>
        </div>
        {showLabel && <span className={styles.emblemLabel}>Em colocação</span>}
      </div>
    );
  }

  const presentation = tierPresentation[tier];
  const Icon = presentation.icon;
  const championLabel =
    tier === "champion" && topPosition && mmr !== null
      ? `TOP ${topPosition} • ${new Intl.NumberFormat("pt-BR").format(mmr)} MMR`
      : presentation.label;

  return (
    <div className={`${styles.emblemWrap} ${styles[`emblemSize_${size}`]}`}>
      <div
        className={`${styles.emblem} ${styles[`emblem_${tier}`]}`}
        aria-label={`Elo ${championLabel}`}
        role="img"
      >
        <span className={styles.emblemHalo} />
        <span className={styles.emblemWingLeft} />
        <span className={styles.emblemWingRight} />
        <span className={styles.emblemPlate} />
        <Icon className={styles.emblemIcon} strokeWidth={1.4} aria-hidden="true" />
        {presentation.ornaments >= 1 && (
          <Star className={`${styles.emblemOrnament} ${styles.emblemOrnamentOne}`} aria-hidden="true" />
        )}
        {presentation.ornaments >= 2 && (
          <Star className={`${styles.emblemOrnament} ${styles.emblemOrnamentTwo}`} aria-hidden="true" />
        )}
        {presentation.ornaments >= 3 && (
          <Trophy className={`${styles.emblemOrnament} ${styles.emblemOrnamentThree}`} aria-hidden="true" />
        )}
        {presentation.ornaments >= 4 && (
          <Sparkles className={`${styles.emblemOrnament} ${styles.emblemOrnamentFour}`} aria-hidden="true" />
        )}
        {presentation.ornaments >= 5 && <span className={styles.emblemLaurel} aria-hidden="true">✦</span>}
      </div>
      {showLabel && <span className={styles.emblemLabel}>{championLabel}</span>}
    </div>
  );
}

