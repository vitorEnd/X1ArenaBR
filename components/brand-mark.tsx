import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
  priority?: boolean;
};

export function BrandMark({
  compact = false,
  className = "",
  priority = false,
}: BrandMarkProps) {
  return (
    <Link
      href="/"
      aria-label="WOF Arena X1 BR — início"
      className={`brand-mark ${compact ? "brand-mark--compact" : ""} ${className}`.trim()}
    >
      <span className="brand-logo-frame" aria-hidden="true">
        <Image
          src="/images/axb-logo.png"
          alt=""
          width={1024}
          height={1024}
          className="brand-logo"
          priority={priority}
          sizes={
            compact
              ? "(max-width: 640px) 124px, 148px"
              : "(max-width: 900px) 54px, 62px"
          }
        />
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
