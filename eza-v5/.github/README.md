# Nested workflows — unused by GitHub Actions

GitHub Actions only loads workflows from the **repository root**:

`.github/workflows/`

This `eza-v5/.github/` tree is **not** executed by GitHub for this monorepo.
Canonical CI for Mirror Journey and the rest of the app:

- `.github/workflows/backend-ci.yml`
- `.github/workflows/frontend-ci.yml`

Do not edit CI allowlists here — they will not run and will drift.
