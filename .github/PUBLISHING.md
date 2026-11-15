# Publishing to npm

Publishing runs when a GitHub Release is published. The
[publish workflow](workflows/publish.yml) checks out the release tag and uses
[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) through
GitHub Actions OIDC. It does not require an npm token or a local npm login.

## One-time npm setup

An npm maintainer of `t3core` must configure the package's trusted publisher
before the first OIDC publication. This setting lives on npm and cannot be
enabled by committing a workflow file alone.

1. Sign in to [npmjs.com](https://www.npmjs.com) with an account that can manage `t3core`.
2. Open the package settings and find **Trusted Publisher**.
3. Choose **GitHub Actions** and enter the following values:

   | Field | Value |
   | --- | --- |
   | Organization or user | `TenGosc007` |
   | Repository | `t3core` |
   | Workflow filename | `publish.yml` |
   | Environment name | Leave empty; this workflow does not use a GitHub environment |

4. If the settings offer **Allowed actions**, allow direct publishing with `npm publish`.
5. Save the trusted publisher configuration.

The workflow grants `id-token: write` and `contents: read`. It reads the
Node.js version from [`.nvmrc`](../.nvmrc), enables the Yarn version selected
by Corepack, and installs npm 11. Trusted Publishing requires Node.js 22.14.0
or newer and npm 11.5.1 or newer. Provenance is enabled during publication.

`NPM_TOKEN` is no longer referenced by the workflow. Once the migration has
been verified, its obsolete GitHub Actions secret can be removed.

## Local release tooling

Releases use [release-it](https://github.com/release-it/release-it) with the
[Conventional Changelog plugin](https://github.com/release-it/conventional-changelog).
The configuration lives in [`.release-it.json`](../.release-it.json).
Use Node.js from [`.nvmrc`](../.nvmrc) and the Yarn version pinned in
[`package.json`](../package.json). The development setup is described in
[CONTRIBUTING.md](../CONTRIBUTING.md).

Merge the changes to be released into `main` before starting. Then update
your local `main` and install the locked dependencies:

```bash
git switch main
git pull --ff-only origin main
nvm install
nvm use
corepack enable
yarn install --frozen-lockfile
```

Releases require `main`, a clean working tree, an upstream branch, and
commits since the latest release tag. The release commit is pushed to
`origin/main`, so the maintainer must have permission to push it.

### GitHub release authentication

For automatic GitHub Release creation, make a GitHub personal access token
available locally as `GITHUB_TOKEN`. A fine-grained token needs access to
`TenGosc007/t3core` with **Contents: Read and write**. Git push continues to
use your configured Git credentials.

Without `GITHUB_TOKEN`, release-it opens a prefilled GitHub Release form.
Review it and select **Publish release** to start the npm workflow. This
fallback lets you use your existing GitHub browser session.

The GitHub token is separate from npm authentication: local release-it has
`npm.publish: false`, and npm publication uses OIDC in GitHub Actions.

## Preview and quality checks

```bash
# Display the proposed release steps without changing files or publishing
yarn release:preview major

# Execute all quality checks without creating a release
yarn release:check
```

The dry run displays hook commands without executing them. Use
`release:check` to actually run lint, TypeScript checks, tests with fresh
coverage, Fallow, and the package build. A normal release runs the same
checks through its `before:init` hook before changing the version or changelog.
A failed check stops the release.

## Create a stable release

```bash
# Use the recommendation from Conventional Commits and interactive prompts
yarn release

# Or choose an increment or exact version
yarn release patch
yarn release minor
yarn release major
yarn release 2.0.0
```

After the checks pass, release-it updates `package.json`, prepends generated
notes to [`CHANGELOG.md`](../CHANGELOG.md), creates a
`chore: release v<VERSION>` commit, creates the `v<VERSION>` tag, and pushes
the commit and tag. It then creates the GitHub Release using the generated
notes, or opens its prefilled form when no GitHub token is available.

Publishing that GitHub Release triggers the existing npm workflow.
Pushing the tag alone does not publish the package. The previous Bash
release script and manual release-branch preparation are replaced by this
flow; existing notes in [`releases/`](releases/) remain available as history.

### Conventional Commits

The plugin uses the `conventionalcommits` preset. Typical messages are:

| Commit message | Recommended version change |
| --- | --- |
| `fix: reject invalid move indices` | Patch |
| `feat: add a game variant` | Minor |
| `feat!: replace the session API` | Major |
| A commit with a `BREAKING CHANGE:` footer | Major |

Use these messages for the commits that reach `main`, including squash-merge
titles. Review the recommendation: older repository history contains
non-Conventional Commit messages, so an explicit increment may be needed.
Local commit-message enforcement remains a separate improvement.

## Create a prerelease

The same release command supports prereleases, including exact versions:

```bash
yarn release 2.0.0-beta.1
yarn release 2.0.0-rc.1
```

The version, changelog, and Git tag are prepared together. release-it marks
the GitHub Release as a prerelease based on the version.

The npm dist-tag is selected from the version in `package.json`:

| Package version | Required GitHub tag | npm dist-tag |
| --- | --- | --- |
| `2.0.0` | `v2.0.0` | `latest` |
| `2.0.0-beta.1` | `v2.0.0-beta.1` | `next` |
| `2.0.0-rc.1` | `v2.0.0-rc.1` | `next` |

The GitHub Release prerelease checkbox does not select the npm dist-tag.
Users install prereleases with `npm install t3core@next`.

## Workflow behavior

1. Check out the exact release tag.
2. Require the tag to equal `v` followed by the committed package version.
   A mismatch fails the workflow; it never rewrites `package.json`.
3. Check npm for that exact version. An existing version ends publication
   successfully. Only `E404` allows publication to proceed; registry,
   network, and authentication errors fail the workflow.
4. Install dependencies from the lockfile and run lint, TypeScript checks,
   tests, and the package build.
5. Publish through OIDC with provenance and the selected dist-tag.
   Lifecycle scripts are disabled for the publish command because the
   package has already been built and checked.

Publication runs share one concurrency group and do not cancel an active
publication. Retrying a successful publication skips an existing version;
it does not move npm dist-tags.

## Troubleshooting

- **Tag mismatch:** prepare a new release whose tag matches its committed
  `package.json`. The workflow does not infer or overwrite the version.
- **OIDC authentication fails:** check the npm trusted publisher values,
  especially the owner, repository, workflow filename, and empty environment.
  `npm whoami` on a developer machine does not test GitHub Actions OIDC.
- **Registry check fails:** resolve the reported network or registry error
  and rerun the failed workflow. An unsuccessful lookup is not treated as
  proof that a version is available.
- **Version already published:** the retry succeeds without publishing
  again. To release different code, prepare a new package version.
- **Local release stops on Git checks:** merge the implementation first,
  switch to an up-to-date `main`, and commit any intended local changes
  before starting the release.
- **Push rejected:** the release flow pushes its version/changelog commit
  and tag before creating the GitHub Release. Resolve the push failure
  using the repository's release permissions before publishing that release.
