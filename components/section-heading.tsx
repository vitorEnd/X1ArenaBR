"use client";

import { motion } from "framer-motion";

type SectionHeadingProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div className={`section-heading section-heading--${align}`}>
      <motion.p
        className="section-kicker"
        initial={{ opacity: 0, x: -14 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.7 }}
      >
        {eyebrow}
      </motion.p>
      <div className="title-mask">
        <motion.h2
          className="section-title"
          initial={{ y: "105%" }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        >
          {title}
        </motion.h2>
      </div>
      {description && (
        <motion.p
          className="section-lead"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay: 0.12 }}
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
