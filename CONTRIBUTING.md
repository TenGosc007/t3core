# Contributing to t3core

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
```

`nvm install` and `nvm use` read `.nvmrc`. Corepack is included with the
pinned Node.js distribution and selects Yarn `1.22.22` for this project.
The `yarn --version` command should print `1.22.22`.

The project keeps its existing Yarn Classic lockfile. Use Yarn for dependency
changes and commit `yarn.lock` together with the corresponding `package.json`
changes. Migrating to Yarn 4 is outside this environment setup.

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

Release integration tests use temporary Git repositories and require Git
to be available. Their fixture commits and tags stay in those temporary
repositories.

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
