# Complete Tabiro authentication

Extend the existing PHP 8.4/PDO/Phinx architecture on feat/local-auth-itineraries. Preserve the existing foundation migration and production data. The requested outcome is usable registration, login/logout, email verification and password recovery, with private per-user itineraries, verified tests and a GitHub push to this existing branch.

Use the existing users, roles, user_roles, sessions and auth_tokens tables. Add an additive migration for token lookup/expiry indexes; require a tracked foundation and compatible schema. Never silently adopt pre-existing tables or rewrite applied migration files. Document operator inspection for an untracked or partially applied foundation; no automatic repair, rollback, production connection or deployment.

Add POST forgot-password, reset-password, verification-request and verify-email endpoints. Random 32-byte tokens are stored only as SHA-256 hashes, expire (reset 30 minutes; verification 24 hours), are bound to purpose and user, and are consumed transactionally with a user lock. Reissue supersedes prior tokens of that purpose. Reset revokes all sessions and reset tokens. Verification does not grant sessions or roles. Registration continues to assign only the user role; unverified accounts retain access only to their own private trips. No administrator account or new privileged interface.

All mutations require existing CSRF. Rate-limit issue and consumption attempts; unknown recovery emails return the same generic response. Enforce the existing 12–72 byte password policy, reject null bytes, and rehash on login. Use prepared statements, secure production cookies and safe error responses. Never return raw tokens through API responses or logs.

Mail uses PHP's configured local mail transport only when explicitly configured with sender and HTTPS application URL in private production configuration. Development/test mail goes to a private file sink under .local. Disabled or failed delivery returns a safe unavailable error; never claim sent mail when delivery failed. Links put tokens in a fragment, not URL query; frontend clears fragment immediately and requires an explicit form submission. No external SMTP credentials in source.

Add localized recovery and verification controls to existing sign-in/account pages, preserving EN/JA/FR and visual design. No production email is sent during tests. Correct outdated README guidance and provide exact deployment prerequisites, separate production approval and SSH limitations.

Verification: preserve frontend tests, add user-facing DOM coverage, run HTTP tests against the guarded loopback tabiro_test database, cover expired/wrong-purpose/replayed tokens, old session revocation, CSRF, missing users, roles, ownership and mail failure. Run migration twice, PHP lint, diff/secret review, and verify remote branch identity before non-force push. Tests may create synthetic records only in tabiro_test.
