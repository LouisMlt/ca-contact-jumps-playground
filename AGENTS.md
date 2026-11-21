# Project guidance

Build an accessible, responsive educational playground. Keep it separate from the Lean proof repository. Use browser-native JavaScript and SVG; avoid adding a framework or dependencies unless a concrete need justifies them.

## Mathematical fidelity

- A finite numerical upper hull is a finite-sample candidate, not a certified global contact. Label that limit beside the plot.
- Schematic configurations must be labeled schematic. Supporting lines must majorize every plotted point and touch the claimed points; ties must remain visible.
- Preserve 0 < alpha < 1, positive integer k, the reference 55440 and all maximizing ties when describing the theorem. Do not claim the alpha = 1 endpoint or unconditional Lean verification. Maynard remains an explicit external hypothesis in the linked formal project.
- Rounded threshold calculations are numerical illustrations, not exact certificates. Distinguish the classical epsilon parameter from the supporting-line slope lambda.

## Code review rules

- Check geometry against data rather than trusting colours or explanatory captions. Each displayed support must dominate all points in its stated domain.
- Flag interactions that silently change a mathematical claim, omit a domain restriction or imply that a finite sample proves a global or unbounded statement.
- Keep the source repository and deployment private unless the user explicitly authorizes changing their audience. Never merge a PR on behalf of the user.

## Checks

Use Node's built-in test runner for meaningful numerical invariants. Include keyboard access, reduced-motion support and readable labels. The feature PR must document commands and actual verification limits. Independent review agents should receive the repository/PR and a neutral brief without development conversation history.
