import {
  casesOf,
  ruleCatalog,
  type RuleCase,
  type RuleInfo,
} from "@textoic/enlint/catalog";
import {
  ignoredCasesIn,
  resolveConfig,
  withSeverity,
  type Severity,
  type TextoicConfig,
} from "@textoic/enlint-lsp/config";
import { window, type QuickPickItem } from "vscode";
import { editUserRules, readSettings } from "./configuration.js";
import { configOf } from "./settings.js";

type RulePick = QuickPickItem & { rule: RuleInfo };
type SeverityPick = QuickPickItem & { severity: Severity | "cases" };
type CasePick = QuickPickItem & { key: string };

const severities: Severity[] = ["off", "hint", "info", "warn", "error"];

const currentSeverity = (config: TextoicConfig, rule: RuleInfo): Severity =>
  resolveConfig(config).rules[rule.id]?.severity ?? "off";

const examplesOf = (rule: RuleInfo) =>
  rule.examples
    .map(({ text, suggestion }) =>
      suggestion == null ? `“${text}”` : `“${text}” → ${suggestion}`,
    )
    .join("   ");

const rulePicks = (config: TextoicConfig): RulePick[] =>
  ruleCatalog.map((rule) => ({
    label: rule.name,
    description: `${rule.id} · ${currentSeverity(config, rule)}`,
    detail: `${rule.summary} ${examplesOf(rule)}`,
    rule,
  }));

const severityPicks = (
  rule: RuleInfo,
  config: TextoicConfig,
): SeverityPick[] => [
  ...severities.map((severity) => ({
    label: severity,
    description: currentSeverity(config, rule) === severity ? "current" : "",
    severity,
  })),
  ...(rule.hasCases
    ? [
        {
          label: "Choose ignored cases…",
          description: `${ignoredCasesIn(config, rule.id).length} ignored`,
          severity: "cases" as const,
        },
      ]
    : []),
];

const casePick =
  (ignored: string[]) =>
  ({ key, label, suggestions, group }: RuleCase): CasePick => ({
    label,
    description: `→ ${suggestions.join(", ")}`,
    detail: group,
    picked: ignored.includes(key),
    key,
  });

const chooseIgnoredCases = async (rule: RuleInfo) => {
  const ignored = ignoredCasesIn({ rules: readSettings().rules }, rule.id);
  const chosen = await window.showQuickPick(
    casesOf(rule.id).map(casePick(ignored)),
    {
      canPickMany: true,
      matchOnDescription: true,
      title: `${rule.name}: tick the cases to ignore`,
    },
  );
  if (chosen == null) {
    return;
  }

  await editUserRules((config) => {
    const severity = currentSeverity(config, rule);
    return {
      rules: {
        ...config.rules,
        [rule.id]: [severity, { ignore: chosen.map(({ key }) => key) }],
      },
    };
  });
};

const applyChoice = async (rule: RuleInfo, choice: SeverityPick) => {
  if (choice.severity === "cases") {
    await chooseIgnoredCases(rule);
    return;
  }

  const { severity } = choice;
  await editUserRules((config) => withSeverity(config, rule.id, severity));
};

export const manageRules = async () => {
  const config = configOf(readSettings());
  const picked = await window.showQuickPick(rulePicks(config), {
    title: "Textoic rules",
    matchOnDetail: true,
    placeHolder: "Pick a rule to change its severity or its ignored cases",
  });
  if (picked == null) {
    return;
  }

  const choice = await window.showQuickPick(
    severityPicks(picked.rule, config),
    {
      title: `${picked.rule.name}: ${picked.rule.description}`,
    },
  );
  if (choice != null) {
    await applyChoice(picked.rule, choice);
  }
};
