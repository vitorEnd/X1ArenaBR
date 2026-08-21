"use client";

import { Palette, Save, Search, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlayerNicknameColor, RankedPlayerNickname, RankedSupportIntent } from "./adapter";
import styles from "./ranked.module.css";

interface OfficialPlayerNicknameItem {
  readonly playerId: string;
  readonly name: string;
  readonly categoryName: string;
  readonly nickname: RankedPlayerNickname | null;
}

interface OfficialPlayerNicknameManagerProps {
  readonly players: readonly OfficialPlayerNicknameItem[];
  readonly busy: boolean;
  readonly onSubmit: (payload: RankedSupportIntent) => Promise<unknown>;
}

const colorOptions: readonly {
  readonly value: PlayerNicknameColor;
  readonly label: string;
  readonly description: string;
}[] = [
  { value: "gold", label: "Dourado", description: "Prestígio e brilho metálico" },
  { value: "red", label: "Vermelho", description: "Rivalidade e intensidade" },
  { value: "purple", label: "Roxo", description: "Raridade e energia" },
];

function nicknameClass(color: PlayerNicknameColor) {
  return `${styles.nicknameManagerPreview} ${styles[`nicknameManagerPreview${color}`]}`;
}

export function OfficialPlayerNicknameManager({
  players,
  busy,
  onSubmit,
}: OfficialPlayerNicknameManagerProps) {
  const [query, setQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.playerId ?? "");
  const selectedPlayer = players.find((player) => player.playerId === selectedPlayerId) ?? players[0] ?? null;
  const [nickname, setNickname] = useState(selectedPlayer?.nickname?.nickname ?? "");
  const [color, setColor] = useState<PlayerNicknameColor>(selectedPlayer?.nickname?.color ?? "gold");
  const [localError, setLocalError] = useState<string | null>(null);

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return players;
    return players.filter((player) =>
      `${player.name} ${player.nickname?.nickname ?? ""} ${player.categoryName}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
    );
  }, [players, query]);

  const saveNickname = async () => {
    if (!selectedPlayer) return;
    const normalizedNickname = nickname.trim();
    if (normalizedNickname.length < 2) {
      setLocalError("Informe um apelido com pelo menos 2 caracteres.");
      return;
    }

    setLocalError(null);
    try {
      await onSubmit({
        intent: "set-player-nickname",
        playerId: selectedPlayer.playerId,
        nickname: normalizedNickname,
        color,
        internalNote: `Apelido oficial de ${selectedPlayer.name} atualizado pela Central de Suporte.`,
      });
    } catch {
      // A mensagem segura do servidor aparece no painel principal.
    }
  };

  const deleteNickname = async () => {
    if (!selectedPlayer?.nickname) return;
    setLocalError(null);
    try {
      await onSubmit({
        intent: "delete-player-nickname",
        playerId: selectedPlayer.playerId,
        internalNote: `Apelido oficial de ${selectedPlayer.name} removido pela Central de Suporte.`,
      });
      setNickname("");
      setColor("gold");
    } catch {
      // A mensagem segura do servidor aparece no painel principal.
    }
  };

  return (
    <section className={`${styles.supportPanel} ${styles.nicknameManager}`} aria-labelledby="official-nicknames-title">
      <div className={styles.nicknameManagerHeader}>
        <div>
          <span className={styles.microLabel}>Jogadores do torneio</span>
          <h2 id="official-nicknames-title">Apelidos oficiais</h2>
          <p className={styles.supportPanelDescription}>
            O apelido aparece no perfil oficial, Rankings e cards da Arena.
          </p>
        </div>
        <div className={styles.nicknameManagerCount}>
          <Tag size={18} aria-hidden="true" />
          <strong>{players.filter((player) => player.nickname).length}</strong>
          <span>ativos</span>
        </div>
      </div>

      {players.length === 0 ? (
        <div className={styles.emptyCompact}>Nenhum jogador oficial está disponível.</div>
      ) : (
        <div className={styles.nicknameManagerGrid}>
          <div className={styles.nicknamePlayerColumn}>
            <div className={styles.searchField}>
              <Search size={17} aria-hidden="true" />
              <label className="sr-only" htmlFor="official-player-nickname-search">Buscar jogador oficial</label>
              <input
                id="official-player-nickname-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar jogador ou apelido"
              />
            </div>
            <div className={styles.nicknamePlayerList} role="list" aria-label="Jogadores oficiais">
              {filteredPlayers.map((player) => (
                <button
                  key={player.playerId}
                  type="button"
                  role="listitem"
                  className={`${styles.nicknamePlayerOption} ${player.playerId === selectedPlayer?.playerId ? styles.nicknamePlayerOptionActive : ""}`}
                  onClick={() => {
                    setSelectedPlayerId(player.playerId);
                    setNickname(player.nickname?.nickname ?? "");
                    setColor(player.nickname?.color ?? "gold");
                    setLocalError(null);
                  }}
                >
                  <span>
                    <strong>{player.name}</strong>
                    <small>{player.categoryName}</small>
                  </span>
                  {player.nickname ? (
                    <em className={nicknameClass(player.nickname.color)}>{player.nickname.nickname}</em>
                  ) : (
                    <small>Sem apelido</small>
                  )}
                </button>
              ))}
              {filteredPlayers.length === 0 && (
                <div className={styles.emptyCompact}>Nenhum jogador corresponde à busca.</div>
              )}
            </div>
          </div>

          {selectedPlayer && (
            <div className={styles.nicknameEditor}>
              <div className={styles.nicknameEditorIdentity}>
                <span className={styles.microLabel}>Editando jogador oficial</span>
                <strong>{selectedPlayer.name}</strong>
                <small>{selectedPlayer.categoryName}</small>
              </div>

              <div className={styles.field}>
                <label htmlFor="official-player-nickname">Apelido</label>
                <input
                  id="official-player-nickname"
                  value={nickname}
                  minLength={2}
                  maxLength={48}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Digite o apelido do jogador"
                />
                <span className={styles.charCount}>{nickname.length}/48</span>
              </div>

              <fieldset className={styles.nicknameColorFieldset}>
                <legend><Palette size={15} aria-hidden="true" /> Estilo do apelido</legend>
                <div className={styles.nicknameColorOptions}>
                  {colorOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`${styles.nicknameColorOption} ${color === option.value ? styles.nicknameColorOptionActive : ""}`}
                    >
                      <input
                        type="radio"
                        name="official-nickname-color"
                        value={option.value}
                        checked={color === option.value}
                        onChange={() => setColor(option.value)}
                      />
                      <span className={styles[`nicknameColorSwatch${option.value}`]} aria-hidden="true" />
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.nicknamePreviewStage} aria-live="polite">
                <span>Prévia no site</span>
                <strong>{selectedPlayer.name}</strong>
                <em className={nicknameClass(color)}>{nickname.trim() || "SEU APELIDO"}</em>
              </div>

              {localError && <p className={styles.formError} role="alert">{localError}</p>}
              <div className={styles.nicknameManagerActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={busy || nickname.trim().length < 2}
                  onClick={() => void saveNickname()}
                >
                  <Save size={16} aria-hidden="true" /> Salvar apelido
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={busy || !selectedPlayer.nickname}
                  onClick={() => void deleteNickname()}
                >
                  <Trash2 size={16} aria-hidden="true" /> Excluir
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
