import {
  withIgnoredCase,
  withoutIgnoredCase,
  withSeverity,
} from "@textoic/enlint-lsp/config";
import {
  Methods,
  type DisableRuleArguments,
  type IgnoreCaseArguments,
  type RewriteArguments,
  type RewriteResult,
} from "@textoic/enlint-lsp/protocol";
import { listModels } from "@textoic/enlint-lsp/rewrite";
import {
  ProgressLocation,
  Range,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
  type ExtensionContext,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import {
  editUserRules,
  readSettings,
  setRewriteModel,
} from "./configuration.js";
import { providerChoiceOf } from "./settings.js";

const secretKey = "textoic.openrouterKey";

const tell = (
  show: (message: string) => Thenable<unknown>,
  message: string,
) => {
  show(message).then(
    () => undefined,
    () => undefined,
  );
};

export const ignoreCase = async ({ rule, case: key }: IgnoreCaseArguments) => {
  await editUserRules((config) => withIgnoredCase(config, rule, key));
  const undo = await window.showInformationMessage(
    `Textoic will no longer flag "${key}" (${rule}).`,
    "Undo",
  );
  if (undo === "Undo") {
    await editUserRules((config) => withoutIgnoredCase(config, rule, key));
  }
};

export const disableRule = async ({ rule }: DisableRuleArguments) => {
  await editUserRules((config) => withSeverity(config, rule, "off"));
  const undo = await window.showInformationMessage(
    `Textoic turned off ${rule} in your user settings.`,
    "Undo",
  );
  if (undo === "Undo") {
    await editUserRules((config) => withSeverity(config, rule, "warn"));
  }
};

const requestRewrite = async (
  client: LanguageClient,
  context: ExtensionContext,
  { uri, range }: RewriteArguments,
): Promise<RewriteResult | undefined> => {
  const settings = readSettings();
  const choice = providerChoiceOf(
    settings,
    await context.secrets.get(secretKey),
  );
  if (!choice.ok) {
    tell(window.showWarningMessage, choice.problem);
    return undefined;
  }

  return window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Rewriting with ${settings.rewrite.model}…`,
    },
    () =>
      client.sendRequest<RewriteResult>(Methods.rewrite, {
        uri,
        range,
        provider: choice.provider,
      }),
  );
};

const costNote = ({ costUsd }: RewriteResult) =>
  costUsd == null || costUsd === 0 ? "" : ` It cost $${costUsd.toFixed(4)}.`;

const confirmRejected = async (result: RewriteResult) =>
  (await window.showWarningMessage(
    `The rewrite did not pass: ${result.reason ?? "unknown reason"}.${costNote(result)}`,
    "Preview anyway",
  )) === "Preview anyway";

const previewEdit = async (uri: string, result: RewriteResult) => {
  const edit = new WorkspaceEdit();
  const { start, end } = result.range;
  edit.replace(
    Uri.parse(uri),
    new Range(start.line, start.character, end.line, end.character),
    result.replacement,
    { needsConfirmation: true, label: "Textoic rewrite" },
  );
  await workspace.applyEdit(edit);
};

const problemsNote = ({ before, after }: RewriteResult) =>
  `Problems in the passage: ${before.length} before, ${after.length} after.`;

export const rewrite =
  (client: LanguageClient, context: ExtensionContext) =>
  async (args: RewriteArguments) => {
    const result = await requestRewrite(client, context, args).catch(
      (cause: unknown) => {
        tell(
          window.showErrorMessage,
          `Textoic rewrite failed: ${String(cause)}`,
        );
        return undefined;
      },
    );
    if (result == null) {
      return;
    }

    if (!result.accepted && !(await confirmRejected(result))) {
      return;
    }

    window.setStatusBarMessage(
      `${problemsNote(result)}${costNote(result)}`,
      8000,
    );
    await previewEdit(args.uri, result);
  };

export const rewriteSelection =
  (client: LanguageClient, context: ExtensionContext) => async () => {
    const editor = window.activeTextEditor;
    if (editor == null) {
      return;
    }

    const { start, end } = editor.selection;
    await rewrite(
      client,
      context,
    )({
      uri: editor.document.uri.toString(),
      range: { start, end },
    });
  };

export const setOpenRouterKey = (context: ExtensionContext) => async () => {
  const key = await window.showInputBox({
    title: "OpenRouter API key",
    prompt: "Stored in VS Code's secret storage, never in settings.",
    password: true,
    ignoreFocusOut: true,
  });
  if (key != null) {
    await context.secrets.store(secretKey, key.trim());
  }
};

export const chooseModel = async () => {
  const { rewrite: rewriteSettings } = readSettings();
  if (rewriteSettings.provider === "off") {
    tell(
      window.showWarningMessage,
      "Pick Ollama or OpenRouter in the Textoic settings first.",
    );
    return;
  }

  const models = await listModels({
    kind: rewriteSettings.provider,
    baseUrl:
      rewriteSettings.provider === "ollama"
        ? rewriteSettings.ollamaUrl
        : undefined,
  }).catch((cause: unknown) => {
    tell(window.showErrorMessage, `Could not list models: ${String(cause)}`);
    return [];
  });
  const model = await window.showQuickPick(models, {
    title: `Rewrite model (${rewriteSettings.provider})`,
  });
  if (model != null) {
    await setRewriteModel(model);
  }
};

export const relint = (client: LanguageClient) => async () => {
  const editor = window.activeTextEditor;
  if (editor != null) {
    await client.sendRequest(Methods.relint, {
      uri: editor.document.uri.toString(),
    });
  }
};
