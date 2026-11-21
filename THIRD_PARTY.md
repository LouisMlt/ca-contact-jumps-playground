# Third-party assets

The site includes KaTeX 0.19.1 for local LaTeX rendering. Its prebuilt ES module, CSS and fonts are copied from the pinned npm distribution, with the upstream package integrity verified before extraction. See `src/vendor/katex/LICENSE` for the MIT license, `src/vendor/katex/MANIFEST.json` for sources and asset hashes, and `scripts/vendor_katex.py` for reproduction.

All math assets are served from the same site as the app. A CDN, tracking script or package installation is not needed to test the branch. Run `python3 scripts/vendor_katex.py --check` to verify the committed copy without network access.
