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

The workflow grants `id-token: write` and `contents: read`. It uses Node.js 22
and installs npm 11. Trusted Publishing requires Node.js 22.14.0 or newer and
npm 11.5.1 or newer. Provenance is enabled during publication.

`NPM_TOKEN` is no longer referenced by the workflow. Once the migration has
been verified, its obsolete GitHub Actions secret can be removed.

## Prepare a stable release

Use the existing release script:

```bash
# Interactive version selection
yarn release

# Or select a stable version directly
yarn release patch
yarn release minor
yarn release major
yarn release 2.0.0
```

The script checks the Git state, runs quality checks, checks version
availability, creates a release branch, updates `package.json`, and creates
release notes. After confirmation it commits, tags, and pushes the release
branch. Preparing a release no longer prompts for npm authentication.

Open a PR from the release branch to `main`, wait for CI, and merge it. Then
publish a GitHub Release for its tag with the prepared release notes.
Pushing a tag alone does not publish the package.

## Prepare a prerelease

The current release script accepts stable versions. Prepare prereleases
manually until the release tooling gains prerelease support. For example,
on a release branch:

```bash
npm version 2.0.0-beta.1 --no-git-tag-version
```

Prepare release notes, run the quality checks, commit the changes, and create
the matching `v2.0.0-beta.1` tag. Push the branch and tag, merge the release
PR after CI passes, and publish a GitHub Release for that tag. Marking the
GitHub Release as a prerelease makes its status clear to GitHub users.

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
