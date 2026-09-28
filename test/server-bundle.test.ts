import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";

const dist = (path: string) =>
  fileURLToPath(new URL(`../dist/${path}`, import.meta.url));

type Published = { uri: string; diagnostics: { code?: string }[] };

describe(
  "bundled server",
  { skip: !existsSync(dist("server.mjs")) && "run npm run build first" },
  () => {
    it("starts over stdio with the bundled data and lints a document", async () => {
      const child = spawn(process.execPath, [
        dist("server.mjs"),
        "--stdio",
        "--data",
        dist("data"),
      ]);
      const connection = createMessageConnection(
        new StreamMessageReader(child.stdout),
        new StreamMessageWriter(child.stdin),
      );
      const published = new Promise<Published>((resolve) => {
        connection.onNotification("textDocument/publishDiagnostics", resolve);
      });
      connection.listen();
      await connection.sendRequest("initialize", {
        processId: null,
        rootUri: null,
        capabilities: {},
        initializationOptions: { config: { rules: { "no-similes": "off" } } },
      });
      await connection.sendNotification("initialized", {});
      await connection.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri: "untitled:Untitled-1",
          languageId: "markdown",
          version: 1,
          text: "We should delve into the data.",
        },
      });
      const { diagnostics } = await published;
      assert.deepEqual(
        diagnostics.map(({ code }) => code),
        ["no-bad-words"],
      );
      connection.dispose();
      child.kill();
    });
  },
);
