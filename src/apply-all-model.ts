import type { ApplyAllMode } from "@textoic/enlint-lsp/fixes";

export type ModeChoice = {
  mode: ApplyAllMode;
  label: string;
  detail: string;
};

const plural = (count: number, word: string, many = `${word}s`) =>
  `${count} ${count === 1 ? word : many}`;

const fixesOnly = (fixes: number): ModeChoice => ({
  mode: "fixes",
  label: "Fixes only",
  detail: `Apply ${plural(fixes, "exact fix", "exact fixes")} now. No AI; undo with Ctrl+Z.`,
});

const fixesAndRewrites = (fixes: number, remaining: number): ModeChoice => ({
  mode: "fixesAndRewrites",
  label: "Fixes, then AI rewrites",
  detail: `Apply ${plural(fixes, "fix", "fixes")}, then rewrite the parts with the other ${plural(remaining, "issue")} and preview them.`,
});

export const modeChoicesFor = (
  fixes: number,
  remaining: number,
  rewriteOn: boolean,
): ModeChoice[] => [
  ...(fixes > 0 ? [fixesOnly(fixes)] : []),
  ...(rewriteOn && remaining > 0 ? [fixesAndRewrites(fixes, remaining)] : []),
];

export const nothingToApply = (label: string, remaining: number) =>
  remaining === 0
    ? `Textoic found nothing to apply in ${label}.`
    : `No rule has an exact fix for the ${plural(remaining, "issue")} in ${label}. Set textoic.rewrite.provider to rewrite them with AI.`;

export const appliedMessage = (fixes: number, label: string) =>
  `Applied ${plural(fixes, "fix", "fixes")} in ${label}.`;
