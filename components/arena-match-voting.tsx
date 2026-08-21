"use client";

import { Check, LogIn } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

interface MatchVoteState {
  readonly playerAVotes: number;
  readonly playerBVotes: number;
  readonly ownVote: string | null;
  readonly votingOpen: boolean;
}

interface MatchVoteRow {
  readonly match_id: string;
  readonly player_a_votes: number | string;
  readonly player_b_votes: number | string;
  readonly own_vote: string | null;
  readonly voting_open: boolean;
}

interface VotingContextValue {
  readonly authenticated: boolean | null;
  readonly busyMatchId: string | null;
  readonly error: string | null;
  readonly errorMatchId: string | null;
  readonly states: Readonly<Record<string, MatchVoteState>>;
  readonly vote: (matchId: string, playerId: string) => Promise<void>;
}

const VotingContext = createContext<VotingContextValue | null>(null);

function normalizeVoteRows(rows: unknown): Record<string, MatchVoteState> {
  if (!Array.isArray(rows)) return {};

  return (rows as MatchVoteRow[]).reduce<Record<string, MatchVoteState>>(
    (states, row) => {
      states[row.match_id] = {
        playerAVotes: Number(row.player_a_votes) || 0,
        playerBVotes: Number(row.player_b_votes) || 0,
        ownVote: row.own_vote,
        votingOpen: row.voting_open,
      };
      return states;
    },
    {},
  );
}

function publicVoteError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";

  if (message.toLocaleLowerCase("pt-BR").includes("encerrada")) {
    return "A votação deste confronto foi encerrada.";
  }
  if (message.toLocaleLowerCase("pt-BR").includes("conta")) {
    return "Entre na sua conta para votar.";
  }
  return "Não foi possível registrar o voto. Tente novamente.";
}

export function ArenaCardVotingProvider({
  matchIds: initialMatchIds,
  children,
}: {
  readonly matchIds: readonly string[];
  readonly children: React.ReactNode;
}) {
  const matchIdsKey = initialMatchIds.join(",");
  const matchIds = useMemo(
    () => matchIdsKey.split(",").filter(Boolean),
    [matchIdsKey],
  );
  const [states, setStates] = useState<Record<string, MatchVoteState>>({});
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorMatchId, setErrorMatchId] = useState<string | null>(null);

  const fetchVoteState = useCallback(async () => {
    if (matchIds.length === 0) {
      return { authenticated: false, states: {} };
    }

    const supabase = createClient();
    const [voteResult, sessionResult] = await Promise.all([
      supabase.rpc("arena_get_match_vote_state", { p_match_ids: matchIds }),
      supabase.auth.getSession(),
    ]);

    if (voteResult.error) throw voteResult.error;
    return {
      authenticated: Boolean(sessionResult.data.session?.user),
      states: normalizeVoteRows(voteResult.data),
    };
  }, [matchIds]);

  useEffect(() => {
    let active = true;

    void fetchVoteState()
      .then((result) => {
        if (!active) return;
        setStates(result.states);
        setAuthenticated(result.authenticated);
        setError(null);
        setErrorMatchId(null);
      })
      .catch(() => {
        if (!active) return;
        setError("Não foi possível carregar os palpites agora.");
        setErrorMatchId(null);
        setAuthenticated(false);
      });

    return () => {
      active = false;
    };
  }, [fetchVoteState]);

  const vote = useCallback(
    async (matchId: string, playerId: string) => {
      if (!authenticated || busyMatchId) return;

      setBusyMatchId(matchId);
      setError(null);
      setErrorMatchId(null);
      try {
        const supabase = createClient();
        const result = await supabase.rpc("arena_vote_for_match", {
          p_match_id: matchId,
          p_player_id: playerId,
        });
        if (result.error) throw result.error;

        const refreshed = await supabase.rpc("arena_get_match_vote_state", {
          p_match_ids: matchIds,
        });
        if (refreshed.error) throw refreshed.error;
        setStates(normalizeVoteRows(refreshed.data));
      } catch (voteError) {
        setError(publicVoteError(voteError));
        setErrorMatchId(matchId);
      } finally {
        setBusyMatchId(null);
      }
    },
    [authenticated, busyMatchId, matchIds],
  );

  const value = useMemo<VotingContextValue>(
    () => ({ authenticated, busyMatchId, error, errorMatchId, states, vote }),
    [authenticated, busyMatchId, error, errorMatchId, states, vote],
  );

  return <VotingContext.Provider value={value}>{children}</VotingContext.Provider>;
}

function voteLabel(count: number) {
  return `${count} ${count === 1 ? "voto" : "votos"}`;
}

export function ArenaMatchVoting({
  matchId,
  playerAId,
  playerAName,
  playerBId,
  playerBName,
}: {
  readonly matchId: string;
  readonly playerAId: string;
  readonly playerAName: string;
  readonly playerBId: string;
  readonly playerBName: string;
}) {
  const context = useContext(VotingContext);
  if (!context) return null;

  const state = context.states[matchId];
  const playerAVotes = state?.playerAVotes ?? 0;
  const playerBVotes = state?.playerBVotes ?? 0;
  const totalVotes = playerAVotes + playerBVotes;
  const playerAPercentage = totalVotes > 0
    ? Math.round((playerAVotes / totalVotes) * 100)
    : 50;
  const playerBPercentage = 100 - playerAPercentage;
  const loading = !state;
  const busy = context.busyMatchId === matchId;
  const disabled = loading || busy || !state?.votingOpen || !context.authenticated;
  const graphLabel = totalVotes > 0
    ? `${playerAName}: ${playerAPercentage}%. ${playerBName}: ${playerBPercentage}%.`
    : "Nenhum palpite registrado.";

  return (
    <section className="arena-match-vote" aria-label={`Palpite para ${playerAName} contra ${playerBName}`}>
      <header className="arena-match-vote__heading">
        <div>
          <span>Palpite da comunidade</span>
          <strong>Quem vence este X1?</strong>
        </div>
        <small>{totalVotes > 0 ? voteLabel(totalVotes) : "Seja o primeiro a votar"}</small>
      </header>

      <div className="arena-match-vote__choices">
        <button
          type="button"
          className={state?.ownVote === playerAId ? "is-selected" : undefined}
          aria-pressed={state?.ownVote === playerAId}
          disabled={disabled}
          onClick={() => void context.vote(matchId, playerAId)}
        >
          <span>{playerAName}</span>
          <strong>{loading ? "—" : `${playerAPercentage}%`}</strong>
          <small>{voteLabel(playerAVotes)}</small>
          {state?.ownVote === playerAId && <Check size={14} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={state?.ownVote === playerBId ? "is-selected" : undefined}
          aria-pressed={state?.ownVote === playerBId}
          disabled={disabled}
          onClick={() => void context.vote(matchId, playerBId)}
        >
          <span>{playerBName}</span>
          <strong>{loading ? "—" : `${playerBPercentage}%`}</strong>
          <small>{voteLabel(playerBVotes)}</small>
          {state?.ownVote === playerBId && <Check size={14} aria-hidden="true" />}
        </button>
      </div>

      <div
        className={`arena-match-vote__graph${totalVotes === 0 ? " is-empty" : ""}`}
        role="img"
        aria-label={graphLabel}
      >
        <span style={{ width: `${playerAPercentage}%` }} />
        <span style={{ width: `${playerBPercentage}%` }} />
      </div>

      <div className="arena-match-vote__status" aria-live="polite">
        {busy && <span>Registrando seu voto…</span>}
        {!busy && state && !state.votingOpen && <span>Votação encerrada</span>}
        {!busy && state?.votingOpen && context.authenticated === false && (
          <Link href="/auth/entrar?next=%2Feventos">
            <LogIn size={14} aria-hidden="true" /> Entre para votar
          </Link>
        )}
        {!busy && context.error && (!context.errorMatchId || context.errorMatchId === matchId) && (
          <span className="is-error">{context.error}</span>
        )}
      </div>
    </section>
  );
}
