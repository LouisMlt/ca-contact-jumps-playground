# CA Contact Playground

An interactive visual playground exploring colossally abundant numbers, supporting-line contacts, and prime-factor jumps, with guided animations and hands-on controls.

This is a separate educational companion to [the Lean development](https://github.com/LouisMlt/ca-contact-jumps). The mathematical repository remains unchanged.

The first feature will arrive as a pull request. Numerical illustrations and schematic explanations will be clearly distinguished from the mathematical theorem. The theorem covers fixed integer k ≥ 1 and 0 < α < 1; its Lean proof has an explicit quantitative Maynard hypothesis.

## What we're building

- A supporting-line playground: move a line, display several supports together, and see why some CA points are skipped.
- A prime-power explorer: change the classical parameter epsilon and watch primes enter or exponents increase, including ties.
- A guided clean-cluster animation: see how increasing slopes force a jump carrying many distinct prime factors.

Visitors will be able to follow a guided explanation or experiment with the controls. Finite numerical samples will never be presented as certified global contacts.

## Approach

The visual storytelling is inspired by 3Blue1Brown: clear geometry, consistent colours and explanations revealed step by step. This is an original browser application, not a fork of Manim or an affiliated 3Blue1Brown project. The interactive parts will use JavaScript and SVG; Manim animations may be added later if useful.

The source repository is public. Features will arrive through pull requests, with independent AI review before the author decides whether to merge. GitHub Actions will run checks and prepare website deployment; a live site is not yet enabled.
