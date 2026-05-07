# Publishing to npm

## One-time setup

1. Go to [npmjs.com](https://www.npmjs.com) → **Access Tokens** → generate a **Granular Access Token** (or Classic **Automation** token) with publish rights for `t3core`
2. Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `NPM_TOKEN`, Value: the token from step 1

## Publishing a new version

```bash
# 1. Bump version (patch | minor | major)
npm version patch

# 2. Push the commit + tag to GitHub
git push origin main --tags
```

1. Go to GitHub → **Releases → Draft a new release** → select the tag (e.g. `v1.0.1`) → **Publish release**
2. The GitHub Actions workflow (`.github/workflows/publish.yml`) fires automatically and publishes to npm
