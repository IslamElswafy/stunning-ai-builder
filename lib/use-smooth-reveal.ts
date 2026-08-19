"use client";

import { useEffect, useRef, useState } from "react";

import type { GenerationStatus } from "@/components/result-panel";

const MIN_THINKING_MS = 700;
const STREAM_CHARS_PER_FRAME = 8;
const DRAIN_CHARS_PER_FRAME = 16;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Holds the thinking skeleton for a beat, then reveals streamed text at a
 * steady cadence so large SSE chunks don't dump onto the page at once.
 */
export function useSmoothReveal(source: string, status: GenerationStatus) {
  const [revealed, setRevealed] = useState("");
  const revealedRef = useRef("");
  const sourceRef = useRef(source);
  const statusRef = useRef(status);
  const startedAtRef = useRef<number | null>(null);

  sourceRef.current = source;
  statusRef.current = status;

  useEffect(() => {
    if (status === "streaming") {
      if (startedAtRef.current === null) {
        startedAtRef.current = performance.now();
        revealedRef.current = "";
        setRevealed("");
      }
      return;
    }

    startedAtRef.current = null;

    if (status === "error" || status === "idle") {
      revealedRef.current = source;
      setRevealed(source);
    }
  }, [status, source]);

  useEffect(() => {
    if (status === "error" || status === "idle") return;

    if (prefersReducedMotion()) {
      revealedRef.current = source;
      setRevealed(source);
      return;
    }

    let frame = 0;

    const tick = () => {
      const target = sourceRef.current;
      const currentStatus = statusRef.current;
      const startedAt = startedAtRef.current;
      const elapsed =
        startedAt === null ? MIN_THINKING_MS : performance.now() - startedAt;
      const holdThinking =
        currentStatus === "streaming" && elapsed < MIN_THINKING_MS;

      let next = revealedRef.current;

      if (holdThinking) {
        next = "";
      } else if (next !== target) {
        const cap =
          currentStatus === "streaming"
            ? STREAM_CHARS_PER_FRAME
            : DRAIN_CHARS_PER_FRAME;
        const lag = target.length - next.length;
        const step = Math.min(cap, Math.max(2, Math.ceil(lag / 24)));
        next = target.slice(0, next.length + step);
      }

      if (next !== revealedRef.current) {
        revealedRef.current = next;
        setRevealed(next);
      }

      const catchingUp = next.length < sourceRef.current.length;
      const keepGoing =
        statusRef.current === "streaming" ||
        (statusRef.current === "done" && catchingUp);

      if (keepGoing) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [source, status]);

  const catchingUp = revealed.length < source.length;
  const isRevealing =
    status === "streaming" || (status === "done" && catchingUp);
  const showThinking = status === "streaming" && revealed.length === 0;

  return {
    revealed,
    showThinking,
    panelStatus: (isRevealing ? "streaming" : status) as GenerationStatus,
  };
}
