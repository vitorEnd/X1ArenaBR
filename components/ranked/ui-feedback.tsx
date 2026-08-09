import { AlertTriangle, LoaderCircle, Radio, RotateCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import styles from "./ranked.module.css";

export function RankedLoading({ label = "Carregando Arena Ranked" }: { readonly label?: string }) {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite">
      <LoaderCircle aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface RankedErrorProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

export function RankedError({ message, onRetry }: RankedErrorProps) {
  return (
    <div className={styles.feedbackPanel} role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <span className={styles.microLabel}>Conexão interrompida</span>
        <h2>A Arena não respondeu</h2>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className={styles.secondaryButton} onClick={onRetry}>
          <RotateCcw size={17} aria-hidden="true" /> Tentar novamente
        </button>
      )}
    </div>
  );
}

export function RankedConfigurationNotice() {
  return (
    <div className={styles.feedbackPanel} role="status">
      <ShieldAlert aria-hidden="true" />
      <div>
        <span className={styles.microLabel}>Arena Ranked</span>
        <h2>Sistema em preparação</h2>
        <p>
          O matchmaking será liberado quando a conexão segura da Arena estiver configurada.
          A classificação só será exibida depois que existirem dados oficiais.
        </p>
      </div>
    </div>
  );
}

export function RankedLoginNotice() {
  return (
    <div className={styles.feedbackPanel}>
      <Radio aria-hidden="true" />
      <div>
        <span className={styles.microLabel}>Fila global</span>
        <h2>Entre para buscar uma partida</h2>
        <p>Use Discord ou e-mail para acessar sua conta exclusiva da Ranked.</p>
      </div>
      <Link className={styles.primaryButton} href="/auth/entrar?next=/matchmaking">
        Entrar na Ranked
      </Link>
    </div>
  );
}
