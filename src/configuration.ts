import type { RuleSetting, TextoicConfig } from "@textoic/enlint-lsp/config";
import { ConfigurationTarget, workspace } from "vscode";
import type { ExtensionSettings, RewriteProvider } from "./settings.js";

const section = () => workspace.getConfiguration("textoic");

export const readSettings = (): ExtensionSettings => {
  const config = section();
  return {
    enable: config.get("enable", true),
    languages: config.get("languages", ["markdown", "plaintext"]),
    extends: config.get("extends", "recommended"),
    locale: config.get("locale", "en-US"),
    rules: config.get("rules", {}),
    debounceMs: config.get("debounceMs", 750),
    rewrite: {
      provider: config.get<RewriteProvider>("rewrite.provider", "off"),
      model: config.get("rewrite.model", ""),
      ollamaUrl: config.get("rewrite.ollamaUrl", "http://127.0.0.1:11434"),
    },
  };
};

const userRules = (): Record<string, RuleSetting> =>
  section().inspect<Record<string, RuleSetting>>("rules")?.globalValue ?? {};

export const editUserRules = async (
  edit: (config: TextoicConfig) => TextoicConfig,
) => {
  const next = edit({ rules: userRules() });
  await section().update("rules", next.rules, ConfigurationTarget.Global);
};

export const setRewriteModel = (model: string) =>
  section().update("rewrite.model", model, ConfigurationTarget.Global);
