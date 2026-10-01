import {
  Methods,
  type ApplyAllArguments,
  type FixAllEdit,
  type FixAllResult,
} from "@textoic/enlint-lsp/protocol";
import {
  Range,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
  type ExtensionContext,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import {
  appliedMessage,
  modeChoicesFor,
  nothingToApply,
  type ModeChoice,
} from "./apply-all-model.js";
import { reportFailure } from "./commands.js";
import { readSettings } from "./configuration.js";
import { runRewriteAll } from "./rewrite-all.js";

const rangeOf = ({ range: { start, end } }: FixAllEdit) =>
  new Range(start.line, start.character, end.line, end.character);

const applyEdits = async (uri: string, edits: FixAllEdit[]) => {
  if (edits.length === 0) {
    return true;
  }

  const edit = new WorkspaceEdit();
  const target = Uri.parse(uri);
  edits.forEach((each) => edit.replace(target, rangeOf(each), each.newText));
  return workspace.applyEdit(edit);
};

const pickMode = async (
  label: string,
  { edits, remaining }: FixAllResult,
): Promise<ModeChoice | undefined> => {
  const rewriteOn = readSettings().rewrite.provider !== "off";
  const choices = modeChoicesFor(edits.length, remaining, rewriteOn);
  if (choices.length === 0) {
    await window.showInformationMessage(nothingToApply(label, remaining));
    return undefined;
  }

  return window.showQuickPick(choices, {
    title: `Apply all: ${label}`,
    placeHolder: `${edits.length + remaining} issues`,
  });
};

const runApplyAll = async (
  client: LanguageClient,
  context: ExtensionContext,
  { uri, scope, label, mode }: ApplyAllArguments,
) => {
  const fixes = await client.sendRequest<FixAllResult>(Methods.fixAll, {
    uri,
    scope,
  });
  const chosen = mode ?? (await pickMode(label, fixes))?.mode;
  if (chosen == null || !(await applyEdits(uri, fixes.edits))) {
    return;
  }

  if (chosen === "fixes" || fixes.remaining === 0) {
    await window.showInformationMessage(
      appliedMessage(fixes.edits.length, label),
    );
    return;
  }

  await runRewriteAll(client, context, uri, scope);
};

const activeFile = (): ApplyAllArguments | undefined => {
  const uri = window.activeTextEditor?.document.uri.toString();
  return uri == null ? undefined : { uri, scope: {}, label: "this file" };
};

export const applyAll =
  (client: LanguageClient, context: ExtensionContext) =>
  (args?: ApplyAllArguments) => {
    const target = args ?? activeFile();
    if (target != null) {
      runApplyAll(client, context, target).catch(reportFailure);
    }

    return Promise.resolve();
  };
