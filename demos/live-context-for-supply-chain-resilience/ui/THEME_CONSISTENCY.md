# UI Theme Consistency Pass

This revision standardizes the SupplyChain BOB UI around a single shared visual scale in `src/styles/main.scss`.

## What is standardized

- Spacing: one token scale (`--tsci-space-*`) for page, section, card, and control spacing.
- Typography: shared XS/SM/MD/LG/XL/display sizes and consistent IBM Plex font order.
- Controls: common heights, radii, font weights, hover behavior, and sizing for Carbon and custom buttons.
- Cards/tiles: common surface, border, radius, and padding rules.
- Tags/badges: common compact height, radius, font size, and weight.
- Tables: consistent header/body sizing and container treatment.
- Notifications, breadcrumbs, progress indicators, inputs, evidence blocks, score rows, and sidebar controls.
- Responsive behavior for two-column detail views, event rows, and supplier rows.

## Page cleanup

The Dashboard, Risk Detail, Event Stream, Agent tabs, and shared components now use reusable theme classes instead of one-off inline layout styles.

Inline `style={{...}}` usage was reduced from 134 occurrences to 14. The remaining inline styles are data-driven values only (for example severity/status colors, selected event colors, and score-bar width), not typography, padding, radius, or component proportions.

## Validation

- TypeScript/TSX syntax parse: passed using TypeScript 5.8.3 `transpileModule` across `src`.
- SCSS structural brace check: passed.
- Custom literal theme-class selector check: passed.
- Full `npm` build was not regenerated in this sandbox because package installation could not complete against the npm registry. The existing `dist/` therefore remains the previous build output.

After installing dependencies in a normal development environment, regenerate the production bundle with:

```bash
npm ci
npm run build
```
