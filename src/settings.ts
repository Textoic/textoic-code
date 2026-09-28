import type {
  Preset,
  RuleSetting,
  TextoicConfig,
} from "@textoic/enlint-lsp/config";
import type { ClientSettings } from "@textoic/enlint-lsp/protocol";
import type { ProviderSettings } from "@textoic/enlint-lsp/rewrite";

export type RewriteProvider = "off" | "ollama" | "openrouter";

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
): ClientSettings => ({
  config: configOf(settings),
  debounceMs: settings.debounceMs,
  rewrite: settings.rewrite.provider !== "off",
});

export type DocumentFilter = { scheme: string; language: string };

export const documentSelectorOf = (languages: string[]): DocumentFilter[] =>
  languages.flatMap((language) => [
    { scheme: "file", language },
    { scheme: "untitled", language },
  ]);

export type ProviderChoice =
  | { ok: true; provider: ProviderSettings }
  | { ok: false; problem: string };

const refused = (problem: string): ProviderChoice => ({ ok: false, problem });

const ollamaChoice = ({ model, ollamaUrl }: ExtensionSettings["rewrite"]) =>
  model === ""
    ? refused("Choose an Ollama model for rewrites first.")
    : ({
        ok: true,
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
    : { ok: true, provider: { kind: "openrouter", model, apiKey } };
};

export const providerChoiceOf = (
  { rewrite }: ExtensionSettings,
  apiKey: string | undefined,
): ProviderChoice => {
  if (rewrite.provider === "off") {
    return refused(
      "AI rewrites are off. Pick Ollama or OpenRouter in the Textoic settings.",
    );
  }

  return rewrite.provider === "ollama"
    ? ollamaChoice(rewrite)
    : openRouterChoice(rewrite, apiKey);
};

export const needsRestart = (
  before: ExtensionSettings,
  after: ExtensionSettings,
) =>
  before.enable !== after.enable ||
  before.languages.join("\n") !== after.languages.join("\n");
