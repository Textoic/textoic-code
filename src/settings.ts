import type {
  Preset,
  RuleSetting,
  TextoicConfig,
} from "@textoic/enlint-lsp/config";
import type { IgnoredInstances } from "@textoic/enlint-lsp/issues";
import type { ClientSettings } from "@textoic/enlint-lsp/protocol";
import type { ProviderSettings } from "@textoic/enlint-lsp/rewrite";

export type RewriteProvider = "off" | "ollama" | "openrouter" | "vscode";

export type ExtensionSettings = {
  enable: boolean;
  languages: string[];
  extends: Preset;
  locale: string;
  rules: Record<string, RuleSetting>;
  debounceMs: number;
  rewrite: { provider: RewriteProvider; model: string; ollamaUrl: string };
};

export type { ClientSettings };

export const configOf = (settings: ExtensionSettings): TextoicConfig => ({
  extends: settings.extends,
  locale: settings.locale,
  rules: settings.rules,
});

export const clientSettingsOf = (
  settings: ExtensionSettings,
  ignoredInstances?: IgnoredInstances,
): ClientSettings => ({
  config: configOf(settings),
  debounceMs: settings.debounceMs,
  rewrite: settings.rewrite.provider !== "off",
  ...(ignoredInstances == null ? {} : { ignoredInstances }),
});

export type DocumentFilter = { scheme: string; language: string };

export const documentSelectorOf = (languages: string[]): DocumentFilter[] =>
  languages.flatMap((language) => [
    { scheme: "file", language },
    { scheme: "untitled", language },
  ]);

export type ProviderChoice =
  | { ok: true; route: "server"; provider: ProviderSettings }
  | { ok: true; route: "vscode"; model: string }
  | { ok: false; problem: string };

const refused = (problem: string): ProviderChoice => ({ ok: false, problem });

const ollamaChoice = ({ model, ollamaUrl }: ExtensionSettings["rewrite"]) =>
  model === ""
    ? refused("Choose an Ollama model for rewrites first.")
    : ({
        ok: true,
        route: "server",
        provider: { kind: "ollama", model, baseUrl: ollamaUrl },
      } as const);

const openRouterChoice = (
  { model }: ExtensionSettings["rewrite"],
  apiKey: string | undefined,
): ProviderChoice => {
  if (apiKey == null || apiKey.trim() === "") {
    return refused("Set your OpenRouter API key first.");
  }

  return model === ""
    ? refused("Choose an OpenRouter model for rewrites first.")
    : {
        ok: true,
        route: "server",
        provider: { kind: "openrouter", model, apiKey },
      };
};

const vscodeChoice = ({ model }: ExtensionSettings["rewrite"]) =>
  ({ ok: true, route: "vscode", model }) as const;

export const providerChoiceOf = (
  { rewrite }: ExtensionSettings,
  apiKey: string | undefined,
): ProviderChoice => {
  const choices: Record<RewriteProvider, () => ProviderChoice> = {
    off: () =>
      refused(
        "AI rewrites are off. Pick VS Code, Ollama or OpenRouter in the Textoic settings.",
      ),
    ollama: () => ollamaChoice(rewrite),
    openrouter: () => openRouterChoice(rewrite, apiKey),
    vscode: () => vscodeChoice(rewrite),
  };
  return choices[rewrite.provider]();
};

export const needsRestart = (
  before: ExtensionSettings,
  after: ExtensionSettings,
) =>
  before.enable !== after.enable ||
  before.languages.join("\n") !== after.languages.join("\n");
