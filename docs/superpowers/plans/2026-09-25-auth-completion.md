# Authentication completion implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline for this implementation.

**Goal:** Complete, verify and push secure account recovery and email verification on the existing branch.
**Architecture:** Extend existing Auth with a separate account-token service and configured delivery boundary. Preserve the foundation and ownership queries.
**Tech Stack:** PHP 8.4, PDO MySQL, Phinx, browser ES modules, Node test/jsdom.
**Spec:** docs/superpowers/specs/2026-09-25-auth-completion.md

## Global constraints
No production data access or mutation, no secrets, no foundation rewrite, no force push, preserve existing branch, 12–72 byte passwords, only loopback tabiro_test integration tests.

## Review focus
- Invalid, expired, replayed and wrong-purpose tokens fail without changing account state.
- Recovery invalidates old sessions and superseded reset links.
- Delivery failure does not claim success or leave an active newly issued token.
- Migration reruns and existing account data are preserved.
- EN/JA/FR recovery controls clear URL tokens and never submit automatically.

## Tasks
- [ ] Add failing HTTP recovery tests to tests/auth-recovery.test.mjs, using private sink messages and isolated synthetic accounts. Run against the existing test schema to prove missing routes.
- [ ] Add backend/AccountTokens.php and backend/Mailer.php; integrate routes in Application.php, shared password policy and rehash in Auth.php, and additive indexes in a new migration. Verify real HTTP tests and migration rerun.
- [x] Add failing DOM tests and implement existing-page recovery/verification controls in a dedicated ES module; translate all interface text. Run npm test.
- [ ] Correct README and add deployment/configuration guidance. Add repeatable API test command and local/CI verification instructions.
- [ ] Review changes, run PHP lint and both suites, verify clean diff and no secrets, commit explicit paths, push HEAD to the existing origin branch without force, and verify matching commit IDs.

## Execution evidence

- `npm test`: 35 passed; the two real HTTP/MySQL integration tests were skipped because PHP is unavailable and no `TABIRO_TEST_URL` could be served.
- JavaScript syntax checks, workspace diagnostics, and `git diff --check` pass.
- PHP lint, Phinx migration/rerun, and API/database integration remain unverified because this workstation has no PHP executable. No production database or SSH connection was attempted.
- README and the standard local test command were updated; a CI workflow has not been added.
