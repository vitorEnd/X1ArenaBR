"use client";

import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldQuestion,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  rankedUiAdapter,
  type RankedLeaderboardResponse,
  type RankedTier,
  type RankedUiAdapter,
} from "./adapter";
import { PlayerAvatar } from "./player-avatar";
import { RankEmblem, rankedTierLabels } from "./rank-emblem";
import styles from "./ranked.module.css";
import { RankedConfigurationNotice, RankedError, RankedLoading } from "./ui-feedback";

const rankOptions: readonly { value: RankedTier | "all"; label: string }[] = [
  { value: "all", label: "Todos os Elos" },
  { value: "novato", label: "Novato" },
  { value: "pro", label: "Pro" },
  { value: "craque", label: "Craque" },
  { value: "desafiante", label: "Desafiante" },
  { value: "immortal", label: "Immortal" },
  { value: "champion", label: "Champion" },
];

interface RankedLeaderboardProps {
  readonly adapter?: RankedUiAdapter;
}

export function RankedLeaderboard({ adapter = rankedUiAdapter }: RankedLeaderboardProps) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<RankedTier | "all">("all");
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<RankedLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await adapter.getLeaderboard(query.trim(), tier, page, signal);
        setResponse(result);
        setError(null);
      } catch (loadError) {
        if (signal?.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a classificação.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [adapter, page, query, tier],
  );

  useEffect(() => {
    const controller = new AbortController();
    const debounce = setTimeout(() => void load(controller.signal), 250);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [load]);

  const resultCount = useMemo(() => response?.entries.length ?? 0, [response]);

  if (loading && !response) return <RankedLoading label="Carregando Top 50" />;
  if (error && !response) return <RankedError message={error} onRetry={() => void load()} />;
  if (!response?.configured) return <RankedConfigurationNotice />;

  return (
    <>
      {error && <RankedError message={error} onRetry={() => void load()} />}
      <div className={styles.rankingControls}>
        <div className={styles.searchField}>
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="ranked-search">Buscar jogador ranked</label>
          <input
            id="ranked-search"
            type="search"
            value={query}
            placeholder="Buscar por nome único"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <label>
          <span className="sr-only">Filtrar por Elo</span>
          <select
            className={styles.filterSelect}
            value={tier}
            onChange={(event) => {
              setTier(event.target.value as RankedTier | "all");
              setPage(1);
            }}
          >
            {rankOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="sr-only" aria-live="polite">
        {resultCount} jogador{resultCount === 1 ? "" : "es"} exibido{resultCount === 1 ? "" : "s"}.
      </p>

      <section className={styles.rankingPanel} aria-label="Top 50 da Arena Ranked">
        {response.entries.length > 0 ? (
          <>
            <div className={styles.rankingTableWrap} role="region" aria-label="Classificação com rolagem horizontal" tabIndex={0}>
              <table className={styles.rankingTable}>
                <caption className="sr-only">Classificação global da AXB Ranked</caption>
                <thead>
                  <tr>
                    <th>Top</th>
                    <th>Jogador</th>
                    <th>Elo</th>
                    <th>Vitórias</th>
                    <th>Derrotas</th>
                    <th>MMR</th>
                  </tr>
                </thead>
                <tbody>
                  {response.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td><span className={styles.rankingPosition}>#{entry.globalPosition}</span></td>
                      <td>
                        <Link href={`/ranked/${encodeURIComponent(entry.username)}`} className={styles.rankingPlayer}>
                          <PlayerAvatar src={entry.avatarUrl} name={entry.username} size="sm" />
                          <span><strong>{entry.username}</strong><small>Perfil público</small></span>
                        </Link>
                      </td>
                      <td>
                        <RankEmblem
                          tier={entry.tier}
                          size="sm"
                          topPosition={entry.globalPosition}
                          mmr={entry.mmr}
                        />
                      </td>
                      <td>{entry.wins}</td>
                      <td>{entry.losses}</td>
                      <td><span className={styles.mmrValue}>{entry.mmr?.toLocaleString("pt-BR") ?? "Oculto"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.rankingMobile}>
              {response.entries.map((entry) => (
                <article key={entry.id} className={styles.rankingMobileCard}>
                  <span className={styles.rankingPosition}>#{entry.globalPosition}</span>
                  <Link href={`/ranked/${encodeURIComponent(entry.username)}`} className={styles.rankingPlayer}>
                    <PlayerAvatar src={entry.avatarUrl} name={entry.username} size="sm" />
                    <span>
                      <strong>{entry.username}</strong>
                      <small>{entry.tier ? rankedTierLabels[entry.tier] : "Em colocação"}</small>
                    </span>
                  </Link>
                  <div className={styles.rankingMobileStats}>
                    <RankEmblem tier={entry.tier} size="sm" showLabel={false} />
                    <strong>{entry.mmr?.toLocaleString("pt-BR") ?? "—"}</strong>
                    <small>MMR</small>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.quietButton}
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={16} aria-hidden="true" /> Anterior
              </button>
              <span>Página {response.page} de {Math.max(1, response.totalPages)} • {response.totalEntries} jogadores</span>
              <button
                type="button"
                className={styles.quietButton}
                disabled={page >= response.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <div className={styles.emptyRanking}>
            <div>
              {query || tier !== "all" ? <ShieldQuestion size={34} aria-hidden="true" /> : <Trophy size={34} aria-hidden="true" />}
              <h2>{query || tier !== "all" ? "Nenhum jogador encontrado" : "A classificação começa no primeiro X1"}</h2>
              <p>
                {query || tier !== "all"
                  ? "Ajuste a busca ou o filtro para consultar outra parte do ranking."
                  : "Ainda não existem resultados Ranked confirmados. A classificação será formada pelos primeiros X1 válidos."}
              </p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
