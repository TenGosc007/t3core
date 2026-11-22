# Contributing to t3core

Read [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries, state and event
contracts, AI strategies, and session cancellation. Automated coding agents
also follow [AGENTS.md](AGENTS.md).

## Development environment

Use the versions pinned in the repository:

| Tool | Version | Source of truth |
| --- | --- | --- |
| Node.js | `22.23.5` | [`.nvmrc`](.nvmrc) |
| Yarn Classic | `1.22.22` | `packageManager` in [`package.json`](package.json) |

The development tools, including release-it, require a newer Node.js than
the published library. CI and the publication workflow read `.nvmrc` and
enable Corepack so Yarn follows the version in `packageManager`.

With [nvm](https://github.com/nvm-sh/nvm) installed, run these commands from
the repository root:

```bash
nvm install
nvm use
corepack enable
yarn --version
yarn install --frozen-lockfile
yarn hooks:install
```

`nvm install` and `nvm use` read `.nvmrc`. Corepack is included with the
pinned Node.js distribution and selects Yarn `1.22.22` for this project.
The `yarn --version` command should print `1.22.22`.

The project keeps its existing Yarn Classic lockfile. Use Yarn for dependency
changes and commit `yarn.lock` together with the corresponding `package.json`
changes. Migrating to Yarn 4 is outside this environment setup.

## Editor settings and GitHub templates

[`.editorconfig`](.editorconfig) defines UTF-8, LF line endings, two-space
indentation, a final newline, and trimming of trailing whitespace. Markdown
retains trailing spaces because two spaces can represent an intentional
line break. Enable EditorConfig support in your editor to apply these settings.

Use the [bug report form](.github/ISSUE_TEMPLATE/bug_report.yml) for a
reproducible problem and include the installed package version, environment,
minimal reproduction, and expected/actual behavior. The
[feature request form](.github/ISSUE_TEMPLATE/feature_request.yml) asks for
the use case, proposed API, alternatives, and compatibility concerns.

The [pull request template](.github/PULL_REQUEST_TEMPLATE.md) covers user
impact, compatibility and migration, verification results, and documentation
updates. Mark checks you ran and explain skipped ones; use a Conventional
Commit PR title as described below. In Claude Code, the
[`/pr-description`](.claude/skills/pr-description/SKILL.md) skill drafts the
title and an English description from this template for the current branch
as Markdown to copy into GitHub (`/pr-description [base] [--run-checks]`).

## Local Git checks and commit messages

[`lefthook.yml`](lefthook.yml) configures two local hooks:

| Hook | Check |
| --- | --- |
| `pre-commit` | ESLint for staged JavaScript/TypeScript paths, including module extensions. Deleted paths are skipped. |
| `commit-msg` | Commitlint with [`commitlint.config.mjs`](commitlint.config.mjs), using Conventional Commits. |

Lefthook's development dependency normally installs the hooks during a local
dependency install. Run `yarn hooks:install` to ensure they are installed,
including after an install with scripts disabled. No project `prepare` or
install-time build hook is required. Published-package consumers do not
install these development dependencies.

The lint hook does not auto-fix files or change the Git index. It lints the
working-tree versions of staged paths, so a partially staged file is checked
with its unstaged edits too. Keep commits focused and use `yarn lint` for a
full check. Hook installation does not reset an existing `core.hooksPath`;
if you use another hook manager, reconcile that local setup before installing.

Use `type(scope): description`, with optional scope and `!` for a breaking
change. Examples:

```text
fix(game): reject invalid board indices
docs: explain session reset
feat(api)!: replace the session API
chore: release v2.0.0
```

Supported types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
`refactor`, `revert`, `style`, and `test`. Use a lowercase initial word in
the description, omit its trailing period, and keep the header within
100 characters. The conventional preset also checks body/footer formatting.
Describe required migrations in a `BREAKING CHANGE:` footer when applicable;
see the [API change checklist](#public-api-and-compatibility).

CI still runs the complete lint, type, package, and test checks independently
of local hooks. On pull requests it also checks the PR title with commitlint,
including after title edits; use a Conventional Commit title and preserve it
when squash merging. CI disables commitlint's default merge-message ignores
for PR titles through [the PR configuration](commitlint-pr.config.mjs). It
does not validate the repository's historical commit range.
Local commit hooks keep the preset's normal ignores for Git-generated merges
and reverts. To check a proposed PR title manually:

```bash
printf '%s\n' 'fix(game): reject invalid board indices' | yarn commitlint:pr
```

## Verify changes

```bash
yarn lint
yarn ts:check
yarn test --run
yarn build
yarn package:check
```

Use `yarn test` for watch mode and `yarn test:coverage` to refresh the
coverage report. `yarn release:check` runs lint, TypeScript checks, tests
with coverage, Fallow, and the package check in order, stopping on the first failure.

`yarn package:check` creates an npm tarball (building through `prepack`),
installs it in a temporary consumer project, and checks both types and runtime
behavior for ESM and CommonJS. It checks Node16 and NodeNext resolution for
both formats, Bundler resolution for ESM, and TypeScript's CommonJS
`import = require` syntax. Declaration checking uses `skipLibCheck: false`.
It also verifies ISC license metadata and that the installed archive contains
the complete [LICENSE](LICENSE) text from the repository.
The check needs npm and registry access to install runtime dependencies;
it removes its temporary project and tarball afterwards. CI, publication,
and `release:check` run this check automatically.
Consumer fixtures in `scripts/fixtures` run in the temporary project rather
than Vitest, so they are excluded from Fallow's source health analysis.

TypeScript enables `noUncheckedIndexedAccess`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `noUnusedLocals`, and `noUnusedParameters`
in addition to `strict`. Check that an indexed value exists before using it;
fix the underlying issue instead of adding a type assertion or `!`.
The unused-code checks also run during compilation. ESLint retains its
existing unused-variable rules for editor feedback and naming conventions;
prefix intentionally unused callback parameters with `_`.

Release and hook integration tests use temporary Git repositories and require
Git to be available. Hook tests install Lefthook and create commits there to
check accepted/rejected messages and staged-file handling. Their fixture
commits and release tags stay in those temporary repositories.

For documentation-only changes, check claims against the implementation,
verify relative links and examples, and run `git diff --check`. Code checks
are needed when the change also modifies behavior, types, or configuration.

## Public API and compatibility

Use this checklist for changes to exported values or types, behavior,
defaults, events, snapshot semantics, and session lifecycle:

1. Update the implementation and its JSDoc. Add intended public exports to
   `src/index.ts`; preserve existing imports and mode-specific facade types
   unless the change is deliberately incompatible.
2. Add regression tests for changed behavior. Update public API tests and
   package consumer fixtures when exports, declarations, or supported
   import patterns change. Run `yarn package:check` for those changes.
3. Update the relevant API description and examples in [README.md](README.md)
   in the same change. Update [ARCHITECTURE.md](ARCHITECTURE.md) when module
   responsibilities, dependency direction, or documented contracts change.
4. For an incompatible change, include migration instructions in the relevant
   README section or a linked migration note in the same change. State who
   is affected, show the previous and replacement usage, and list required
   steps, including changed defaults or lifecycle handling. Keep historical
   release notes as a record of earlier behavior.
5. Use Conventional Commits for changes that reach `main`. Mark incompatible
   changes with `!` or a `BREAKING CHANGE:` footer and describe the required
   migration. The release tooling generates [CHANGELOG.md](CHANGELOG.md)
   from commit messages; release preparation sets the version. See
   [Publishing to npm](.github/PUBLISHING.md#conventional-commits).

Write code comments and new developer documentation in English; preserve
the language and formatting of existing documents. Public consumers import
from `t3core`; implementation modules should use their owning modules rather
than importing the package root back into the library.

## Package output

The build produces `dist/index.mjs` with `dist/index.d.mts` for ESM and
`dist/index.js` with `dist/index.d.ts` for CommonJS. The `import` and `require`
conditions in `exports` select the corresponding declarations first, then
the runtime entry. The top-level `types` field remains a fallback for older
TypeScript resolution.

`npm pack` and `npm publish` build through `prepack` so a missing or stale
`dist` is refreshed before packaging. There is no `prepare` hook: installing
the published package uses the included build and does not require developer
tools. Git checkouts need dependencies installed and `yarn build` before use.
The publication workflow uses `--ignore-scripts` only after the package check
has built and verified the artifacts.

## Library consumers and maintainers

The published package declares **Node.js >=16.0.0** in `engines.node`.
That declaration describes consumers of the built library. The pinned
Node.js and Yarn versions above describe contributors, CI, and release
tooling; consumers do not need to install this project's development tools.

To update the development environment, change `.nvmrc` or `packageManager`
as appropriate, update this guide, and verify installation and the quality
checks with those versions. Both workflows follow `.nvmrc` automatically.
The publication workflow separately installs npm 11 for Trusted Publishing.

See [Publishing to npm](.github/PUBLISHING.md) for release preparation,
GitHub authentication, prereleases, and OIDC publication.
