import { copyFile, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
const watching = process.argv.includes("--watch");
const requireFromServer = createRequire(
  join(root, "node_modules", "@textoic", "enlint-lsp", "package.json"),
);
const artisanData = dirname(
  requireFromServer.resolve("@textoic/artisan/dictionary.json"),
);

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "warning",
};

const extension = {
  ...shared,
  entryPoints: [join(root, "src", "extension.ts")],
  outfile: join(out, "extension.js"),
  format: "cjs",
  external: ["vscode"],
};

const server = {
  ...shared,
  entryPoints: [
    join(
      root,
      "node_modules",
      "@textoic",
      "enlint-lsp",
      "dist",
      "node",
      "cli.js",
    ),
  ],
  outfile: join(out, "server.mjs"),
  format: "esm",
  banner: {
    js: "import { createRequire as __textoicRequire } from 'node:module'; const require = __textoicRequire(import.meta.url);",
  },
};

const copyParserData = async () => {
  await mkdir(join(out, "data"), { recursive: true });
  await Promise.all(
    ["dictionary.json", "weights.json"].map((name) =>
      copyFile(join(artisanData, name), join(out, "data", name)),
    ),
  );
};

await rm(out, { recursive: true, force: true });
await copyParserData();

if (watching) {
  await Promise.all(
    [extension, server].map(async (options) =>
      (await context(options)).watch(),
    ),
  );
} else {
  await Promise.all([build(extension), build(server)]);
  process.stdout.write(`Built the extension and the server into ${out}\n`);
}
