"use client";

import { motion } from "framer-motion";
import { Gauge, MoveHorizontal, MoveVertical, Zap } from "lucide-react";
import Image from "next/image";
import { categories } from "@/data/arena";

function formatRange(min: number, max: number, type: "range" | "max") {
  if (type === "max") return `até ${max}`;
  return min === max ? `${min}` : `${min} a ${max}`;
}

export function CategoryComparison() {
  return (
    <div className="category-comparison-wrap">
      <div className="category-technical-grid">
        {categories.map((category, index) => (
          <motion.article
            key={category.id}
            className={`category-tech-card category-tech-card--${index + 1}`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ delay: index * 0.08 }}
          >
            <div className="category-tech-card__index">0{index + 1}</div>
            <div className="category-tech-card__head">
              <span>Categoria oficial</span>
              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </div>
            <div className="category-attributes">
              <div>
                <span><MoveVertical size={16} /> Altura</span>
                <strong>{formatRange(category.limits.height.min, category.limits.height.max, "range")}</strong>
                <i style={{ "--value": `${Math.max(category.limits.height.max, 0) * 10}%` } as React.CSSProperties} />
              </div>
              <div>
                <span><MoveHorizontal size={16} /> Largura</span>
                <strong>{formatRange(category.limits.width.min, category.limits.width.max, "range")}</strong>
                <i style={{ "--value": `${Math.max(category.limits.width.max, 0) * 10}%` } as React.CSSProperties} />
              </div>
              <div>
                <span><Zap size={16} /> Impulso</span>
                <strong>{formatRange(category.limits.boost.min, category.limits.boost.max, "max")}</strong>
                <i style={{ "--value": `${category.limits.boost.max * 10}%` } as React.CSSProperties} />
              </div>
            </div>
            <div className="category-tech-card__note">
              <Gauge size={16} aria-hidden="true" /> Outros atributos são livres
            </div>
          </motion.article>
        ))}
      </div>
      <div className="category-player-visual" aria-hidden="true">
        <span>PLAYER SPECS</span>
        <Image
          src="/images/player-yellow.png"
          alt=""
          width={666}
          height={375}
          className="category-player-visual__image"
        />
      </div>
    </div>
  );
}
