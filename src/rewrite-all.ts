import {
  Methods,
  type RewriteAllArguments,
  type RewriteAllResult,
  type RewriteProgressParams,
  type RewriteResult,
} from "@textoic/enlint-lsp/protocol";
import {
  rewriteDocument,
  type ProviderSettings,
  type RewriteProgress,
} from "@textoic/enlint-lsp/rewrite";
import {
  ProgressLocation,
  Range,
  Uri,
  window,
  workspace,
  type CancellationToken,
  type ExtensionContext,
  type Progress,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import {
  asLspRange,
  modelLabel,
  noModel,
  passageEditOf,
  readyChoice,
  reportFailure,
  serverLint,
  type ReadyChoice,
} from "./commands.js";
import { languageModelCompletion, modelFor } from "./language-model.js";
import { offerRewrite } from "./rewrite-preview.js";
import { rewriteAllSummary } from "./rewrite-summary.js";

type Reporter = Progress<{ message?: string; increment?: number }>;

const reportTo = (progress: Reporter) => {
  let reported = 0;
  return ({ done, total }: RewriteProgress) => {
    const percent = total === 0 ? 100 : (done / total) * 100;
    progress.report({
      message: `${done} of ${total} paragraphs`,
      increment: percent - reported,
    });
    reported = percent;
  };
};

const serverRewriteAll = async (
  client: LanguageClient,
  uri: string,
  provider: ProviderSettings,
  {
    token,
    onProgress,
  }: {
    token: CancellationToken;
    onProgress: (progress: RewriteProgress) => void;
  },
) => {
  const listening = client.onNotification(
    Methods.rewriteProgress,
    (params: RewriteProgressParams) => {
      if (params.uri === uri) {
        onProgress(params);
      }
    },
  );
  try {
    const { rewrites } = await client.sendRequest<RewriteAllResult>(
      Methods.rewriteAll,
      { uri, provider },
      token,
    );
    return rewrites;
  } finally {
    listening.dispose();
  }
};

const languageModelRewriteAll = async (
  client: LanguageClient,
  uri: string,
  modelId: string,
  {
    token,
    onProgress,
  }: {
    token: CancellationToken;
    onProgress: (progress: RewriteProgress) => void;
  },
): Promise<RewriteResult[] | undefined> => {
  const model = await modelFor(modelId);
  if (model == null) {
    await window.showWarningMessage(noModel);
    return undefined;
  }

  const document = await workspace.openTextDocument(Uri.parse(uri));
  const rewrites = await rewriteDocument(document.getText(), {
    complete: languageModelCompletion(model, token),
    lint: serverLint(client, document, token),
    concurrency: 2,
    onProgress,
  });
  return rewrites.map((result) => ({
    ...result,
    range: asLspRange(
      new Range(
        document.positionAt(result.start),
        document.positionAt(result.end),
      ),
    ),
  }));
};

const rewriteAllWith = (
  client: LanguageClient,
  uri: string,
  choice: ReadyChoice,
) =>
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Rewriting all issues with ${modelLabel(choice)}`,
      cancellable: true,
    },
    (progress, token) => {
      const run = { token, onProgress: reportTo(progress) };
      return choice.route === "vscode"
        ? languageModelRewriteAll(client, uri, choice.model, run)
        : serverRewriteAll(client, uri, choice.provider, run);
    },
  );

const present = async (uri: string, rewrites: RewriteResult[]) => {
  const summary = rewriteAllSummary(rewrites);
  if (summary.passed.length === 0) {
    await window.showWarningMessage(summary.message);
    return;
  }

  await offerRewrite(
    { uri: Uri.parse(uri), edits: summary.passed.map(passageEditOf) },
    summary.message,
  );
};

const runRewriteAll = async (
  client: LanguageClient,
  context: ExtensionContext,
  uri: string,
) => {
  const choice = await readyChoice(context);
  if (choice == null) {
    return;
  }

  const rewrites = await rewriteAllWith(client, uri, choice);
  if (rewrites != null) {
    await present(uri, rewrites);
  }
};

const activeUri = () => window.activeTextEditor?.document.uri.toString();

export const rewriteAll =
  (client: LanguageClient, context: ExtensionContext) =>
  (args?: RewriteAllArguments) => {
    const uri = args?.uri ?? activeUri();
    if (uri != null) {
      runRewriteAll(client, context, uri).catch(reportFailure);
    }

    return Promise.resolve();
  };
