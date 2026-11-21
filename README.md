# CA Contact Playground

An interactive visual playground exploring colossally abundant numbers, supporting-line contacts, and prime-factor jumps, with guided animations and hands-on controls.

This is a separate educational companion to [the Lean development](https://github.com/LouisMlt/ca-contact-jumps). The mathematical repository remains unchanged.

The first feature will arrive as a pull request. Numerical illustrations and schematic explanations will be clearly distinguished from the mathematical theorem. The theorem covers fixed integer k ≥ 1 and 0 < α < 1; its Lean proof has an explicit quantitative Maynard hypothesis.

## What we're building

- A supporting-line playground: move a line, display several supports together, and see why some CA points are skipped.
- A prime-power explorer: change the classical parameter epsilon and watch primes enter or exponents increase, including ties.
- A guided clean-cluster animation: see how increasing slopes force a jump carrying many distinct prime factors.

Visitors will be able to follow a guided explanation or experiment with the controls. Finite numerical samples will never be presented as certified global contacts.

## Run locally

Requires Node 22 or newer and Python 3. No JavaScript package installation is needed.

```sh
npm test
npm run check:data
npm run build
npm run dev
```

Open `http://localhost:4173`. Serve the built files over HTTP; opening `index.html` directly cannot load JavaScript modules or the JSON data reliably.

The app has three interactive chapters, a numerical/schematic mode switch, keyboard-accessible controls, reduced-motion handling, shareable parameter URLs and SVG export. All assets and data load locally; no third-party analytics or external fonts are used.

## Data and mathematical scope

`scripts/generate_data.py` regenerates 180 prime-power transitions. Integers and factorizations are exact; logarithms, threshold ordering and plotted coordinates use floating-point arithmetic. Candidate bounds are checked beyond the last retained event, and unresolved numerical near-ties stop generation. This is a bounded illustration, not a formal certificate or a certification of global contacts.

The finite sample includes 55440 as a reference competitor and labels it as excluded from contacts. Several supported boundary points can be pinned on one plot. The clean-block scene is explicitly schematic; its displayed primes do not assert an actual clean window.

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
