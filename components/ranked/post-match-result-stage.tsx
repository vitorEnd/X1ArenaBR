"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Eye,
  RotateCcw,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { RankedPostMatchResult } from "./adapter";
import { RankEmblem, rankedTierLabels } from "./rank-emblem";
import styles from "./post-match-result.module.css";

interface PostMatchResultStageProps {
  readonly result: RankedPostMatchResult;
  readonly busy: boolean;
  readonly onContinue: () => Promise<unknown>;
  readonly onFinish: () => Promise<unknown>;
}

const numberFormatter = new Intl.NumberFormat("pt-BR");

function rankChangeCopy(result: RankedPostMatchResult) {
  switch (result.rankChange) {
    case "promoted":
      return `Promovido para ${result.nextTier ? rankedTierLabels[result.nextTier] : "novo Elo"}`;
    case "demoted":
      return `Rebaixado para ${result.nextTier ? rankedTierLabels[result.nextTier] : "novo Elo"}`;
    case "placement_revealed":
      return `Elo revelado: ${result.nextTier ? rankedTierLabels[result.nextTier] : "classificado"}`;
    default:
      return result.nextTier
        ? `${rankedTierLabels[result.nextTier]} mantido`
        : "Colocação em andamento";
  }
}

function RankChangeIcon({ change }: { readonly change: RankedPostMatchResult["rankChange"] }) {
  if (change === "promoted") return <ArrowUp size={18} aria-hidden="true" />;
  if (change === "demoted") return <ArrowDown size={18} aria-hidden="true" />;
  if (change === "placement_revealed") return <Eye size={18} aria-hidden="true" />;
  return null;
}

export function PostMatchResultStage({
  result,
  busy,
  onContinue,
  onFinish,
}: PostMatchResultStageProps) {
  const reduceMotion = useReducedMotion();
  const won = result.outcome === "win";
  const showTierTransition =
    result.rankChange !== "unchanged" &&
    (result.previousTier !== result.nextTier || result.rankChange === "placement_revealed");
  const visibleTier = result.nextTier ?? result.previousTier;
  const mmrDelta = result.mmrDelta;
  const placementRevealed = result.rankChange === "placement_revealed";
  const deltaLabel =
    placementRevealed && result.newMmr !== null
      ? `${numberFormatter.format(result.newMmr)} MMR`
      : result.placementPending || mmrDelta === null
      ? "—"
      : `${mmrDelta > 0 ? "+" : ""}${numberFormatter.format(mmrDelta)} MMR`;
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.58, ease: [0.16, 1, 0.3, 1] as const };
  const runAction = (action: () => Promise<unknown>) => {
    void action().catch(() => undefined);
  };

  return (
    <section
      className={`${styles.stage} ${won ? "" : styles.stageLoss}`}
      aria-labelledby="post-match-title"
      aria-live="polite"
      data-testid="post-match-result"
    >
      <motion.article
        className={styles.shell}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 22 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={transition}
      >
        <span className={styles.sparks} aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </span>

        <div className={styles.content}>
          <motion.span
            className={styles.kicker}
            initial={reduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: reduceMotion ? 0 : 0.2 }}
          >
            Match #{result.matchNumber} • Resultado oficial
          </motion.span>

          <motion.h1
            id="post-match-title"
            className={styles.outcomeTitle}
            initial={reduceMotion ? false : { opacity: 0, scale: 1.16, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ ...transition, delay: reduceMotion ? 0 : 0.34 }}
          >
            {won ? <><span>Vit</span>ória</> : <>Der<span>rota</span></>}
          </motion.h1>

          <div className={styles.summaryGrid}>
            <motion.div
              className={styles.mmrPanel}
              initial={reduceMotion ? false : { opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...transition, delay: reduceMotion ? 0 : 0.62 }}
            >
              <span>
                {result.placementPending
                  ? "Partidas de colocação"
                  : placementRevealed
                    ? "MMR revelado"
                    : "Variação de MMR"}
              </span>
              <strong className={styles.delta}>{deltaLabel}</strong>

              {result.oldMmr !== null && result.newMmr !== null && (
                <div className={styles.mmrTrack}>
                  <small>{numberFormatter.format(result.oldMmr)}</small>
                  <ArrowRight size={15} aria-hidden="true" />
                  <span>{numberFormatter.format(result.newMmr)}</span>
                </div>
              )}

              {result.placementPending && (
                <p className={styles.placementMessage}>
                  Seu MMR continua oculto até completar as cinco partidas de colocação.
                </p>
              )}
            </motion.div>

            <motion.div
              className={styles.rankPanel}
              initial={reduceMotion ? false : { opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...transition, delay: reduceMotion ? 0 : 0.76 }}
            >
              <span>Elo após a partida</span>
              <div className={styles.rankTransition}>
                {showTierTransition && result.previousTier !== null ? (
                  <motion.div
                    initial={false}
                    animate={reduceMotion ? {} : { opacity: [1, 0.5, 0], scale: [1, 0.86, 0.72], x: [0, -48, -82] }}
                    transition={{ duration: 1, delay: 0.78, ease: "easeInOut" }}
                  >
                    <RankEmblem tier={result.previousTier} size="lg" showLabel={false} />
                  </motion.div>
                ) : null}

                <motion.div
                  style={showTierTransition ? { position: "absolute" } : undefined}
                  initial={reduceMotion ? false : showTierTransition
                    ? { opacity: 0, scale: 0.58, rotate: result.rankChange === "demoted" ? -12 : 12 }
                    : { opacity: 0, scale: 0.82 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{
                    ...transition,
                    delay: reduceMotion ? 0 : showTierTransition ? 1.22 : 0.82,
                  }}
                >
                  <RankEmblem tier={visibleTier} size="lg" showLabel={false} />
                </motion.div>
              </div>
              <strong className={styles.rankChangeLabel}>
                <RankChangeIcon change={result.rankChange} />
                {rankChangeCopy(result)}
              </strong>
            </motion.div>
          </div>

          <motion.div
            className={styles.actions}
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: reduceMotion ? 0 : 1.5 }}
          >
            <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => runAction(onContinue)}>
              <RotateCcw size={17} aria-hidden="true" /> Continuar jogando
            </button>
            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => runAction(onFinish)}>
              Encerrar sessão
            </button>
          </motion.div>
        </div>
      </motion.article>
    </section>
  );
}
