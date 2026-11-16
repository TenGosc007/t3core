import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const releaseBin = path.join(projectRoot, "node_modules/release-it/bin/release-it.js");
const { packageManager } = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const fixtures = [];

afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createFixture(message = "fix: reject invalid moves") {
  const directory = mkdtempSync(path.join(tmpdir(), "t3core-release-"));
  fixtures.push(directory);

  const git = (...args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

  git("init", "-b", "main");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");
  git("config", "core.hooksPath", path.join(directory, ".git/no-hooks"));
  git("init", "--bare", path.join(directory, ".git/remote.git"));
  git("remote", "add", "origin", path.join(directory, ".git/remote.git"));

  const config = JSON.parse(readFileSync(path.join(projectRoot, ".release-it.json"), "utf8"));
  config.git.push = false;
  config.git.requireUpstream = false;
  config.github.release = false;

  writeFileSync(path.join(directory, ".release-it.json"), JSON.stringify(config));
  writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "t3core-release-test",
      version: "1.0.0",
      packageManager,
      scripts: {
        "release:check": 'node -e "process.exit(process.env.RELEASE_TEST_FAIL === \'1\' ? 1 : 0)"',
      },
    }),
  );
  writeFileSync(path.join(directory, "CHANGELOG.md"), "# Changelog\n\nHistorical release notes.\n");
  writeFileSync(path.join(directory, ".gitignore"), "node_modules/\n");
  symlinkSync(path.join(projectRoot, "node_modules"), path.join(directory, "node_modules"), "dir");
  git("add", ".");
  git("commit", "-m", "chore: initial release");
  git("tag", "v1.0.0");
  git("commit", "--allow-empty", "-m", message);

  const run = (args = [], environment = {}) => {
    const result = spawnSync(process.execPath, [releaseBin, "--ci", ...args], {
      cwd: directory,
      env: {
        ...process.env,
        GITHUB_TOKEN: "",
        GH_TOKEN: "",
        NPM_TOKEN: "",
        NODE_AUTH_TOKEN: "",
        RELEASE_TEST_FAIL: "0",
        ...environment,
      },
      encoding: "utf8",
      timeout: 20_000,
    });
    if (result.error) throw result.error;
    return result;
  };

  const read = (filename) => readFileSync(path.join(directory, filename), "utf8");
  return { directory, git, run, read };
}

test.each([
  ["fix: reject invalid moves", "1.0.1", "reject invalid moves"],
  ["feat: add a new game variant", "1.1.0", "add a new game variant"],
  ["feat!: replace the session API", "2.0.0", "replace the session API"],
])("releases Conventional Commit %s as %s", (message, version, description) => {
  const fixture = createFixture(message);
  const result = fixture.run();

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(fixture.read("package.json")).version).toBe(version);
  expect(fixture.read("CHANGELOG.md")).toContain(description);
  expect(fixture.read("CHANGELOG.md")).toContain("Historical release notes.");
  expect(fixture.git("log", "-1", "--format=%s")).toBe(`chore: release v${version}`);
  expect(JSON.parse(fixture.git("show", `v${version}:package.json`)).version).toBe(version);
  expect(fixture.git("status", "--porcelain")).toBe("");
}, 15_000);

test("prepares an explicit prerelease with a matching version and tag", () => {
  const fixture = createFixture("feat: add a new game variant");
  const result = fixture.run(["2.0.0-beta.1"]);

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(fixture.read("package.json")).version).toBe("2.0.0-beta.1");
  expect(fixture.read("CHANGELOG.md")).toContain("2.0.0-beta.1");
  expect(fixture.git("tag", "--list", "v2.0.0-beta.1")).toBe("v2.0.0-beta.1");
}, 15_000);

test("stops before changing files or tagging when quality checks fail", () => {
  const fixture = createFixture();
  const originalHead = fixture.git("rev-parse", "HEAD");
  const originalPackage = fixture.read("package.json");
  const originalChangelog = fixture.read("CHANGELOG.md");
  const result = fixture.run([], { RELEASE_TEST_FAIL: "1" });

  expect(result.status).not.toBe(0);
  expect(fixture.git("rev-parse", "HEAD")).toBe(originalHead);
  expect(fixture.read("package.json")).toBe(originalPackage);
  expect(fixture.read("CHANGELOG.md")).toBe(originalChangelog);
  expect(fixture.git("tag", "--list")).toBe("v1.0.0");
}, 15_000);

test("rejects releases outside main", () => {
  const fixture = createFixture();
  fixture.git("checkout", "-b", "feature/test");
  const result = fixture.run();

  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain("Must be on branch main");
  expect(JSON.parse(fixture.read("package.json")).version).toBe("1.0.0");
  expect(fixture.git("tag", "--list")).toBe("v1.0.0");
}, 15_000);

test("rejects uncommitted changes before bumping the version", () => {
  const fixture = createFixture();
  writeFileSync(path.join(fixture.directory, "CHANGELOG.md"), "Uncommitted changes\n");
  const result = fixture.run();

  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain("Working dir must be clean");
  expect(fixture.read("CHANGELOG.md")).toBe("Uncommitted changes\n");
  expect(JSON.parse(fixture.read("package.json")).version).toBe("1.0.0");
  expect(fixture.git("tag", "--list")).toBe("v1.0.0");
}, 15_000);

test("previews a release without changing files, commits, or tags", () => {
  const fixture = createFixture();
  const originalHead = fixture.git("rev-parse", "HEAD");
  const originalChangelog = fixture.read("CHANGELOG.md");
  const result = fixture.run(["--dry-run"]);

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(fixture.git("rev-parse", "HEAD")).toBe(originalHead);
  expect(JSON.parse(fixture.read("package.json")).version).toBe("1.0.0");
  expect(fixture.read("CHANGELOG.md")).toBe(originalChangelog);
  expect(fixture.git("tag", "--list")).toBe("v1.0.0");
}, 15_000);
