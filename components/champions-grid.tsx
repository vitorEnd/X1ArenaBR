"use client";

import { motion } from "framer-motion";
import { Crown, Shield, Trophy } from "lucide-react";
import Link from "next/link";
import { PlayerNicknameBadge } from "@/components/player-nickname-badge";
import { categories, officialChampions, officialPlayers, officialRankingEntries } from "@/data/arena";
import { getCategoryPlayerRankingKey } from "@/lib/arena-competition";
import { createPlayerNicknameMap } from "@/lib/player-nicknames";
import { calculateRankingEntry } from "@/lib/ranking";
import type { CategoryId, Champion, PlayerNickname, RankingEntry } from "@/lib/types";

type ChampionsGridProps = {
  entriesByPlayer?: ReadonlyMap<string, RankingEntry>;
  championsByCategory?: ReadonlyMap<CategoryId, Champion>;
  nicknames?: readonly PlayerNickname[];
};

export function ChampionsGrid({
  entriesByPlayer = new Map(),
  championsByCategory = new Map(),
  nicknames = [],
}: ChampionsGridProps) {
  const nicknameByPlayer = createPlayerNicknameMap(nicknames);
  return (
    <div className="champions-grid">
      {categories.map((category, index) => {
        const champion = championsByCategory.get(category.id)
          ?? officialChampions.find((item) => item.categoryId === category.id && item.type === "official")
          ?? officialChampions.find((item) => item.categoryId === category.id && item.type === "interim");
        const player = champion ? officialPlayers.find((item) => item.id === champion.playerId) : null;
        const rankingEntry = champion
          ? entriesByPlayer.get(getCategoryPlayerRankingKey(category.id, champion.playerId))
            ?? entriesByPlayer.get(champion.playerId)
            ?? officialRankingEntries.find(
              (item) => item.playerId === champion.playerId && item.categoryId === category.id,
            )
          : null;
        const hasChampion = Boolean(champion && player);
        const calculatedEntry = rankingEntry ? calculateRankingEntry(rankingEntry) : null;
        const nickname = player ? nicknameByPlayer.get(player.id) : undefined;
        return <motion.article
          key={category.id}
          className="champion-card"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ delay: index * 0.08 }}
          whileHover={{ y: -8 }}
        >
          <div className="champion-card__belt" aria-hidden="true">
            <span />
            <Trophy size={33} />
            <span />
          </div>
          <div className="champion-card__category">
            <Shield size={16} aria-hidden="true" />
            {category.name}
          </div>
          <span className="champion-card__c">C</span>
          <Crown className="champion-card__crown" size={34} aria-hidden="true" />
          <h3>
            {hasChampion && player ? (
              <Link href={`/jogadores/${player.slug}`}>{player.name}</Link>
            ) : (
              "Cinturão a definir"
            )}
          </h3>
          {nickname && (
            <div className="champion-card__nickname">
              <PlayerNicknameBadge nickname={nickname} />
            </div>
          )}
          <p>{hasChampion ? `${champion?.type === "interim" ? "Campeão interino" : "Campeão oficial"} da categoria.` : "A disputa pelo cinturão inaugural começa em breve."}</p>
          <dl>
            <div><dt>Defesas</dt><dd>{champion?.defenses ?? "—"}</dd></div>
            <div><dt>Vitórias</dt><dd>{calculatedEntry?.wins ?? "—"}</dd></div>
            <div><dt>Derrotas</dt><dd>{calculatedEntry?.losses ?? "—"}</dd></div>
            <div><dt>Saldo</dt><dd>{calculatedEntry ? `${calculatedEntry.goalDifference > 0 ? "+" : ""}${calculatedEntry.goalDifference}` : "—"}</dd></div>
          </dl>
          <div className="champion-card__footer">
            <span>Conquista</span>
            <strong>{champion ? new Date(champion.wonAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "AGUARDANDO PRIMEIRO CAMPEÃO"}</strong>
          </div>
        </motion.article>;
      })}
    </div>
  );
}
