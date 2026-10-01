import { Commands } from "@textoic/enlint-lsp/protocol";
import {
  commands,
  workspace,
  type Disposable,
  type ExtensionContext,
} from "vscode";
import {
  DidChangeConfigurationNotification,
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";
import {
  chooseModel,
  disableRule,
  ignoreCase,
  ignoreInstance,
  relint,
  restoreIgnoredInstances,
  rewrite,
  rewriteSelection,
  setOpenRouterKey,
} from "./commands.js";
import { applyAll } from "./apply-all.js";
import { readSettings } from "./configuration.js";
import { IgnoredInstanceStore } from "./ignored-instances.js";
import { registerIssuesView } from "./issues-view.js";
import { registerRewritePreview } from "./rewrite-preview.js";
import { rewriteAll } from "./rewrite-all.js";
import { manageRules } from "./rules-manager.js";
import {
  clientSettingsOf,
  documentSelectorOf,
  needsRestart,
  type ExtensionSettings,
} from "./settings.js";

const serverOptions = (context: ExtensionContext): ServerOptions => {
  const run = {
    module: context.asAbsolutePath("dist/server.mjs"),
    transport: TransportKind.stdio,
    args: ["--data", context.asAbsolutePath("dist/data")],
  };
  return { run, debug: run };
};

let instances: IgnoredInstanceStore | undefined;

const clientSettingsNow = (settings: ExtensionSettings) =>
  clientSettingsOf(settings, instances?.all());

const clientOptions = (settings: ExtensionSettings): LanguageClientOptions => ({
  documentSelector: documentSelectorOf(settings.languages),
  initializationOptions: clientSettingsNow(settings),
  synchronize: {
    fileEvents: workspace.createFileSystemWatcher(
      "**/{textoic.config.json,.textoicrc.json}",
    ),
  },
});

let client: LanguageClient | undefined;

const startClient = async (context: ExtensionContext) => {
  const settings = readSettings();
  if (!settings.enable) {
    return;
  }

  client = new LanguageClient(
    "textoic",
    "Textoic",
    serverOptions(context),
    clientOptions(settings),
  );
  await client.start();
};

const stopClient = async () => {
  const running = client;
  client = undefined;
  await running?.stop();
};

const pushSettings = async (settings: ExtensionSettings) => {
  await client?.sendNotification(DidChangeConfigurationNotification.type, {
    settings: { textoic: clientSettingsNow(settings) },
  });
};

const onSettingsChange = (context: ExtensionContext): Disposable => {
  let previous = readSettings();
  return workspace.onDidChangeConfiguration(async (event) => {
    if (!event.affectsConfiguration("textoic")) {
      return;
    }

    const next = readSettings();
    const restart = needsRestart(previous, next);
    previous = next;
    if (restart) {
      await stopClient();
      await startClient(context);
      return;
    }

    await pushSettings(next);
  });
};

const withClient =
  <T>(run: (active: LanguageClient) => (argument: T) => Promise<void>) =>
  async (argument: T) => {
    if (client != null) {
      await run(client)(argument);
    }
  };

const registerCommands = (
  context: ExtensionContext,
  store: IgnoredInstanceStore,
): Disposable[] => [
  commands.registerCommand(Commands.ignoreCase, ignoreCase),
  commands.registerCommand(Commands.ignoreInstance, ignoreInstance(store)),
  commands.registerCommand(
    "textoic.restoreIgnoredInstances",
    restoreIgnoredInstances(store),
  ),
  commands.registerCommand(Commands.disableRule, disableRule),
  commands.registerCommand(
    Commands.rewrite,
    withClient((active) => rewrite(active, context)),
  ),
  commands.registerCommand(
    Commands.rewriteAll,
    withClient((active) => rewriteAll(active, context)),
  ),
  commands.registerCommand(
    Commands.applyAll,
    withClient((active) => applyAll(active, context)),
  ),
  commands.registerCommand(
    "textoic.rewriteSelection",
    withClient((active) => rewriteSelection(active, context)),
  ),
  commands.registerCommand("textoic.relint", withClient(relint)),
  commands.registerCommand("textoic.manageRules", manageRules),
  commands.registerCommand(
    "textoic.setOpenRouterKey",
    setOpenRouterKey(context),
  ),
  commands.registerCommand("textoic.chooseModel", chooseModel),
  commands.registerCommand("textoic.restart", async () => {
    await stopClient();
    await startClient(context);
  }),
];

export const activate = async (context: ExtensionContext) => {
  const store = new IgnoredInstanceStore(context.workspaceState);
  instances = store;
  context.subscriptions.push(
    ...registerCommands(context, store),
    ...registerIssuesView(context.workspaceState),
    store.onDidChange(() => pushSettings(readSettings())),
    registerRewritePreview(),
    onSettingsChange(context),
  );
  await startClient(context);
};

export const deactivate = () => stopClient();
