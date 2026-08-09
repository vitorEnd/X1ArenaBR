"use client";

import { Gamepad2, LogIn } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import {
  discordLoginAction,
  loginAction,
} from "@/app/auth/actions";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/ranked/action-state";
import { FormFeedback, SubmitButton } from "./form-parts";
import styles from "./auth.module.css";

interface LoginFormProps {
  readonly configured: boolean;
  readonly next: string;
}

export function LoginForm({ configured, next }: LoginFormProps) {
  const [state, formAction] = useActionState(
    loginAction,
    INITIAL_AUTH_ACTION_STATE,
  );

  return (
    <div className={styles.form}>
      <form action={discordLoginAction}>
        <input type="hidden" name="next" value={next} />
        <button className={styles.discord} type="submit" disabled={!configured}>
          <Gamepad2 size={18} aria-hidden="true" />
          Entrar com Discord
        </button>
      </form>

      <div className={styles.divider}>ou use seu e-mail</div>

      <form action={formAction} className={styles.form} noValidate>
        <input type="hidden" name="next" value={next} />
        <div className={styles.field}>
          <label htmlFor="login-email">E-mail</label>
          <input
            className={styles.input}
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            disabled={!configured}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="login-password">Senha</label>
          <input
            className={styles.input}
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={!configured}
          />
        </div>

        <FormFeedback state={state} />
        <SubmitButton disabled={!configured} pendingLabel="Entrando…">
          <LogIn size={17} aria-hidden="true" />
          Entrar na ranked
        </SubmitButton>
      </form>

      <div className={styles.links}>
        <Link href="/auth/cadastro">Criar minha conta</Link>
        <Link href="/auth/esqueci-senha">Esqueci a senha</Link>
      </div>
    </div>
  );
}
