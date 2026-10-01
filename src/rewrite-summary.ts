type Judged = {
  original: string;
  replacement: string;
  accepted: boolean;
  reason?: string;
  before: unknown[];
  after: unknown[];
  costUsd?: number;
};

export type RewriteAllSummary<T> = { passed: T[]; message: string };

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const sumOf = <T extends Judged>(rewrites: T[], count: (item: T) => number) =>
  rewrites.reduce((total, item) => total + count(item), 0);

const costNote = (rewrites: Judged[]) => {
  const cost = sumOf(rewrites, ({ costUsd }) => costUsd ?? 0);
  return cost === 0 ? "" : ` It cost $${cost.toFixed(4)}.`;
};

const skippedNote = (rejected: Judged[]) =>
  rejected.length === 0
    ? ""
    : ` Skipped ${plural(rejected.length, "part")} whose rewrite did not pass (${rejected[0]?.reason ?? "unknown reason"}).`;

const changes = ({ accepted, replacement, original }: Judged) =>
  accepted && replacement !== original;

const nothingPassed = (rewrites: Judged[], rejected: Judged[]) =>
  rewrites.length === 0
    ? "Textoic found no issues to rewrite."
    : `No rewrite passed the check: ${rejected[0]?.reason ?? "the model changed nothing"}.${costNote(rewrites)}`;

export const rewriteAllSummary = <T extends Judged>(
  rewrites: T[],
): RewriteAllSummary<T> => {
  const passed = rewrites.filter(changes);
  const rejected = rewrites.filter(({ accepted }) => !accepted);
  if (passed.length === 0) {
    return { passed, message: nothingPassed(rewrites, rejected) };
  }

  const after = sumOf(passed, (item) => item.after.length);
  const left = after === 0 ? "" : ` ${plural(after, "problem")} left.`;
  return {
    passed,
    message: `Rewrote ${plural(passed.length, "part")}.${left}${skippedNote(rejected)}${costNote(rewrites)}`,
  };
};
