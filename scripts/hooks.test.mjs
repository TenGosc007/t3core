import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const { packageManager } = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const fixtures = [];

afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "t3core-hooks with spaces-"));
  fixtures.push(directory);
  const env = { ...process.env, LEFTHOOK: "1", CI: "true" };
  const git = (...args) => execFileSync("git", args, {
    cwd: directory,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  git("init", "-b", "main");
  git("config", "user.name", "Hook test");
  git("config", "user.email", "hook-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", path.join(directory, ".git/hooks"));
  mkdirSync(path.join(directory, "src"));
  writeFileSync(path.join(directory, "package.json"), JSON.stringify({
    name: "t3core-hooks-test", private: true, packageManager,
  }));
  symlinkSync(path.join(projectRoot, "node_modules"), path.join(directory, "node_modules"), "dir");
  for (const filename of ["lefthook.yml", "commitlint.config.mjs", "eslint.config.mts", "tsconfig.json"]) {
    copyFileSync(path.join(projectRoot, filename), path.join(directory, filename));
  }
  // The custom hooks path is owned by this temporary fixture.
  execFileSync(path.join(projectRoot, "node_modules/.bin/lefthook"), ["install", "--force"], {
    cwd: directory, env, stdio: "pipe",
  });

  const write = (filename, content) => writeFileSync(path.join(directory, filename), content);
  const stage = (filename, content) => {
    write(filename, content);
    git("add", "--", filename);
  };
  const commit = (message) => {
    const result = spawnSync("git", ["commit", "-m", message], {
      cwd: directory, env, encoding: "utf8", timeout: 20_000,
    });
    if (result.error) throw result.error;
    return { ...result, output: result.stdout + result.stderr };
  };
  return { directory, git, write, stage, commit };
}

test("pre-commit lints staged paths with spaces and leaves unstaged files alone", () => {
  const fixture = createFixture();
  const content = "export const staged = 1;\n";
  fixture.stage("src/staged file.ts", content);
  fixture.write("src/unstaged.ts", "this is invalid TypeScript !!!\n");
  const result = fixture.commit("fix: validate staged files");

  expect(result.status, result.output).toBe(0);
  expect(fixture.git("show", "HEAD:src/staged file.ts")).toBe(content.trim());
  expect(readFileSync(path.join(fixture.directory, "src/unstaged.ts"), "utf8"))
    .toBe("this is invalid TypeScript !!!\n");
}, 25_000);

test.each([
  ["fix: validate moves", 0],
  ["feat(api)!: replace session API", 0],
  ["Merge pull request #123 from example/branch", 1],
  ["update docs", 1],
])("CI validates the PR title %s without merge-message exemptions", (title, status) => {
  const result = spawnSync("yarn", ["commitlint:pr"], {
    cwd: projectRoot, input: title, encoding: "utf8", timeout: 10_000,
  });
  if (result.error) throw result.error;
  expect(result.status, result.stdout + result.stderr).toBe(status);
}, 15_000);

test("pre-commit rejects lint errors without changing the index", () => {
  const fixture = createFixture();
  const content = "const unused = 1;\n";
  fixture.stage("src/broken.ts", content);
  const result = fixture.commit("fix: reject broken code");

  expect(result.status, result.output).not.toBe(0);
  expect(result.output).toContain("@typescript-eslint/no-unused-vars");
  expect(fixture.git("show", ":src/broken.ts")).toBe(content.trim());
  expect(fixture.git("diff", "--cached", "--name-only")).toBe("src/broken.ts");
}, 25_000);

test("pre-commit accepts deleted files without passing missing paths to ESLint", () => {
  const fixture = createFixture();
  fixture.stage("src/removed.ts", "export const removed = 1;\n");
  const initial = fixture.commit("test: add a removable file");
  expect(initial.status, initial.output).toBe(0);
  unlinkSync(path.join(fixture.directory, "src/removed.ts"));
  fixture.git("add", "-u");

  const result = fixture.commit("refactor: remove obsolete file");
  expect(result.status, result.output).toBe(0);
  expect(fixture.git("ls-tree", "--name-only", "HEAD", "src/removed.ts")).toBe("");
}, 25_000);

test.each(["update docs", "unknown: update docs", "docs:"])(
  "commit-msg rejects %s even for documentation-only changes",
  (message) => {
    const fixture = createFixture();
    fixture.stage("README.md", "# Hook test\n");
    const result = fixture.commit(message);

    expect(result.status, result.output).not.toBe(0);
    expect(result.output).toContain("found");
    expect(fixture.git("diff", "--cached", "--name-only")).toBe("README.md");
  },
  25_000,
);

test.each([
  "docs: explain setup",
  "feat(api)!: replace session API\n\nBREAKING CHANGE: use start before playMove.",
  "chore: release v2.0.0",
])("commit-msg accepts %s", (message) => {
  const fixture = createFixture();
  fixture.stage("README.md", "# Hook test\n");
  const result = fixture.commit(message);

  expect(result.status, result.output).toBe(0);
  expect(fixture.git("log", "-1", "--format=%B")).toBe(message);
}, 25_000);
