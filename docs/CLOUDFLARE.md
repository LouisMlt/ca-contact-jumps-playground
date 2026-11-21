# Cloudflare Pages and PR previews

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
