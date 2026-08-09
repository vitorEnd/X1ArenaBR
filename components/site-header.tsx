"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, Shield, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DISCORD_URL, navigation } from "@/lib/site";
import { BrandMark } from "./brand-mark";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  function closeMenu(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

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

        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="button-gold header-discord"
        >
          <Shield size={17} aria-hidden="true" />
          Entrar no Discord
        </a>

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
