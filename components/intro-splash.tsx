"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const SESSION_KEY = "axb-intro-viewed";

export function IntroSplash() {
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "true");
    const pageRegions = document.querySelectorAll<HTMLElement>(
      "header, main, footer, .mobile-discord-cta",
    );
    const previousOverflow = document.body.style.overflow;
    pageRegions.forEach((region) => { region.inert = true; });
    document.body.style.overflow = "hidden";
    const releasePage = () => {
      pageRegions.forEach((region) => { region.inert = false; });
      document.body.style.overflow = previousOverflow;
    };
    const frame = window.requestAnimationFrame(() => setVisible(true));
    const timeout = window.setTimeout(() => {
      setVisible(false);
      releasePage();
    }, reducedMotion ? 350 : 1350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      releasePage();
    };
  }, [reducedMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="intro-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.28 }}
          aria-hidden="true"
        >
          <div className="intro-field-lines" />
          <motion.div
            className="intro-wordmark-wrap"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.42 }}
          >
            <span className="intro-wordmark">AXB</span>
            <span className="intro-label">ARENA X1 BRASIL</span>
            <motion.span
              className="intro-shine"
              initial={{ x: "-140%" }}
              animate={{ x: "240%" }}
              transition={{ duration: reducedMotion ? 0 : 0.75, delay: 0.25 }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
