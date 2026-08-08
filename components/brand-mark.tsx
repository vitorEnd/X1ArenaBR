import Link from "next/link";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className = "" }: BrandMarkProps) {
  return (
    <Link
      href="/"
      aria-label="WOF Arena X1 BR — início"
      className={`brand-mark ${className}`}
    >
      <span className="brand-wordmark" aria-hidden="true">
        AXB
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>WOF ARENA</strong>
          <small>X1 BRASIL</small>
        </span>
      )}
    </Link>
  );
}
