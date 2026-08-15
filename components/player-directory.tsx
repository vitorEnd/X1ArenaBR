"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Search, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  categories,
  officialPlayers,
  officialRankingEntries,
} from "@/data/arena";
import { buildCategoryRanking } from "@/lib/ranking";
import type { CategoryId, RankingEntry } from "@/lib/types";

type Filter = CategoryId | "all" | "unassigned";

export function PlayerDirectory({ entries: externalEntries }: { readonly entries?: Map<string, RankingEntry> }) {
  const [category, setCategory] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const hasUnassignedPlayers = officialPlayers.some(
    (player) => !player.currentCategoryId,
  );
  const rankingEntries = externalEntries ?? new Map(officialRankingEntries.map((entry) => [entry.playerId, entry]));
  const rankingPositions = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((item) => {
      buildCategoryRanking([...rankingEntries.values()], item.id).standings.forEach(
        (entry) => map.set(entry.playerId, entry.marker),
      );
    });
    return map;
  }, [rankingEntries]);
  const visiblePlayers = officialPlayers.filter((player) => {
    const categoryMatches =
      category === "all" ||
      (category === "unassigned"
        ? !player.currentCategoryId
        : player.currentCategoryId === category);
    const queryMatches =
      !normalized ||
      player.name.toLocaleLowerCase("pt-BR").includes(normalized);
    return categoryMatches && queryMatches;
  });

  return (
    <div className="player-directory">
      <div className="directory-controls">
        <div
          className="directory-filters"
          role="group"
          aria-label="Filtrar jogadores por categoria"
        >
          <button
            type="button"
            aria-pressed={category === "all"}
            className={category === "all" ? "is-active" : ""}
            onClick={() => setCategory("all")}
          >
            Todos
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              className={category === item.id ? "is-active" : ""}
              onClick={() => setCategory(item.id)}
            >
              {item.shortName}
            </button>
          ))}
          {hasUnassignedPlayers && (
            <button
              type="button"
              aria-pressed={category === "unassigned"}
              className={category === "unassigned" ? "is-active" : ""}
              onClick={() => setCategory("unassigned")}
            >
              A definir
            </button>
          )}
        </div>
        <div className="ranking-search">
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="player-search">
            Buscar jogador por nome
          </label>
          <input
            id="player-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar jogador"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {visiblePlayers.length} jogador{visiblePlayers.length === 1 ? "" : "es"}{" "}
        encontrado{visiblePlayers.length === 1 ? "" : "s"}.
      </p>

      <AnimatePresence mode="popLayout">
        {visiblePlayers.length ? (
          <motion.div className="players-grid" layout>
            {visiblePlayers.map((player, index) => {
              const categoryData = categories.find(
                (item) => item.id === player.currentCategoryId,
              );
              const entry = rankingEntries.get(player.id);
              const points = entry ? entry.wins * 2 - entry.losses : 0;
              const goalDifference = entry
                ? entry.goalsFor - entry.goalsAgainst
                : 0;
              const knockouts = entry?.knockouts ?? 0;
              return (
                <motion.article
                  key={player.id}
                  className="player-card"
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: Math.min(index * 0.03, 0.18) }}
                >
                  <div className="player-card__top">
                    <span>{rankingPositions.get(player.id) ?? "—"}</span>
                    <small>
                      {player.status === "active" ? "Ativo" : "Inativo"}
                    </small>
                  </div>
                  <div className="player-card__avatar">
                    <UserRound size={36} aria-hidden="true" />
                  </div>
                  <span className="player-card__category">
                    {categoryData?.name ?? "Categoria a definir"}
                  </span>
                  <h2>{player.name}</h2>
                  <dl>
                    <div>
                      <dt>Pontos</dt>
                      <dd>{points}</dd>
                    </div>
                    <div>
                      <dt>V / D</dt>
                      <dd>
                        {entry?.wins ?? 0} / {entry?.losses ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Saldo</dt>
                      <dd>
                        {goalDifference > 0 ? "+" : ""}
                        {goalDifference}
                      </dd>
                    </div>
                    <div>
                      <dt>Nocautes</dt>
                      <dd>{knockouts}</dd>
                    </div>
                  </dl>
                  <Link href={`/jogadores/${player.slug}`}>
                    Ver perfil <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </motion.article>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Users size={34} aria-hidden="true" />
            <h3>Nenhum jogador encontrado</h3>
            <p>Altere a categoria ou limpe a busca.</p>
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setCategory("all");
                setQuery("");
              }}
            >
              Limpar filtros
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
