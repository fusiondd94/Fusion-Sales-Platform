"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealTag = "div" | "article" | "aside" | "section";

export function Reveal({
  as = "div",
  children,
  className = "",
  delayMs = 0
}: {
  as?: RevealTag;
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const classes = ["reveal", visible ? "is-visible" : "", className].filter(Boolean).join(" ");
  const style = delayMs ? { transitionDelay: `${delayMs}ms` } : undefined;

  if (as === "article") {
    return (
      <article ref={ref} className={classes} style={style}>
        {children}
      </article>
    );
  }
  if (as === "aside") {
    return (
      <aside ref={ref} className={classes} style={style}>
        {children}
      </aside>
    );
  }
  if (as === "section") {
    return (
      <section ref={ref} className={classes} style={style}>
        {children}
      </section>
    );
  }
  return (
    <div ref={ref} className={classes} style={style}>
      {children}
    </div>
  );
}
