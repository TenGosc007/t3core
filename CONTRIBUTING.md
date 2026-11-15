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
```

Use `yarn test` for watch mode and `yarn test:coverage` to refresh the
coverage report. `yarn release:check` runs lint, TypeScript checks, tests
with coverage, Fallow, and the build in order, stopping on the first failure.

Release integration tests use temporary Git repositories and require Git
to be available. Their fixture commits and tags stay in those temporary
repositories.

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
