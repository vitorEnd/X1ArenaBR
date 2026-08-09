import styles from "./auth.module.css";

export function AuthConfigNotice() {
  const development = process.env.NODE_ENV === "development";
  return (
    <div className={styles.notice} role="status">
      {development ? (
        <>
          A autenticação está pronta, mas ainda precisa das variáveis{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> no arquivo{" "}
          <code>.env.local</code>. Nenhuma sessão de teste foi criada.
        </>
      ) : (
        "O acesso à ranked está temporariamente indisponível."
      )}
    </div>
  );
}
