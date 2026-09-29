import {
  withIgnoredCase,
  withoutIgnoredCase,
  withSeverity,
} from "@textoic/enlint-lsp/config";
import {
  Methods,
  type DisableRuleArguments,
  type IgnoreCaseArguments,
  type IgnoreInstanceArguments,
  type LintTextResult,
  type RewriteArguments,
  type RewriteResult,
} from "@textoic/enlint-lsp/protocol";
import {
  listModels,
  rewritePassage,
  type ProviderSettings,
} from "@textoic/enlint-lsp/rewrite";
import {
  CancellationError,
  Position,
  ProgressLocation,
  Range,
  Uri,
  window,
  workspace,
  type CancellationToken,
  type ExtensionContext,
  type TextDocument,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import {
  editUserRules,
  readSettings,
  setRewriteModel,
} from "./configuration.js";
import type { IgnoredInstance } from "@textoic/enlint-lsp/issues";
import type { IgnoredInstanceStore } from "./ignored-instances.js";
import {
  availableModels,
  languageModelCompletion,
  modelFor,
} from "./language-model.js";
import { offerRewrite } from "./rewrite-preview.js";
import { providerChoiceOf, type ProviderChoice } from "./settings.js";

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

const isCancellation = (cause: unknown) =>
  cause instanceof CancellationError ||
  (cause as { code?: number }).code === -32800 ||
  (cause as { name?: string }).name === "AbortError";

export const reportFailure = (cause: unknown) => {
  if (!isCancellation(cause)) {
    tell(window.showErrorMessage, `Textoic rewrite failed: ${String(cause)}`);
  }
};

const serverRewrite = (
  client: LanguageClient,
  args: RewriteArguments,
  provider: ProviderSettings,
  token: CancellationToken,
) =>
  client.sendRequest<RewriteResult>(
    Methods.rewrite,
    { ...args, provider },
    token,
  );

const asPosition = ({ line, character }: RewriteArguments["range"]["start"]) =>
  new Position(line, character);

export const asLspRange = (range: Range): RewriteResult["range"] => ({
  start: { line: range.start.line, character: range.start.character },
  end: { line: range.end.line, character: range.end.character },
});

export const serverLint =
  (client: LanguageClient, document: TextDocument, token: CancellationToken) =>
  async (text: string) =>
    (
      await client.sendRequest<LintTextResult>(
        Methods.lintText,
        { text, uri: document.uri.toString(), languageId: document.languageId },
        token,
      )
    ).problems;

export const noModel =
  "VS Code has no language model to use. Sign in to GitHub Copilot, or add a model provider in the Chat view.";

const languageModelRewrite = async (
  client: LanguageClient,
  args: RewriteArguments,
  modelId: string,
  token: CancellationToken,
): Promise<RewriteResult | undefined> => {
  const model = await modelFor(modelId);
  if (model == null) {
    tell(window.showWarningMessage, noModel);
    return undefined;
  }

  const document = await workspace.openTextDocument(Uri.parse(args.uri));
  const lint = serverLint(client, document, token);
  const result = await rewritePassage(
    {
      text: document.getText(),
      start: document.offsetAt(asPosition(args.range.start)),
      end: document.offsetAt(asPosition(args.range.end)),
    },
    { complete: languageModelCompletion(model, token), lint },
  );
  const range = new Range(
    document.positionAt(result.start),
    document.positionAt(result.end),
  );
  return { ...result, range: asLspRange(range) };
};

export const modelLabel = (choice: ProviderChoice) =>
  choice.ok && choice.route === "server"
    ? choice.provider.model
    : "the VS Code language model";

const rewriteWith = (
  client: LanguageClient,
  args: RewriteArguments,
  choice: Extract<ProviderChoice, { ok: true }>,
) =>
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Rewriting with ${modelLabel(choice)}…`,
      cancellable: true,
    },
    (_progress, token) =>
      choice.route === "vscode"
        ? languageModelRewrite(client, args, choice.model, token)
        : serverRewrite(client, args, choice.provider, token),
  );

const costNote = ({ costUsd }: RewriteResult) =>
  costUsd == null || costUsd === 0 ? "" : ` It cost $${costUsd.toFixed(4)}.`;

const confirmRejected = async (result: RewriteResult) =>
  (await window.showWarningMessage(
    `The rewrite did not pass: ${result.reason ?? "unknown reason"}.${costNote(result)}`,
    "Preview anyway",
  )) === "Preview anyway";

const rangeOf = ({ start, end }: RewriteResult["range"]) =>
  new Range(start.line, start.character, end.line, end.character);

export const passageEditOf = (result: RewriteResult) => ({
  range: rangeOf(result.range),
  original: result.original,
  replacement: result.replacement,
});

const problemsNote = ({ before, after }: RewriteResult) =>
  `Problems in the passage: ${before.length} before, ${after.length} after.`;

const present = async (uri: string, result: RewriteResult) => {
  if (!result.accepted && !(await confirmRejected(result))) {
    return;
  }

  await offerRewrite(
    { uri: Uri.parse(uri), edits: [passageEditOf(result)] },
    `${problemsNote(result)}${costNote(result)}`,
  );
};

export type ReadyChoice = Extract<ProviderChoice, { ok: true }>;

export const readyChoice = async (
  context: ExtensionContext,
): Promise<ReadyChoice | undefined> => {
  const settings = readSettings();
  const apiKey =
    settings.rewrite.provider === "openrouter"
      ? await context.secrets.get(secretKey)
      : undefined;
  const choice = providerChoiceOf(settings, apiKey);
  if (!choice.ok) {
    tell(window.showWarningMessage, choice.problem);
    return undefined;
  }

  return choice;
};

const runRewrite = async (
  client: LanguageClient,
  context: ExtensionContext,
  args: RewriteArguments,
) => {
  const choice = await readyChoice(context);
  if (choice == null) {
    return;
  }

  const result = await rewriteWith(client, args, choice);
  if (result != null) {
    await present(args.uri, result);
  }
};

export const rewrite =
  (client: LanguageClient, context: ExtensionContext) =>
  (args: RewriteArguments) => {
    runRewrite(client, context, args).catch(reportFailure);
    return Promise.resolve();
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

const chooseLanguageModel = async () => {
  const models = await availableModels();
  if (models.length === 0) {
    tell(window.showWarningMessage, noModel);
    return;
  }

  const picked = await window.showQuickPick(
    models.map((model) => ({
      label: model.name,
      description: `${model.vendor} · ${model.id}`,
      id: model.id,
    })),
    { title: "Rewrite model (VS Code)" },
  );
  if (picked != null) {
    await setRewriteModel(picked.id);
  }
};

export const chooseModel = async () => {
  const { rewrite: rewriteSettings } = readSettings();
  if (rewriteSettings.provider === "off") {
    tell(
      window.showWarningMessage,
      "Pick VS Code, Ollama or OpenRouter in the Textoic settings first.",
    );
    return;
  }

  if (rewriteSettings.provider === "vscode") {
    await chooseLanguageModel();
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

const quoteNote = ({ quote }: IgnoredInstance) => `“${quote}”`;

export const ignoreInstance =
  (store: IgnoredInstanceStore) =>
  async ({ uri, instance }: IgnoreInstanceArguments) => {
    await store.add(uri, instance);
    const undo = await window.showInformationMessage(
      `Textoic will no longer flag ${quoteNote(instance)} in that sentence of this file.`,
      "Undo",
    );
    if (undo === "Undo") {
      await store.remove(uri, instance);
    }
  };

export const restoreIgnoredInstances =
  (store: IgnoredInstanceStore) => async () => {
    const uri = window.activeTextEditor?.document.uri.toString();
    if (uri == null) {
      return;
    }

    const count = store.of(uri).length;
    await store.clear(uri);
    tell(
      window.showInformationMessage,
      count === 0
        ? "This file has no ignored instances."
        : `Textoic flags the ${count} ignored instance${count === 1 ? "" : "s"} in this file again.`,
    );
  };
