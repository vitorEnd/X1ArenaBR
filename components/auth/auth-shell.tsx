import type { ReactNode } from "react";
import styles from "./auth.module.css";

interface AuthShellProps {
  readonly kicker: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

export function AuthShell({ kicker, title, description, children }: AuthShellProps) {
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.kicker}>{kicker}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </section>
  );
}
