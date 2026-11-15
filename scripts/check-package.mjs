import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = path.join(projectRoot, "scripts/fixtures/package");
const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "t3core-package-")));

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: 120_000,
  });
}

try {
  // Pack the working tree with lifecycle scripts enabled: prepack must build it.
  run("npm", ["pack", "--loglevel=error", "--pack-destination", directory], projectRoot);
  const archives = readdirSync(directory).filter((filename) => filename.endsWith(".tgz"));
  assert.equal(archives.length, 1, "npm pack must create one archive");

  writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({ name: "t3core-package-consumer", private: true }),
  );
  // This consumer uses only the tarball and its runtime dependencies, never src aliases.
  run("npm", [
    "install", "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund",
    "--prefer-offline", "--loglevel=error", path.join(directory, archives[0]),
  ], directory);

  const installedRoot = path.join(directory, "node_modules/t3core");
  for (const filename of ["index.js", "index.mjs", "index.d.ts", "index.d.mts"]) {
    assert(existsSync(path.join(installedRoot, "dist", filename)), `Missing dist/${filename} in npm archive`);
  }
  const installedPackage = JSON.parse(readFileSync(path.join(installedRoot, "package.json"), "utf8"));
  assert.equal(installedPackage.types, "./dist/index.d.ts");

  for (const format of ["module", "commonjs"]) {
    const consumer = path.join(directory, format);
    mkdirSync(consumer);
    writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ type: format }));
    const source = path.join(consumer, "index.ts");
    copyFileSync(path.join(fixtureRoot, "consumer.ts"), source);
    const sources = [source];
    if (format === "commonjs") {
      const requireSource = path.join(consumer, "require.cts");
      copyFileSync(path.join(fixtureRoot, "require.cts"), requireSource);
      sources.push(requireSource);
    }

    const resolutions = format === "module" ? ["Node16", "NodeNext", "Bundler"] : ["Node16", "NodeNext"];
    for (const resolution of resolutions) {
      const outDir = path.join(consumer, resolution);
      const options = {
        target: ts.ScriptTarget.ES2020,
        module: resolution === "Bundler" ? ts.ModuleKind.ESNext : ts.ModuleKind[resolution],
        moduleResolution: ts.ModuleResolutionKind[resolution],
        strict: true,
        skipLibCheck: false,
        types: [],
        outDir,
        noEmitOnError: true,
      };
      const resolved = ts.resolveModuleName(
        "t3core", source, options, ts.sys, undefined, undefined,
        format === "module" ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
      ).resolvedModule;
      const expectedTypes = format === "module" ? "index.d.mts" : "index.d.ts";
      assert.equal(resolved?.resolvedFileName, path.join(installedRoot, "dist", expectedTypes));

      const program = ts.createProgram(sources, options);
      const diagnostics = ts.getPreEmitDiagnostics(program);
      assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => directory,
        getCanonicalFileName: (filename) => filename,
        getNewLine: () => "\n",
      }));
      assert.equal(program.emit().emitSkipped, false);
      run(process.execPath, [path.join(outDir, "index.js")], consumer);
      if (format === "commonjs") {
        run(process.execPath, [path.join(outDir, "require.cjs")], consumer);
      }
      console.log(`Package OK: ${format}, ${resolution}, ${expectedTypes}`);
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
