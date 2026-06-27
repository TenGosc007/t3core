# Publishing to npm

## Quick Start (Automated)

Use the automated release script to prepare a release:

```bash
# Interactive — prompts for version bump type
yarn release

# Or specify directly
yarn release patch    # 1.5.0 -> 1.5.1
yarn release minor    # 1.5.0 -> 1.6.0
yarn release major    # 1.5.0 -> 2.0.0
yarn release 1.6.0    # specific version
```

The script will:

1. **Pre-flight checks** — git state, npm auth
2. **Quality checks** — lint, ts:check, test, fallow, build (before any changes)
3. **Version selection** — patch / minor / major / specific
4. **npm availability** — verify the version doesn't already exist on npm
5. **Release branch** — create `release/v<VERSION>`
6. **Version bump** — update `package.json`
7. **Changelog** — create `.github/releases/v<VERSION>.md` and open editor
8. **Confirm** — commit, tag, and push (with rollback on any error)

If any step fails, all changes are automatically rolled back (branch deleted, `package.json` restored, changelog removed).

---

## Manual Publishing Steps

## One-time setup

1. Go to [npmjs.com](https://www.npmjs.com) → **Access Tokens** → generate a **Granular Access Token** (or Classic **Automation** token) with publish rights for `t3core`
2. Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `NPM_TOKEN`, Value: the token from step 1

## Publishing a new version

### 1. Create a release branch

```bash
# Create and checkout a new branch (e.g., release/v1.0.4)
git checkout -b release/v1.0.4

# Update version in package.json manually or use:
npm version patch --no-git-tag-version
# or: npm version minor --no-git-tag-version
# or: npm version major --no-git-tag-version
```

### 2. Create release document

Create a new file at `.github/releases/v1.0.4.md` following the format of previous releases:

```markdown
# Release title

Brief description of the release

---

## Changelog

## [1.0.4] - YYYY-MM-DD

### Added / Fixed / Changed

- Description of changes

[1.0.4]: https://github.com/TenGosc007/t3core/compare/v1.0.3...v1.0.4
```

### 3. Create tag and push

```bash
# Stage changes
git add .

# Commit and create tag
git commit -m "release: v1.0.4"
git tag v1.0.4

# Push the branch and tag
git push origin release/v1.0.4 --tags
```

### 4. Create pull request

1. Go to GitHub → **Pull requests → New pull request**
2. Base: `main`, Compare: `release/v1.0.4`
3. The PR checks (lint, TypeScript check, tests, fallow) will run automatically
4. After checks pass, merge the PR

### 5. Publish GitHub release

1. Go to GitHub → **Releases → Draft a new release**
2. Select the tag (e.g., `v1.0.4`)
3. Copy release notes from `.github/releases/v1.0.4.md`
4. **Publish release**
5. The GitHub Actions workflow (`.github/workflows/publish.yml`) fires automatically and publishes to npm
