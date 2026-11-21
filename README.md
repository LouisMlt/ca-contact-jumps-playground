# CA Contact Playground

An interactive visual playground exploring colossally abundant numbers, supporting-line contacts, and prime-factor jumps, with guided animations and hands-on controls.

This is a separate educational companion to [the Lean development](https://github.com/LouisMlt/ca-contact-jumps). The mathematical repository remains unchanged.

The first feature will arrive as a pull request. Numerical illustrations and schematic explanations will be clearly distinguished from the mathematical theorem. The theorem covers fixed integer k ≥ 1 and 0 < α < 1; its Lean proof has an explicit quantitative Maynard hypothesis.

## What we're building

- A supporting-line playground: move a line, display several supports together, and see why some CA points are skipped.
- A prime-power explorer: change the classical parameter epsilon and watch primes enter or exponents increase, including ties.
- A guided clean-cluster animation: see how increasing slopes force a jump carrying many distinct prime factors.

Visitors will be able to follow a guided explanation or experiment with the controls. Finite numerical samples will never be presented as certified global contacts.

## Test the PR branch directly

In GitHub, open [the feature branch](https://github.com/LouisMlt/ca-contact-jumps-playground/tree/feat/supporting-line-playground), then **Code → Codespaces → Create codespace**. In its terminal run:

```sh
python3 -m http.server 4173 --directory src --bind 0.0.0.0
```

Open port **4173** from the Codespaces **Ports** tab. This serves the branch's source directly: no merge, build or package installation is needed. Stop the server with Ctrl+C. To get a later pushed checkpoint, first preserve any local edits, run `git pull --ff-only` on the feature branch and refresh the browser. The URL in Codespaces is a development preview, not a production deployment.

To try the same branch on your computer:

```sh
git clone --branch feat/supporting-line-playground https://github.com/LouisMlt/ca-contact-jumps-playground.git
cd ca-contact-jumps-playground
python3 -m http.server 4173 --directory src
```

Open `http://localhost:4173`.

## Build and check locally

Requires Node 22 or newer and Python 3. No JavaScript package installation is needed.

```sh
npm test
npm run check:data
npm run build
npm run preview
```

Open `http://localhost:4173`. Serve the built files over HTTP; opening `index.html` directly cannot load JavaScript modules or the JSON data reliably.

`npm run dev` serves `src/` directly. `npm run preview` serves the last production build in `dist/`.

The app has three interactive chapters, a numerical/schematic mode switch, keyboard-accessible controls, reduced-motion handling, shareable parameter URLs and SVG export. Formulas use locally vendored KaTeX with LaTeX fonts and MathML. All assets and data load from the site; no CDN or third-party analytics are used. See [third-party assets](THIRD_PARTY.md).

## Data and mathematical scope

`scripts/generate_data.py` regenerates 180 prime-power transitions. Integers and factorizations are exact; logarithms, threshold ordering and plotted coordinates use floating-point arithmetic. Candidate bounds are checked beyond the last retained event, and unresolved numerical near-ties stop generation. This is a bounded illustration, not a formal certificate or a certification of global contacts.

The finite sample includes 55440 as a reference competitor and labels it as excluded from contacts. Several supported boundary points can be pinned on one plot. The clean-block scene is explicitly schematic; its displayed primes do not assert an actual clean window.

Real CA data is the default. Click a point to see its original X and Y coordinates, exact integer and factorization. The optional **Schematic** mode uses constructed P-labelled points; it is not an actual CA sequence. Increasing successive slopes are required only for the proof's sufficiently large clean blocks, not arbitrary neighbouring CA integers or the generic geometric schematic.

Alpha is exactly the exponent in `X(n) = (log n)^alpha`; k is the exponent in Y. Small alpha can look straighter: `(X-1)/alpha` tends to `log log n` as alpha tends to zero. The axes fit each viewport. Neither this observation nor the app claims universal monotonicity of straightness in alpha or k. Regression tests check the formulas independently of their labels.

The block chapter uses **symbolic primes only**. `r` is their number and `p_i` is the ith distinct fresh prime. It progresses through prime entry, the required slope condition, and bracketing/divisibility. Every point position is constructed. No numeric prime window, actual CA clean cluster or existence proof is supplied by that drawing; the mathematical theorem supplies the missing hypotheses separately.

**Reveal small gaps** plots `Y(n) − H(X(n))`, where H is the finite sample's piecewise-linear upper boundary. Boundary points are at zero and skipped points have negative values. This diagnostic projection uses the actual differences without a multiplier; it does not invent or alter the original coordinates, which remain available in the inspector. It is explicitly labelled and does not certify global contacts.

Select a point and use **+** to zoom around it, **Left/Right** to pan or **Fit all** to restore the full view. Zoom changes only the viewport: supports and boundary classifications continue to use the entire selected sample, including off-screen competitors. Share links preserve the projection, camera and checkbox state.

## Checks and deployment

GitHub Actions regenerates the data, runs mathematical invariant tests, builds the static app and runs real Chromium interaction checks at desktop/mobile sizes and under a repository subpath. Browser tests can also be run in a normal local environment:

```sh
python3 -m pip install -r requirements-test.txt
python3 -m playwright install chromium
python3 -m unittest discover -s test/browser -p 'test_*.py' -v
```

CI uploads the built site as an artifact. Deployment is deliberately disabled until the owner reviews and merges the PR. To enable public GitHub Pages afterwards:

1. Set **Settings → Pages → Source** to **GitHub Actions**.
2. Set the Actions repository variable **ENABLE_PUBLIC_PAGES** to **true**.
3. Run the workflow on `main`, or push a reviewed change to `main`.

Deployment runs only on `main` after the checks pass. PR branches do not deploy. A private source repository alone would not make its Pages site private.

This is an original browser application, not a Manim fork or a project affiliated with 3Blue1Brown. The visual direction draws on geometry-led mathematical storytelling. No software license has been selected yet.

For Cloudflare's free plan and the one-time account connection, see [Cloudflare Pages setup](docs/CLOUDFLARE.md). No Cloudflare account or production deployment has been configured automatically.
