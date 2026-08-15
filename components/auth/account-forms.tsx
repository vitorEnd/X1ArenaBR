"use client";

import { Gamepad2, KeyRound, Save, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createRankedProfileAction,
  setAccountPasswordAction,
  updateAvatarAction,
  updateRankedUsernameAction,
  setRankedAnonymousModeAction,
} from "@/app/conta/actions";
import {
  INITIAL_ACCOUNT_ACTION_STATE,
  type AccountActionState,
} from "@/lib/ranked/action-state";
import { AVATAR_MAX_BYTES, validateAvatarMetadata } from "@/lib/ranked/avatar";
import { createClient } from "@/lib/supabase/client";
import { FormFeedback, SubmitButton } from "./form-parts";
import styles from "./auth.module.css";

export function ProfileOnboardingForm({ next }: { readonly next: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    createRankedProfileAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    router.push(next);
    router.refresh();
  }, [next, router, state.status]);

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="ranked-username">Nome dentro da ranked</label>
        <input
          className={styles.input}
          id="ranked-username"
          name="username"
          type="text"
          minLength={3}
          maxLength={24}
          autoComplete="nickname"
          spellCheck={false}
          required
        />
      </div>
      <p className={styles.finePrint}>
        O nome é público, precisa ser único e pode ser diferente do seu nome no
        World of Football.
      </p>
      <FormFeedback state={state} />
      <SubmitButton pendingLabel="Criando perfil…">
        <Gamepad2 size={17} aria-hidden="true" />
        Confirmar nome ranked
      </SubmitButton>
    </form>
  );
}

export function UsernameForm({ currentName }: { readonly currentName: string }) {
  const [state, formAction] = useActionState(
    updateRankedUsernameAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="account-username">Novo nome ranked</label>
        <input
          className={styles.input}
          id="account-username"
          name="username"
          type="text"
          minLength={3}
          maxLength={24}
          defaultValue={currentName}
          autoComplete="nickname"
          spellCheck={false}
          required
        />
      </div>
      <p className={styles.finePrint}>
        A troca é permitida a cada três horas. O histórico anterior fica
        disponível somente para o suporte.
      </p>
      <FormFeedback state={state} />
      <SubmitButton pendingLabel="Salvando…">
        <Save size={17} aria-hidden="true" />
        Salvar novo nome
      </SubmitButton>
    </form>
  );
}

export function AnonymousModeForm({ enabled }: { readonly enabled: boolean }) {
  const [state, formAction] = useActionState(setRankedAnonymousModeAction, INITIAL_ACCOUNT_ACTION_STATE);
  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.provider}>
        <span><input type="checkbox" name="anonymousMode" defaultChecked={enabled} /> Modo Anônimo</span>
        <span className={styles.profileMeta}>Privacidade Ranked</span>
      </label>
      <p className={styles.finePrint}>Oculta MMR, vitórias, derrotas, estatísticas e histórico. No leaderboard, seu nome vira Anonimo0001.</p>
      <FormFeedback state={state} />
      <SubmitButton pendingLabel="Salvando…"><Save size={17} aria-hidden="true" /> Salvar privacidade</SubmitButton>
    </form>
  );
}

export function AccountPasswordForm() {
  const [state, formAction] = useActionState(
    setAccountPasswordAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="account-password">Nova senha</label>
        <input
          className={styles.input}
          id="account-password"
          name="password"
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="account-confirm-password">Confirmar nova senha</label>
        <input
          className={styles.input}
          id="account-confirm-password"
          name="confirmPassword"
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          required
        />
      </div>
      <FormFeedback state={state} />
      <SubmitButton pendingLabel="Atualizando…">
        <KeyRound size={17} aria-hidden="true" />
        Adicionar ou trocar senha
      </SubmitButton>
    </form>
  );
}

export function DiscordIdentityButton({
  connected,
}: {
  readonly connected: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<AccountActionState>(
    INITIAL_ACCOUNT_ACTION_STATE,
  );

  function connect() {
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.linkIdentity({
          provider: "discord",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/conta?linked=discord")}`,
          },
        });
        if (error) {
          setMessage({
            status: "error",
            message:
              "Não foi possível conectar o Discord. Confirme se a vinculação manual está ativada no Supabase.",
          });
          return;
        }
        if (data.url) window.location.assign(data.url);
      } catch {
        setMessage({
          status: "error",
          message: "A autenticação ainda não foi configurada.",
        });
      }
    });
  }

  return (
    <div className={styles.form}>
      <button
        className={styles.discord}
        type="button"
        onClick={connect}
        disabled={connected || pending}
      >
        <Gamepad2 size={18} aria-hidden="true" />
        {connected
          ? "Discord conectado"
          : pending
            ? "Abrindo Discord…"
            : "Conectar Discord"}
      </button>
      <FormFeedback state={message} />
    </div>
  );
}

async function createSquareAvatar(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const targetSize = Math.min(512, sourceSize);
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error("canvas");
  }

  const sourceX = (bitmap.width - sourceSize) / 2;
  const sourceY = (bitmap.height - sourceSize) / 2;
  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    targetSize,
    targetSize,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.9);
  });
  if (!blob) throw new Error("blob");
  return new File([blob], "avatar.webp", { type: "image/webp" });
}

export function AvatarUploader({ currentUrl }: { readonly currentUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [message, setMessage] = useState<AccountActionState>(
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const metadataError = validateAvatarMetadata(file);
    if (metadataError || file.size > AVATAR_MAX_BYTES) {
      setMessage({ status: "error", message: metadataError ?? "Arquivo muito grande." });
      setCroppedFile(null);
      return;
    }

    try {
      const cropped = await createSquareAvatar(file);
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setCroppedFile(cropped);
      setPreviewUrl(URL.createObjectURL(cropped));
      setMessage({
        status: "success",
        message: "Prévia pronta em recorte quadrado. Confirme para enviar.",
      });
    } catch {
      setMessage({ status: "error", message: "Não foi possível processar essa imagem." });
      setCroppedFile(null);
    }
  }

  function upload() {
    if (!croppedFile) {
      setMessage({ status: "error", message: "Escolha uma imagem primeiro." });
      inputRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("avatar", croppedFile);
      const result = await updateAvatarAction(formData);
      setMessage(result);
      if (result.status === "success") {
        setCroppedFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <div className={styles.form}>
      {previewUrl && (
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Prévia quadrada do avatar ranked" />
          <span className={styles.finePrint}>Recorte central em formato quadrado.</span>
        </div>
      )}
      <div className={styles.field}>
        <label htmlFor="ranked-avatar">Imagem do avatar</label>
        <input
          ref={inputRef}
          className={styles.fileInput}
          id="ranked-avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChange}
          disabled={pending}
        />
      </div>
      <p className={styles.finePrint}>PNG, JPG ou WebP, com até 5 MB.</p>
      <FormFeedback state={message} />
      <button
        className={styles.secondary}
        type="button"
        onClick={upload}
        disabled={pending || !croppedFile}
      >
        <Upload size={17} aria-hidden="true" />
        {pending ? "Enviando…" : "Enviar avatar"}
      </button>
    </div>
  );
}
