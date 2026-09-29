import { withRewrites } from "@textoic/enlint-lsp/rewrite";
import {
  commands,
  TabInputTextDiff,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
  type Disposable,
  type Range,
  type TextDocument,
} from "vscode";

export type PassageEdit = {
  range: Range;
  original: string;
  replacement: string;
};

export type Proposal = { uri: Uri; edits: PassageEdit[] };

const scheme = "textoic-rewrite";
const proposals = new Map<string, string>();
let opened = 0;

export const registerRewritePreview = (): Disposable =>
  workspace.registerTextDocumentContentProvider(scheme, {
    provideTextDocumentContent: (uri) => proposals.get(uri.toString()) ?? "",
  });

const previewUriOf = (uri: Uri) => {
  opened += 1;
  return Uri.from({ scheme, path: uri.path, query: String(opened) });
};

const proposedText = (document: TextDocument, { edits }: Proposal) =>
  withRewrites(
    document.getText(),
    edits.map(({ range, replacement }) => ({
      start: document.offsetAt(range.start),
      end: document.offsetAt(range.end),
      replacement,
    })),
  );

const nameOf = (uri: Uri) => uri.path.split("/").pop() ?? uri.path;

const openDiff = async (proposal: Proposal, document: TextDocument) => {
  const preview = previewUriOf(proposal.uri);
  proposals.set(preview.toString(), proposedText(document, proposal));
  await commands.executeCommand(
    "vscode.diff",
    proposal.uri,
    preview,
    `${nameOf(proposal.uri)} ↔ Textoic rewrite`,
    { preview: true },
  );
  return preview;
};

const isDiffOf =
  (preview: Uri) =>
  ({ input }: { input: unknown }) =>
    input instanceof TabInputTextDiff &&
    input.modified.toString() === preview.toString();

const closeDiff = async (preview: Uri) => {
  const tabs = window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(isDiffOf(preview));
  await window.tabGroups.close(tabs);
  proposals.delete(preview.toString());
};

const isStale = (document: TextDocument, { edits }: Proposal) =>
  edits.some(({ range, original }) => document.getText(range) !== original);

const staleWarning =
  "The text changed while the rewrite was running. Ask for a new one.";

const applyProposal = async ({ uri, edits }: Proposal) => {
  const edit = new WorkspaceEdit();
  edits.forEach(({ range, replacement }) => {
    edit.replace(uri, range, replacement);
  });
  if (!(await workspace.applyEdit(edit))) {
    await window.showWarningMessage("VS Code refused the rewrite edit.");
  }
};

export const offerRewrite = async (proposal: Proposal, note: string) => {
  const document = await workspace.openTextDocument(proposal.uri);
  if (isStale(document, proposal)) {
    await window.showWarningMessage(staleWarning);
    return;
  }

  const preview = await openDiff(proposal, document);
  const choice = await window.showInformationMessage(
    `${note} Apply the rewrite?`,
    "Apply",
    "Discard",
  );
  await closeDiff(preview);
  if (choice !== "Apply") {
    return;
  }

  if (isStale(document, proposal)) {
    await window.showWarningMessage(staleWarning);
    return;
  }

  await applyProposal(proposal);
};
