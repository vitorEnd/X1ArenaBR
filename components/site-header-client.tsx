"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  LogIn,
  Menu,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DISCORD_URL, navigation } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "./brand-mark";

export interface HeaderAccount {
  readonly name: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
  readonly hasRankedProfile: boolean;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function accountInitial(account: HeaderAccount | null) {
  return account?.name.trim().slice(0, 1).toLocaleUpperCase("pt-BR") || "A";
}

function AccountAvatar({ account }: { readonly account: HeaderAccount }) {
  return (
    <span className="header-account__avatar" aria-hidden="true">
      <span>{accountInitial(account)}</span>
      {account.avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.avatarUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}

export function SiteHeaderClient({
  account,
}: {
  readonly account: HeaderAccount | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const returnPath = pathname.startsWith("/auth") ? "/matchmaking" : pathname;
  const loginHref = `/auth/entrar?next=${encodeURIComponent(returnPath)}`;
  const accountHref = account?.hasRankedProfile
    ? `/ranked/${encodeURIComponent(account.name)}`
    : "/conta/perfil";

  function closeMenu(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    try {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          if (Boolean(session?.user) !== Boolean(account)) router.refresh();
        },
      );
      return () => data.subscription.unsubscribe();
    } catch {
      return;
    }
  }, [account, router]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = mobileNavRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const desktopQuery = window.matchMedia("(min-width: 901px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    const focusFrame = window.requestAnimationFrame(() => {
      mobileNavRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    });
    document.addEventListener("keydown", onKeyDown);
    desktopQuery.addEventListener("change", closeAtDesktop);
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      desktopQuery.removeEventListener("change", closeAtDesktop);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="site-header">
      <div className="site-header__inner page-container">
        <BrandMark priority />

        <nav className="desktop-nav" aria-label="Navegação principal">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={isActive(pathname, item.href) ? "is-active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {account ? (
            <Link
              href={accountHref}
              className="header-account"
              aria-label={
                account.hasRankedProfile
                  ? `Abrir meu perfil público: ${account.name}`
                  : `Completar meu perfil ranked: ${account.name}`
              }
            >
              <AccountAvatar account={account} />
              <span className="header-account__copy">
                <small>
                  {account.hasRankedProfile ? "Meu perfil" : "Completar perfil"}
                </small>
                <strong>{account.name}</strong>
              </span>
              <ChevronRight className="header-account__arrow" size={16} aria-hidden="true" />
            </Link>
          ) : (
            <Link
              href={loginHref}
              className="header-account header-account--anonymous"
              aria-label="Entrar ou criar uma conta ranked"
            >
              <span className="header-account__avatar" aria-hidden="true">
                <LogIn size={18} />
              </span>
              <span className="header-account__copy">
                <small>Conta ranked</small>
                <strong>Entrar ou criar</strong>
              </span>
            </Link>
          )}

          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="button-gold header-discord"
          >
            <Shield size={17} aria-hidden="true" />
            <span>Entrar no Discord</span>
          </a>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="mobile-menu-button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            ref={mobileNavRef}
            id="mobile-navigation"
            className="mobile-nav"
            aria-label="Navegação mobile"
            initial={
              reduceMotion
                ? false
                : { opacity: 0, clipPath: "inset(0 0 100% 0)" }
            }
            animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
            exit={
              reduceMotion
                ? { opacity: 1, clipPath: "inset(0 0 0% 0)" }
                : { opacity: 0, clipPath: "inset(0 0 100% 0)" }
            }
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          >
            <div className="mobile-nav__links page-container">
              {account ? (
                <Link
                  href={accountHref}
                  className="mobile-nav__account"
                  onClick={() => closeMenu(false)}
                >
                  <AccountAvatar account={account} />
                  <span className="mobile-nav__account-copy">
                    <small>
                      {account.hasRankedProfile ? "Meu perfil ranked" : "Completar perfil"}
                    </small>
                    <strong>{account.name}</strong>
                    {account.email && <span>{account.email}</span>}
                  </span>
                  <ChevronRight size={22} aria-hidden="true" />
                </Link>
              ) : (
                <div className="mobile-nav__auth">
                  <p>Entre para disputar a ranked AXB.</p>
                  <div>
                    <Link href={loginHref} onClick={() => closeMenu(false)}>
                      <LogIn size={17} aria-hidden="true" /> Entrar
                    </Link>
                    <Link href="/auth/cadastro" onClick={() => closeMenu(false)}>
                      <UserPlus size={17} aria-hidden="true" /> Criar conta
                    </Link>
                  </div>
                </div>
              )}

              <div className="mobile-nav__primary-links">
                {navigation.map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={reduceMotion ? false : { opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: reduceMotion ? 0 : index * 0.035,
                      duration: reduceMotion ? 0 : undefined,
                    }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => closeMenu(false)}
                      aria-current={
                        isActive(pathname, item.href) ? "page" : undefined
                      }
                      className={
                        isActive(pathname, item.href) ? "is-active" : ""
                      }
                    >
                      <span>0{index + 1}</span>
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="button-gold mobile-nav__discord"
              >
                Entrar no Discord
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
