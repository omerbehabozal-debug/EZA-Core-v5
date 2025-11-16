"use client";

import { useEffect, useRef } from "react";

export function useScrollAnchor() {
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  return anchorRef;
}

