"use client";

import { Camera, ImageUp, Palette, Save, Search, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlayerNicknameColor, RankedPlayerNickname, RankedSupportIntent } from "./adapter";
import styles from "./ranked.module.css";

interface OfficialPlayerNicknameItem {
  readonly playerId: string;
  readonly name: string;
  readonly categoryName: string;
  readonly nickname: RankedPlayerNickname | null;
  readonly avatarUrl: string | null;
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

async function cropAvatarToWebp(file: File) {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    throw new Error("Use uma imagem PNG, JPG ou WebP.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível ler esta imagem."));
      image.src = objectUrl;
    });

    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error("A imagem selecionada não possui dimensões válidas.");
    }

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      512,
      512,
    );

    const dataUrl = canvas.toDataURL("image/webp", 0.9);
    if (!dataUrl.startsWith("data:image/webp")) {
      throw new Error("Seu navegador não oferece suporte à conversão WebP.");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [processingAvatar, setProcessingAvatar] = useState(false);
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

  const prepareAvatar = async (file: File | undefined) => {
    if (!file) return;
    setProcessingAvatar(true);
    setLocalError(null);
    try {
      setAvatarDataUrl(await cropAvatarToWebp(file));
    } catch (avatarError) {
      setAvatarDataUrl("");
      setLocalError(avatarError instanceof Error ? avatarError.message : "Não foi possível preparar a imagem.");
    } finally {
      setProcessingAvatar(false);
    }
  };

  const saveAvatar = async () => {
    if (!selectedPlayer || !avatarDataUrl) return;
    setLocalError(null);
    try {
      await onSubmit({
        intent: "set-official-player-avatar",
        playerId: selectedPlayer.playerId,
        avatarDataUrl,
        internalNote: `Foto oficial de ${selectedPlayer.name} atualizada pela Central de Suporte.`,
      });
      setAvatarDataUrl("");
    } catch {
      // A mensagem segura do servidor aparece no painel principal.
    }
  };

  const deleteAvatar = async () => {
    if (!selectedPlayer?.avatarUrl) return;
    setLocalError(null);
    try {
      await onSubmit({
        intent: "delete-official-player-avatar",
        playerId: selectedPlayer.playerId,
        internalNote: `Foto oficial de ${selectedPlayer.name} removida pela Central de Suporte.`,
      });
      setAvatarDataUrl("");
    } catch {
      // A mensagem segura do servidor aparece no painel principal.
    }
  };

  return (
    <section className={`${styles.supportPanel} ${styles.nicknameManager}`} aria-labelledby="official-nicknames-title">
      <div className={styles.nicknameManagerHeader}>
        <div>
          <span className={styles.microLabel}>Jogadores do torneio</span>
          <h2 id="official-nicknames-title">Identidade oficial</h2>
          <p className={styles.supportPanelDescription}>
            Gerencie fotos e apelidos exibidos no perfil, Rankings e cards da Arena.
          </p>
        </div>
        <div className={styles.nicknameManagerCounts}>
          <div className={styles.nicknameManagerCount}>
            <Tag size={18} aria-hidden="true" />
            <strong>{players.filter((player) => player.nickname).length}</strong>
            <span>apelidos</span>
          </div>
          <div className={styles.nicknameManagerCount}>
            <Camera size={18} aria-hidden="true" />
            <strong>{players.filter((player) => player.avatarUrl).length}</strong>
            <span>fotos</span>
          </div>
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
                    setAvatarDataUrl("");
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

              <div className={styles.officialAvatarEditor}>
                <div
                  className={`${styles.officialAvatarPreview} ${(avatarDataUrl || selectedPlayer.avatarUrl) ? styles.officialAvatarPreviewHasImage : ""}`}
                  style={(avatarDataUrl || selectedPlayer.avatarUrl)
                    ? { backgroundImage: `url(${JSON.stringify(avatarDataUrl || selectedPlayer.avatarUrl)})` }
                    : undefined}
                  role="img"
                  aria-label={`Prévia da foto oficial de ${selectedPlayer.name}`}
                >
                  {!(avatarDataUrl || selectedPlayer.avatarUrl) && <Camera aria-hidden="true" />}
                </div>
                <div className={styles.officialAvatarControls}>
                  <div>
                    <span className={styles.microLabel}>Foto oficial</span>
                    <p>O recorte central é convertido automaticamente para WebP 512 × 512.</p>
                  </div>
                  <div className={styles.officialAvatarButtons}>
                    <label className={styles.secondaryButton} aria-disabled={busy || processingAvatar}>
                      <ImageUp size={16} aria-hidden="true" />
                      {processingAvatar ? "Preparando..." : "Escolher imagem"}
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy || processingAvatar}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          void prepareAvatar(file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={busy || processingAvatar || !avatarDataUrl}
                      onClick={() => void saveAvatar()}
                    >
                      <Save size={16} aria-hidden="true" /> Salvar foto
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      disabled={busy || processingAvatar || !selectedPlayer.avatarUrl}
                      onClick={() => void deleteAvatar()}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Remover foto
                    </button>
                  </div>
                  <small>PNG, JPG ou WebP · máximo 5 MB.</small>
                </div>
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
