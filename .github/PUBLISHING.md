# Publishing to npm

## Quick Start (Automated)

Use the automated release script to perform all steps at once:

```bash
# Bump patch version (1.0.0 -> 1.0.1)
./scripts/publish-release.sh patch

# Or bump minor/major
./scripts/publish-release.sh minor
./scripts/publish-release.sh major

# Or use a specific version
./scripts/publish-release.sh 1.2.3
```

The script will:

1. Create a release branch
2. Update version in package.json
3. Create release document template
4. Run all release checks and create the git tag
5. Provide next steps for pushing and creating PR

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

# Run the release script to create the tag
yarn release:tag

# Push the branch and tag
git push origin release/v1.0.4 --tags
```

### 4. Create pull request

1. Go to GitHub → **Pull requests → New pull request**
2. Base: `main`, Compare: `release/v1.0.4`
3. The PR checks (lint, TypeScript check, tests) will run automatically
4. After checks pass, merge the PR

### 5. Publish GitHub release

1. Go to GitHub → **Releases → Draft a new release**
2. Select the tag (e.g., `v1.0.4`)
3. Copy release notes from `.github/releases/v1.0.4.md`
4. **Publish release**
5. The GitHub Actions workflow (`.github/workflows/publish.yml`) fires automatically and publishes to npm
