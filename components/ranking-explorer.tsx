"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crown, Search, ShieldQuestion, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  categories,
  officialChampions,
  officialPlayers,
} from "@/data/arena";
import { getCategoryPlayerRankingKey } from "@/lib/arena-competition";
import { buildCategoryRanking } from "@/lib/ranking";
import type { CategoryId, Player, RankingEntry } from "@/lib/types";

type RankingExplorerProps = {
  compact?: boolean;
  entriesByPlayer?: ReadonlyMap<string, RankingEntry>;
  championIdsByCategory?: ReadonlyMap<CategoryId, string>;
};

function FormDots({ form }: { form: readonly ("win" | "loss")[] }) {
  return (
    <span className="form-dots" aria-label={`Sequência: ${form.join(", ")}`}>
      {form.map((result, index) => (
        <i
          key={`${result}-${index}`}
          className={result === "win" ? "is-win" : "is-loss"}
          title={result === "win" ? "Vitória" : "Derrota"}
        >
          {result === "win" ? "V" : "D"}
        </i>
      ))}
    </span>
  );
}

export function RankingExplorer({
  compact = false,
  entriesByPlayer = new Map(),
  championIdsByCategory = new Map(),
}: RankingExplorerProps) {
  const [categoryId, setCategoryId] = useState<CategoryId>("peso-pena");
  const [query, setQuery] = useState("");
  const liveChampionId = championIdsByCategory.get(categoryId);
  const championRecord = liveChampionId
    ? { categoryId, playerId: liveChampionId, type: "official" as const }
    : officialChampions.find(
        (champion) => champion.categoryId === categoryId && champion.type === "official",
      );

  const ranking = useMemo(() => {
    const categoryPlayers = officialPlayers.filter(
      (player) => player.currentCategoryId === categoryId || player.id === liveChampionId,
    );
    const seededEntries: RankingEntry[] = categoryPlayers.map((player) => {
      const entry = entriesByPlayer.get(
        getCategoryPlayerRankingKey(categoryId, player.id),
      ) ?? entriesByPlayer.get(player.id);
      if (entry?.categoryId === categoryId) {
        return entry;
      }
      return {
        playerId: player.id,
        categoryId: categoryId,
        wins: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        recentForm: [],
        dataStatus: "official",
      };
    });

    return buildCategoryRanking(seededEntries, categoryId, {
      championPlayerId: championRecord?.playerId,
    });
  }, [categoryId, championRecord?.playerId, entriesByPlayer, liveChampionId]);
  const playerById = useMemo(
    () => new Map<string, Player>(officialPlayers.map((player) => [player.id, player])),
    [],
  );
  const championPlayer = championRecord ? officialPlayers.find((player) => player.id === championRecord.playerId) : null;
  const championStanding = ranking.champion;
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const visibleStandings = ranking.standings
    .filter((entry) => {
      const player = playerById.get(entry.playerId);
      return !normalizedQuery || player?.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    })
    .slice(0, compact ? 5 : undefined);

  return (
    <div className={`ranking-explorer ${compact ? "is-compact" : ""}`}>
      <div className="ranking-toolbar">
        <div className="category-tabs" role="group" aria-label="Categoria do ranking">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={categoryId === category.id}
              className={categoryId === category.id ? "is-active" : ""}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        {!compact && (
          <div className="ranking-search">
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor={compact ? "ranking-search-compact" : "ranking-search-full"}>Buscar jogador por nome</label>
            <input
              id={compact ? "ranking-search-compact" : "ranking-search-full"}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar jogador"
            />
            {query && (
              <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}>
                <X size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {visibleStandings.length} jogador{visibleStandings.length === 1 ? "" : "es"} exibido{visibleStandings.length === 1 ? "" : "s"} em {categories.find((item) => item.id === categoryId)?.name}.
      </p>

      <div className="champion-row">
        <span className="champion-marker">C</span>
        <div className="champion-row__icon">
          <Crown size={24} aria-hidden="true" />
        </div>
        <div>
          <span>Campeão da categoria</span>
          {championPlayer ? (
            <Link href={`/jogadores/${championPlayer.slug}`} className="ranking-player champion-row__link">
              <strong>{championPlayer.name}</strong>
            </Link>
          ) : (
            <strong>Cinturão a definir</strong>
          )}
        </div>
        <span className="champion-row__status">{championPlayer ? championRecord?.type === "interim" ? "CAMPEÃO INTERINO" : "CAMPEÃO OFICIAL" : "CINTURÃO VAGO"}</span>
        {championStanding && (
          <div className="champion-row__stats" aria-label={`Estatísticas de ${championPlayer?.name ?? "campeão"}`}>
            <span><small>V</small><b>{championStanding.wins}</b></span>
            <span><small>D</small><b>{championStanding.losses}</b></span>
            <span><small>GP</small><b>{championStanding.goalsFor}</b></span>
            <span><small>GC</small><b>{championStanding.goalsAgainst}</b></span>
            <span><small>SG</small><b className={championStanding.goalDifference >= 0 ? "positive" : "negative"}>{championStanding.goalDifference > 0 ? "+" : ""}{championStanding.goalDifference}</b></span>
            <span><small>PTS</small><b>{championStanding.points}</b></span>
            <span className="champion-row__form">
              <small>Últimos</small>
              {championStanding.recentForm.length > 0
                ? <FormDots form={championStanding.recentForm} />
                : <b>—</b>}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${categoryId}-${query}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {visibleStandings.length > 0 ? (
            <>
              <div className="ranking-table-wrap" role="region" aria-label="Tabela de classificação com rolagem horizontal" tabIndex={0}>
                <table className="ranking-table">
                  <caption className="sr-only">
                    Ranking oficial da categoria {categories.find((item) => item.id === categoryId)?.name}
                  </caption>
                  <thead>
                    <tr>
                      <th>Pos.</th>
                      <th>Jogador</th>
                      <th>V</th>
                      <th>D</th>
                      <th>GP</th>
                      <th>GC</th>
                      <th>SG</th>
                      <th>PTS</th>
                      <th>Últimos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStandings.map((entry) => {
                      const player = playerById.get(entry.playerId);
                      if (!player) return null;
                      return (
                        <motion.tr key={entry.playerId} layout>
                          <td><strong>{entry.marker}</strong></td>
                          <td>
                            <Link href={`/jogadores/${player.slug}`} className="ranking-player">
                              <span className="avatar-placeholder" aria-hidden="true">
                                <UserRound size={17} />
                              </span>
                              <span>
                                <strong>{player.name}</strong>
                                {player.status === "inactive" && <small>Inativo</small>}
                              </span>
                            </Link>
                          </td>
                          <td>{entry.wins}</td>
                          <td>{entry.losses}</td>
                          <td>{entry.goalsFor}</td>
                          <td>{entry.goalsAgainst}</td>
                          <td className={entry.goalDifference >= 0 ? "positive" : "negative"}>
                            {entry.goalDifference > 0 ? "+" : ""}{entry.goalDifference}
                          </td>
                          <td><b>{entry.points}</b></td>
                          <td><FormDots form={entry.recentForm} /></td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="ranking-mobile-list">
                {visibleStandings.map((entry) => {
                  const player = playerById.get(entry.playerId);
                  if (!player) return null;
                  return (
                    <motion.article key={entry.playerId} className="ranking-mobile-card" layout>
                      <div className="ranking-mobile-card__head">
                        <span>{entry.marker}</span>
                        <Link href={`/jogadores/${player.slug}`}>{player.name}</Link>
                        <strong>{entry.points} <small>PTS</small></strong>
                      </div>
                      <div className="ranking-mobile-card__stats">
                        <span>V <b>{entry.wins}</b></span>
                        <span>D <b>{entry.losses}</b></span>
                        <span>GP <b>{entry.goalsFor}</b></span>
                        <span>GC <b>{entry.goalsAgainst}</b></span>
                        <span>SG <b>{entry.goalDifference > 0 ? "+" : ""}{entry.goalDifference}</b></span>
                      </div>
                      <FormDots form={entry.recentForm} />
                    </motion.article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <ShieldQuestion size={34} aria-hidden="true" />
              <h3>{normalizedQuery ? "Nenhum jogador encontrado" : "Ranking aguardando os primeiros resultados"}</h3>
              <p>{normalizedQuery ? "Ajuste a busca ou limpe o termo para ver a classificação." : "Os jogadores já estão inscritos. A classificação começa assim que o primeiro confronto oficial for registrado."}</p>
              {normalizedQuery && <button type="button" className="button-ghost" onClick={() => setQuery("")}>
                  Limpar busca
                </button>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
