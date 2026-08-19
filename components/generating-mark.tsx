type Props = {
  /** White marks on the accent button, or accent marks on the dark panel. */
  tone: "on-accent" | "accent";
};

/**
 * Three-bar activity mark. Replaces the old spinner / pulsing dot so generate
 * and the result header share one slow, ease-in-out motion.
 */
export function GeneratingMark({ tone }: Props) {
  return (
    <span aria-hidden="true" className={`gen-eq gen-eq-${tone}`}>
      <span />
      <span />
      <span />
    </span>
  );
}
