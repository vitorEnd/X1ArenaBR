"use client";

import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/lib/ranked/action-state";
import styles from "./auth.module.css";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly pendingLabel?: string;
}

export function SubmitButton({
  children,
  pendingLabel = "Processando…",
  disabled,
  className,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      className={className ?? styles.submit}
    >
      {pending && <LoaderCircle size={17} aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormFeedback({
  state,
}: {
  readonly state: AuthActionState;
}) {
  if (!state.message) return null;
  return (
    <p
      className={styles.feedback}
      data-status={state.status}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}
