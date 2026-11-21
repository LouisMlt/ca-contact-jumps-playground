# Cloudflare Pages and PR previews

## If the dashboard asks for a deploy command: Workers Static Assets

The newer dashboard may open the Workers flow. This repository also supports it with `wrangler.json`, which explicitly declares `dist` as the static asset directory. Use:

```text
Git branch for the current test deployment: feat/supporting-line-playground
Build command: npm run build
Deploy command: npx wrangler deploy
Root directory: repository root
Environment variable: NODE_VERSION=24
```

The Worker name in `wrangler.json` is `ca-contact-jumps-playground`; it must match the name chosen in the dashboard. After the app is merged, set the production branch to `main`. Do not deploy the current README-only `main` as the app. Non-production branch previews can remain enabled.

This is an **assets-only** deployment, with no Worker script, database or paid binding. Cloudflare documents static asset requests as free and unlimited, with no additional asset-storage charge. This is distinct from the Pages build allowance described below. See [static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) and [Workers build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

The error “Could not detect a directory containing static files” means the deploy step did not find the built assets/configuration. Build the feature branch first and use its new explicit configuration rather than relying on automatic detection.

## Pages alternative

This browser app can use Cloudflare Pages' free plan. As checked on 21 November 2026, that plan allows 500 builds per month, one simultaneous build, 20,000 files per site and 25 MiB per file. Our app is static and needs no Pages Functions, database or paid runtime. A custom domain is optional; `pages.dev` is sufficient.

Sources: [limits](https://developers.cloudflare.com/pages/platform/limits/), [PR previews](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

## One-time account setup

The repository owner must sign in to Cloudflare and authorize its GitHub integration for `LouisMlt/ca-contact-jumps-playground`. This project does not need access to the separate Lean repository. Choose **Workers & Pages → Create → Pages → Connect to Git** (dashboard labels may vary), then select this repository.

Use:

```text
Framework preset: None
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: repository root
Environment variable: NODE_VERSION=24
```

Keep preview deployments enabled for non-production branches. PRs originating in this repository get a preview URL that updates after pushes. Preview URLs are public by default; Cloudflare Access can restrict them if desired.

At the time of PR #1, `main` contains the introductory README rather than the app. A production build from that branch cannot succeed until the feature is merged. Test the feature in Codespaces now; connect production after the author reviews and merges, or use a non-production branch preview without changing which branch is production. Do not merge solely to obtain a test URL.

No Cloudflare project has been created or account connected by this configuration document. GitHub Actions continues to run checks independently. Its separate GitHub Pages deployment remains off unless `ENABLE_PUBLIC_PAGES=true` is explicitly set; leave it off if Cloudflare is chosen to avoid maintaining two production hosts.
