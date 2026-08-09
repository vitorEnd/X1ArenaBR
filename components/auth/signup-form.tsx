"use client";

import { Gamepad2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import {
  discordLoginAction,
  signupAction,
} from "@/app/auth/actions";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/ranked/action-state";
import { FormFeedback, SubmitButton } from "./form-parts";
import styles from "./auth.module.css";

export function SignupForm({ configured }: { readonly configured: boolean }) {
  const [state, formAction] = useActionState(
    signupAction,
    INITIAL_AUTH_ACTION_STATE,
  );

  return (
    <div className={styles.form}>
      <form action={discordLoginAction}>
        <input type="hidden" name="next" value="/conta/perfil" />
        <button className={styles.discord} type="submit" disabled={!configured}>
          <Gamepad2 size={18} aria-hidden="true" />
          Criar com Discord
        </button>
      </form>

      <div className={styles.divider}>ou cadastre seu e-mail</div>

      <form action={formAction} className={styles.form} noValidate>
        <div className={styles.field}>
          <label htmlFor="signup-email">E-mail</label>
          <input
            className={styles.input}
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            disabled={!configured}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-password">Senha</label>
          <input
            className={styles.input}
            id="signup-password"
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
          <label htmlFor="signup-confirm-password">Confirmar senha</label>
          <input
            className={styles.input}
            id="signup-confirm-password"
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
        <SubmitButton disabled={!configured} pendingLabel="Criando conta…">
          <UserPlus size={17} aria-hidden="true" />
          Criar conta
        </SubmitButton>
      </form>

      <p className={styles.finePrint}>
        A conta ranked é independente dos jogadores e torneios oficiais da AXB.
      </p>
      <div className={styles.inlineLinks}>
        <span>Já possui uma conta?</span>
        <Link href="/auth/entrar">Entrar</Link>
      </div>
    </div>
  );
}
