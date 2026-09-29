import { instanceOf } from "@textoic/enlint-lsp/issues";
import {
  Commands,
  diagnosticSource,
  type DiagnosticData,
} from "@textoic/enlint-lsp/protocol";
import {
  commands,
  EventEmitter,
  languages,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
  type Diagnostic,
  type Disposable,
  type Memento,
  type Range,
  type TextDocument,
  type TextEditor,
  type TreeDataProvider,
  type TreeView,
} from "vscode";
import {
  emptyMessageOf,
  issueGroupsOf,
  issuesInView,
  ruleNameOf,
  type Issue,
  type IssueMode,
} from "./issue-model.js";

export const issuesViewId = "textoic.issues";

const modeKey = "textoic.issuesMode";

type Located = Issue & { uri: string; range: Range };

type GroupNode = { kind: "group"; rule: string; issues: Located[] };

type IssueNode = { kind: "issue"; issue: Located };

type Node = GroupNode | IssueNode;

const isOurs = (diagnostic: Diagnostic) =>
  diagnostic.source === diagnosticSource;

const dataOf = (diagnostic: Diagnostic) =>
  (diagnostic as Diagnostic & { data?: DiagnosticData }).data;

const codeOf = ({ code }: Diagnostic) =>
  typeof code === "object" ? String(code.value) : String(code ?? "");

const locatedIn =
  (document: TextDocument) =>
  (diagnostic: Diagnostic): Located => {
    const data = dataOf(diagnostic);
    return {
      rule: data?.rule ?? codeOf(diagnostic),
      ...(data?.case == null ? {} : { case: data.case }),
      message: diagnostic.message,
      quote: document.getText(diagnostic.range),
      start: document.offsetAt(diagnostic.range.start),
      end: document.offsetAt(diagnostic.range.end),
      uri: document.uri.toString(),
      range: diagnostic.range,
    };
  };

const issuesOf = (document: TextDocument) =>
  languages
    .getDiagnostics(document.uri)
    .filter(isOurs)
    .map(locatedIn(document));

const visibleSpansOf = ({ document, visibleRanges }: TextEditor) =>
  visibleRanges.map((range) => ({
    start: document.offsetAt(range.start),
    end: document.offsetAt(range.end),
  }));

const groupItem = ({ rule, issues }: GroupNode) => {
  const item = new TreeItem(
    ruleNameOf(rule),
    TreeItemCollapsibleState.Expanded,
  );
  item.description = String(issues.length);
  item.tooltip = `${issues.length} × ${rule}`;
  item.contextValue = "group";
  return item;
};

const issueItem = (issue: Located, mode: IssueMode, node: IssueNode) => {
  const item = new TreeItem(`“${issue.quote.replace(/\s+/gu, " ")}”`);
  item.description =
    mode === "inView"
      ? ruleNameOf(issue.rule)
      : `line ${issue.range.start.line + 1}`;
  item.tooltip = issue.message;
  item.contextValue = issue.case == null ? "issue" : "issue.case";
  item.command = {
    command: "textoic.issues.reveal",
    title: "Show",
    arguments: [node],
  };
  return item;
};

export class IssuesView implements TreeDataProvider<Node>, Disposable {
  private readonly changes = new EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changes.event;
  readonly view: TreeView<Node>;
  private mode: IssueMode;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly state: Memento) {
    this.mode = state.get<IssueMode>(modeKey, "inView");
    this.view = window.createTreeView(issuesViewId, {
      treeDataProvider: this,
      showCollapseAll: true,
    });
    commands
      .executeCommand("setContext", modeKey, this.mode)
      .then(undefined, () => undefined);
  }

  async setMode(mode: IssueMode) {
    this.mode = mode;
    await this.state.update(modeKey, mode);
    await commands.executeCommand("setContext", modeKey, mode);
    this.refresh();
  }

  refresh() {
    this.changes.fire(undefined);
  }

  refreshSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 150);
  }

  getTreeItem(node: Node): TreeItem {
    return node.kind === "group"
      ? groupItem(node)
      : issueItem(node.issue, this.mode, node);
  }

  getChildren(node?: Node): Node[] {
    if (node?.kind === "group") {
      return node.issues.map((issue) => ({ kind: "issue", issue }));
    }

    return node == null ? this.roots() : [];
  }

  dispose() {
    clearTimeout(this.timer);
    this.view.dispose();
    this.changes.dispose();
  }

  private roots(): Node[] {
    const editor = window.activeTextEditor;
    const all = editor == null ? [] : issuesOf(editor.document);
    const nodes = editor == null ? [] : this.nodesOf(editor, all);
    this.describe(all.length, nodes.length, editor != null);
    return nodes;
  }

  private nodesOf(editor: TextEditor, all: Located[]): Node[] {
    if (this.mode === "byType") {
      return issueGroupsOf(all).map(({ rule, issues }) => ({
        kind: "group",
        rule,
        issues: issues as Located[],
      }));
    }

    return (issuesInView(all, visibleSpansOf(editor)) as Located[]).map(
      (issue) => ({ kind: "issue", issue }),
    );
  }

  private describe(total: number, shown: number, hasEditor: boolean) {
    this.view.message = hasEditor
      ? emptyMessageOf(this.mode, total, shown)
      : "Open a file to see its issues.";
    this.view.badge =
      total === 0
        ? undefined
        : { value: total, tooltip: `${total} Textoic issues in this file` };
  }
}

const issueOf = (node: Node) =>
  node.kind === "issue" ? node.issue : undefined;

const reveal = async (node: Node) => {
  const issue = issueOf(node);
  if (issue != null) {
    await window.showTextDocument(Uri.parse(issue.uri), {
      selection: issue.range,
    });
  }
};

const lspRangeOf = ({ start, end }: Range) => ({
  start: { line: start.line, character: start.character },
  end: { line: end.line, character: end.character },
});

const rewriteIssue = async (node: Node) => {
  const issue = issueOf(node);
  if (issue != null) {
    await commands.executeCommand(Commands.rewrite, {
      uri: issue.uri,
      range: lspRangeOf(issue.range),
    });
  }
};

const ignoreInstance = async (node: Node) => {
  const issue = issueOf(node);
  const document = window.activeTextEditor?.document;
  if (issue != null && document != null) {
    await commands.executeCommand(Commands.ignoreInstance, {
      uri: issue.uri,
      instance: instanceOf(document.getText(), { ...issue, id: issue.rule }),
    });
  }
};

const ignoreCase = async (node: Node) => {
  const issue = issueOf(node);
  if (issue?.case != null) {
    await commands.executeCommand(Commands.ignoreCase, {
      rule: issue.rule,
      case: issue.case,
    });
  }
};

const ruleOf = (node: Node) =>
  node.kind === "group" ? node.rule : node.issue.rule;

const disableRule = (node: Node) =>
  commands.executeCommand(Commands.disableRule, { rule: ruleOf(node) });

const toggle = (view: IssuesView) => () =>
  view.view.visible
    ? commands.executeCommand("workbench.action.closeAuxiliaryBar")
    : commands.executeCommand(`${issuesViewId}.focus`);

const listen = (view: IssuesView): Disposable[] => [
  languages.onDidChangeDiagnostics(() => view.refreshSoon()),
  window.onDidChangeActiveTextEditor(() => view.refresh()),
  window.onDidChangeTextEditorVisibleRanges(() => view.refreshSoon()),
];

export const registerIssuesView = (state: Memento): Disposable[] => {
  const view = new IssuesView(state);
  return [
    view,
    ...listen(view),
    commands.registerCommand("textoic.issues.showInView", () =>
      view.setMode("inView"),
    ),
    commands.registerCommand("textoic.issues.showByType", () =>
      view.setMode("byType"),
    ),
    commands.registerCommand("textoic.issues.toggle", toggle(view)),
    commands.registerCommand("textoic.issues.reveal", reveal),
    commands.registerCommand("textoic.issues.rewrite", rewriteIssue),
    commands.registerCommand("textoic.issues.ignoreInstance", ignoreInstance),
    commands.registerCommand("textoic.issues.ignoreCase", ignoreCase),
    commands.registerCommand("textoic.issues.disableRule", disableRule),
  ];
};
