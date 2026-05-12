"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Escape any ancestor that creates a transform/filter/will-change context,
// which traps position:fixed children (e.g. Framer Motion page wrapper in template.tsx).
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
