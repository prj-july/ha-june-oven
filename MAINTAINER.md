# Maintainer safeguards

This repository controls a physical heating appliance. Treat changes to pairing,
commands, cancellation, and camera access as security-sensitive.

## Local controls

Enable the checked-in hooks in every maintainer checkout:

```bash
git config core.hooksPath .githooks
```

`pre-commit` runs the repository checks. `pre-push` blocks direct pushes to
`main`. Either hook can be bypassed locally, so GitHub is the enforcement point.
Install the only local lint dependency without modifying global Python:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install ruff
```

## GitHub controls

After signing in with `gh auth login -h github.com`, apply this rule to `main`:

```bash
gh api --method PUT repos/prj-july/ha-june-oven/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["validate"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismissal_restrictions":{},"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"required_approving_review_count":1}' \
  -f restrictions=null \
  -f required_linear_history=true \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

In GitHub repository settings, also enable private vulnerability reporting and
secret scanning with push protection. Require the `validate` check and keep
branch protection applied to administrators. For a sole maintainer, the one
required approval must come from a trusted collaborator; GitHub does not allow
you to self-approve a pull request.

Review Actions permissions periodically: repository **Settings → Actions →
General** should use read-only workflow permissions and disallow pull requests
from workflows unless you have a specific reviewed need.

## Releases

HACS offers only GitHub releases, so a change reaches users once it is in a
release. `.github/workflows/release.yml` publishes release `vX.Y.Z` (with
generated notes) whenever a push to `main` changes the `version` in
`custom_components/june_oven/manifest.json`. Bump that version in the pull
request; merging it releases it. A version that already has a release is
skipped. To release the current `main` by hand, run the **Release** workflow
from the Actions tab. GitHub Actions must be enabled for the repository.
