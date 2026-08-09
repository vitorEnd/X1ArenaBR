"use client";

import { KeyRound, Send } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  updatePasswordAction,
} from "@/app/auth/actions";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/ranked/action-state";
import { FormFeedback, SubmitButton } from "./form-parts";
import styles from "./auth.module.css";

export function PasswordResetRequestForm({
  configured,
}: {
  readonly configured: boolean;
}) {
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    INITIAL_AUTH_ACTION_STATE,
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="reset-email">E-mail da conta</label>
        <input
          className={styles.input}
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={!configured}
        />
      </div>
      <FormFeedback state={state} />
      <SubmitButton disabled={!configured} pendingLabel="Enviando…">
        <Send size={17} aria-hidden="true" />
        Enviar link seguro
      </SubmitButton>
      <div className={styles.inlineLinks}>
        <Link href="/auth/entrar">Voltar para entrar</Link>
      </div>
    </form>
  );
}

export function UpdatePasswordForm({
  configured,
}: {
  readonly configured: boolean;
}) {
  const [state, formAction] = useActionState(
    updatePasswordAction,
    INITIAL_AUTH_ACTION_STATE,
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="new-password">Nova senha</label>
        <input
          className={styles.input}
          id="new-password"
          name="password"
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          required
          disabled={!configured}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="confirm-new-password">Confirmar nova senha</label>
        <input
          className={styles.input}
          id="confirm-new-password"
          name="confirmPassword"
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          required
          disabled={!configured}
        />
      </div>
      <FormFeedback state={state} />
      <SubmitButton disabled={!configured} pendingLabel="Atualizando…">
        <KeyRound size={17} aria-hidden="true" />
        Atualizar senha
      </SubmitButton>
    </form>
  );
}
