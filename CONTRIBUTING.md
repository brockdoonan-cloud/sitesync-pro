# SiteSync Pro Release Workflow

Use `develop` as the integration branch for testable work and `main` as production. Feature branches should open pull requests into `develop`; Vercel should deploy `develop` to a stable preview URL where Playwright smoke tests and manual checks can run before anything reaches real users. After `develop` is verified, merge or promote `develop` into `main` for the production deployment.

Recommended branch flow:

```bash
git checkout develop
git pull origin develop
git checkout -b feat/short-description
# make changes, run tests
git push origin feat/short-description
# open PR into develop
```

Required checks before promoting `develop` to `main`:

- `npm run build`
- `npx tsc --noEmit`
- `npm run test:e2e` against the develop preview URL
- Site Doctor overall status is OK
- Manual profile import, manual job entry, dispatch, driver closeout, and customer billing smoke checks pass

The GitHub Actions Playwright workflow reads `PLAYWRIGHT_BASE_URL`; set it to the stable develop preview URL once Vercel branch aliases are configured.
