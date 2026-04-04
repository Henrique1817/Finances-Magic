"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { formatBRL } from "@/lib/formatBRL";

type Props = {
  value: number;
  /** Só anima após a carteira estar carregada do servidor. */
  ready: boolean;
  className?: string;
};

export function TotalValueCounter({ value, ready, className }: Props) {
  const [text, setText] = useState("—");
  const lastAnimated = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!ready) {
      setText("—");
      lastAnimated.current = null;
      return;
    }

    const from = lastAnimated.current ?? 0;
    const duration = lastAnimated.current === null ? 1.25 : 0.85;
    const proxy = { n: from };

    setText(formatBRL(from));

    const tween = gsap.to(proxy, {
      n: value,
      duration,
      ease: "power2.out",
      onUpdate: () => setText(formatBRL(proxy.n)),
      onComplete: () => {
        lastAnimated.current = value;
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, ready]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
