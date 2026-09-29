import { ruleCatalog } from "@textoic/enlint/catalog";
import {
  groupedByRule,
  overlapping,
  type IssueGroup,
} from "@textoic/enlint-lsp/issues";

export type IssueMode = "inView" | "byType";

export type Issue = {
  rule: string;
  case?: string;
  message: string;
  quote: string;
  start: number;
  end: number;
};

export type Span = { start: number; end: number };

const ruleNames = new Map<string, string>(
  ruleCatalog.map(({ id, name }) => [id, name]),
);

export const ruleNameOf = (rule: string) => ruleNames.get(rule) ?? rule;

const byPosition = (one: Issue, other: Issue) =>
  one.start - other.start || one.end - other.end;

export const issuesInView = (issues: Issue[], visible: Span[]) =>
  visible
    .flatMap((span) => overlapping(issues, span))
    .filter((issue, index, all) => all.indexOf(issue) === index)
    .sort(byPosition);

export const issueGroupsOf = (issues: Issue[]): IssueGroup<Issue>[] =>
  groupedByRule([...issues].sort(byPosition), ruleNameOf);

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export const emptyMessageOf = (
  mode: IssueMode,
  total: number,
  shown: number,
) => {
  if (total === 0) {
    return "No issues in this file.";
  }

  return mode === "inView" && shown === 0
    ? `No issues in view. ${plural(total, "issue")} elsewhere in the file.`
    : undefined;
};
