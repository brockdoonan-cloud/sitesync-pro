# Unwired Feature Audit

Audit command:

```bash
rg -n "TODO|FIXME|XXX|later to show|coming soon|not yet implemented|placeholder" --glob "*.ts" --glob "*.tsx" --glob "*.js" --glob "*.jsx" .
```

Result: no actionable `TODO`, `FIXME`, `XXX`, "coming soon", "not yet implemented", or scaffolded "later to show" markers remain in source files.

The command still matches ordinary form attributes named `placeholder` and type definitions with a `placeholder` prop. Those are real input hints, not unwired features.

| File | Line | Marker | What's missing | Launch judgment |
|---|---:|---|---|---|
| Multiple form components | varies | `placeholder=` | Nothing; normal input placeholder text | Post-launch/no action |

Launch note: treat future occurrences of `TODO`, `FIXME`, `coming soon`, or "not implemented" in `src/app` or `src/lib` as blockers until they are either shipped or moved into this audit with an owner.
