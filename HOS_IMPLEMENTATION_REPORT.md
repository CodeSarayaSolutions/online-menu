# Hospitality operations system — implementation and verification

Status: **deployed to https://menu.saraya.solutions and the live `sarayamenu` schema on 11 October 2026.** Application release `3a26446` includes the user's `7a399c8` push and the verified HTTPS-proxy origin fix. `tracking.db` is the maintained per-issue record. Earlier isolated and production-copy evidence is retained below.

## What the system now distinguishes

- A table is a physical location. An open bill is a seating with one responsible staff member. Finishing order entry does not settle the bill.
- Each added round keeps its own price. Adding one coffee at 2 KM and another later at 3 KM produces a 5 KM bill; it does not retroactively reprice either round.
- Bar/kitchen preparation acknowledgements only dismiss the displayed work. They cannot create another sale, take payment, close a bill or deduct stock.
- A guest order starts pending, is accepted by bar with an estimated preparation time, and joins the table's open bill. A new guest bill is unassigned until someone explicitly takes responsibility. Its guest origin remains visible after staff add another round.
- Counted stock decreases on settlement. Sold quantities are reported independently, including coffee and made-to-order products without counted stock. This is not yet a recipe/ingredient or shared-inventory-variant system.
- Revenue reporting uses settled bills and settlement time. Open bills are shown separately. A venue's timezone defines today/week/custom date boundaries. Ranges include their start and exclude the next boundary.

## Per-issue implementation

| Issue | Result | Evidence |
|---|---|---|
| ONM-4 | Server actions validate custom session, role, target venue and ownership; browser writes to protected tables are revoked. | HTTP denials, real anon-role SQL grants, configuration/operations/shift tests. |
| ONM-6, ONM-25 | Checkout hook order is stable; failed submission preserves the cart and shows a short recovery message. Guest receipts reflect actual pending/accepted/ready state. | Guest unit/SQL/HTTP tests and browser submit/reload/accept/ready flow. |
| ONM-7, ONM-8 | Menu saves are transactional changes to changed sections only, with revision conflict detection, retry identity, preserved draft and visible save result. Product options cannot be half-replaced. | Menu failure/rollback and stale-revision tests; browser saved product and content changes. |
| ONM-9 | Settlement, stock movements and audit commit together. Locking and retry handling prevent duplicate deductions. | Injected stock-history failure rolls everything back; production HTTP concurrent settlement deducts counted stock exactly once. |
| ONM-17 | Deferred rounds remain unsent until explicitly activated. Activation is scoped and atomic; preparation does not hide a later round. | Dedicated backlog SQL suite and quantity acknowledgement tests. |
| ONM-18 | Station survives loading/saving. Disabled kitchens route to bar; enabled kitchens require a preparation choice during new-product creation. | Menu/operations/guest SQL tests and phone editor checks. |
| ONM-19, ONM-32 | Custom email + three-digit PIN login, generated temporary PIN, restricted onboarding challenge, welcome/new/repeat/done flow. Login and onboarding use a touch PIN pad with keyboard/backspace support. Legacy PIN bypass routes are retired. | Browser onboarding and keypad proof; SQL challenge/credential invalidation; HTTP retired-endpoint and session-revocation tests. |
| ONM-20 | Server aggregates plus 50 bill headers, cursor paging and on-demand details/rankings. Browser cache is actor/venue/period scoped and version checked. Operational Supabase server requests bypass Next fetch caching. | 1,205-bill SQL fixture verifies full totals and tied-time paging; production HTTP freshness test. |
| ONM-21 | Shift segment IDs and staff assignments are checked against the authorized venue before any write. | Cross-venue and mixed-invalid batch rollback tests. |
| ONM-22, ONM-35 | Venue-scoped session-storage cart/table context, five-minute server QR grant, stable table-ID links and legacy printed-link support. Orders are priced on the server and submitted idempotently. | Cross-venue/expiry/price tampering/retry SQL and HTTP tests; complete guest browser flow; staff adds to the same guest bill. |
| ONM-23 | Venue-time clock refreshes at minute boundaries and on focus; schedules support midnight crossing. Schedule/product-price saves are atomic and bounded reads are paged. | Half-open/overnight unit tests; configuration failure test. |
| ONM-24 | Order bar observes changing cart state. Variant lines use their cart identity. | Browser add/cart/order flow and store scoping tests. |
| ONM-26 | Platform role changes persist through authorized server actions. Managers cannot grant platform access. | SQL promotion/demotion and manager-denial checks. |
| ONM-27 | Actual RLS/grants/functions inspected through Supabase pg-meta. Anonymous operational reads short-circuit; credential columns and protected write RPCs are not available to browser roles. | Real-role SQL checks; security-definer execute-grant inspection. |
| ONM-28 | Category IDs are used through menu loading, editor, grouped lists, waiter ordering and import. Legacy labels resolve only when unambiguous. | Duplicate-label unit and database tests; no implicit first-match selection. |
| ONM-29 | Separate immutable price snapshots for separate rounds. | SQL 2 KM + 3 KM = 5 KM assertion, with separate lines. |
| ONM-30 | Sidebar matching uses route boundaries, so `barista` does not match the `/bar` route. | Dedicated route unit test and browser sidebar review. |
| ONM-31 | Compact append-only action audit, actual actor/role plus responsible waiter, and platform-only incident/activity screen. Manager intervention opens a warning and is explicitly recorded. | SQL update/delete/truncate denial, platform-only feed, browser warning and attributed DB event. |
| ONM-33 | Platform-controlled Bosnian/English, valid timezone and kitchen capability on creation/editing. Manager cannot enable kitchen or assign kitchen staff when disabled. | Configuration/menu/operations SQL tests; browser saved locale and kitchen-hidden controls. |
| ONM-34 | Bar sees preparation work; kitchen sees food only. Guest acceptance, preparation and settlement are distinct. | Guest/operations SQL and browser bar Done -> guest Ready while bill stays open. |
| ONM-36 | Counted inventory and sales are separate. Initial quantity produces one movement; editing/retrying cannot reset stock. History remains when tracking is disabled. | Inventory suite (including 1,205 coffee sales with no stock row); browser 12 initial bottles + 6 = 18 and movement history. |
| ONM-37 | Manager is assignable staff. Multiple staff per segment are supported. Ended-shift summaries are available the same day; historical assignments/names survive template edits. | Shift SQL suite and browser manager + waiter roster saved/reloaded. |
| ONM-38 | Phone product form prioritizes name/price/category/preparation, explains stock versus sales, collapses optional settings, keeps save accessible and waits for persistence. | Phone browser creation/edit flow and stock initialization check. |
| ONM-39 | Interface copy is available in Bosnian/English across operational and guest views, including editor controls, onboarding, dates and shift CSV. Venue-authored menu text uses its existing translation fields. | Source copy review, TypeScript/build and browser English settings/roster/guest receipt; Bosnian operational flows tested earlier. |
| ONM-40 | Integrated verification uses a disposable schema and synthetic accounts, not Barista's business data. | Build, unit, SQL, production HTTP and browser evidence below. |

## Test evidence

- `npm run build`: passed after final application edits, including type checking and static generation.
- `npm test`: ten passing checks (including the production reverse-proxy origin regression) covering date/time boundaries, DST, route matching, cart/session isolation, expiry, overnight happy hour and duplicate category identity.
- `tests/database/`: ten real PostgreSQL rollback suites: operations, configuration, menu, inventory, reporting, shifts, guests, backlog, import retry and injected settlement failure. All passed. Fixtures are rolled back.
- `tests/http/isolated_api.py`: passed against `next start`, not only development mode. Covers authentication, authorization, bounded reports, QR order/accept/claim, simultaneous settlement with counted stock and immediate session revocation.
- Final measured fresh report round trips: 81.7, 93.8, 109.5, 88.1, 82.5 ms; warm median about 91 ms. These are small-fixture remote round trips, not a production latency guarantee. Earlier faster measurements exposed stale Next fetch caching and were superseded after fixing it.
- Browser evidence includes `.local/pin-pad-proof.jpg`, `.local/guest-order-ready.jpg`, and `.local/manager-intervention-proof.jpg`. Other checks covered staff creation, mandatory onboarding, phone product entry, saved stock, shift roster, localization and guest-to-staff ordering. Final browser checks created a venue with English, Sarajevo timezone and kitchen enabled, required an explicit kitchen/bar choice for its new product, and confirmed editing a counted product preserved its stock. The platform support filter displayed the manager intervention with the original responsible waiter. A venue slug containing `barista` left only Products highlighted. Venue creation now scrolls with its action bar kept accessible.

## Product UX research applied

The form uses focused essential questions and clear labels from [GOV.UK question-page guidance](https://design-system.service.gov.uk/patterns/question-pages/), clear save/error feedback from [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/), and sufficiently sized controls informed by [WCAG target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Optional detail stays available without forcing extra steps for every edit. These are general business-form principles, not copies of another hospitality product.

## Production rollout completed — ONM-41

The server fetched the user's `7a399c8` push from GitHub. Its old `production` branch at `9e35a14` was reviewed; the tested transactional actions and separate preparation acknowledgements replace those older order-routing/duplicate-sale workarounds. The original checkout and old build were retained.

Release `3a26446` was built on the application server with its existing production environment. A pre-cutover test found that the HTTPS reverse proxy made internal request origins differ from the public site origin. `APP_ORIGIN=https://menu.saraya.solutions` now explicitly configures the allowed browser origin; untrusted forwarded hosts cannot change it. The targeted regression test and server rebuild passed. This fix was pushed to GitHub using the server's working repository authentication.

During cutover, the old application was stopped and browser writes frozen. A fresh 27-table/18,526-row snapshot was saved under `.local/backups/sarayamenu-cutover-20261011/`, including original write-grant recovery SQL. All 11 migrations were applied in one transaction. Exact comparison confirmed every original column and row was preserved before the intended credential onboarding changes. No orders, stock movements or payments were invented or corrected.

The two existing accounts without PINs received temporary PINs with mandatory onboarding and seven-day expiry. Six existing PIN hashes were preserved exactly. The platform administrator's code and first-login instructions are in the private `.local/administrator-first-login.txt`; the complete operator credential handoff is `.local/release-temporary-pins.json`. Neither file is tracked in Git. Bootstrap reset the other PIN-less account before the issuer account because making the issuer require onboarding immediately removes its operational authority. The initial opposite-order transaction failed and rolled back completely before the successful retry.

PM2 `online-menu` now runs `/www/wwwroot/online-menu-releases/20261011-7a399c8` on port 3017 with code `3a26446`; its saved startup configuration was updated. PM2's startOrRestart retained the old working directory, so only the online-menu process registration was replaced and the correct cwd/script were then verified. Other applications were not restarted. The active config is `/root/onm-release-pm2.config.cjs`. The original `/www/wwwroot/online-menu` checkout is **not** the active release directory; future deployments must build a new release and update this process configuration. Restarting the old application against the new schema is not a valid rollback.

Production checks passed: HTTPS login and Barista menu return 200; the browser renders the real menu and three-digit PIN pad; administrator temporary PIN returns mandatory onboarding; the challenge cookie is Secure/HttpOnly and cannot read reports; cross-origin writes return 403; all six existing PINs remain unchanged; the live historical report matches database totals and returns at most 50 headers. No incident rows were recorded during these checks. Screenshot: `.local/live-admin-pin-pad.jpg`. The administrator still needs to choose their own PIN through onboarding. Existing open browser/PWA screens should be refreshed to load the release.

The prior full order/settlement and injected-failure tests passed in isolated schemas and against the migrated production copy. Post-deployment verification did not place or settle a fake bill in Barista. Keep historical totals and stock as recorded. The new audit starts at rollout; it cannot reconstruct missing historical actors. Static QR links remain bearer links. Payment processing, fiscal integration, ingredient recipes, shared variant inventory and a new business/location hierarchy remain outside this scope. Database superusers remain the ultimate audit trust boundary.

## Live-data backup and migration rehearsal — 11 October 2026

Completed under ONM-41. A single-statement MVCC snapshot captured all 27 `sarayamenu` tables at 13:14:22 Sarajevo time, including data, columns, defaults, constraints, indexes, functions, triggers, RLS policies and grants. The copy contains 18,501 rows: 5,189 tabs, 7,444 tab lines and 5,459 inventory movements. The oldest tab is 25 May 2026. At snapshot time there were 5,182 closed tabs and seven open tabs across the schema.

Private files are under `.local/backups/sarayamenu-20261011/` (gitignored). `snapshot.json.gz` is the untouched logical snapshot; `manifest.json` records counts and its uncompressed SHA-256. `restore-copy.sql.gz` restores into a new private schema and refuses to overwrite an existing one. These files contain production records and credential hashes; do not commit or publish them. This is the application's schema backup, not a backup of unrelated databases or uploaded image binaries.

Restoration verified equality of every row and original column, not only row counts. The first rehearsal found the category-ID backfill was touching product modification timestamps. `hos-001-foundation.sql` now temporarily suspends the product timestamp trigger during that structural backfill and restores its previous mode in the same transaction.

The second fresh restore, `onm_rehearsal_20261011_2`, passed all 11 corrected migrations. Every one of the 18,501 original rows still matches the untouched snapshot after migration and tests. All ten rollback database suites passed on this migrated copy. Reports for each copied venue matched its complete historical settled count and revenue while returning at most 50 headers. All 85 products resolved their categories. The timestamp trigger remained enabled.

Evidence: `rehearsal-2/migration-results.json`, `regression-results.json`, `post-migration-verification.json` and `historical-report-verification.json` inside the private backup directory. Migration hashes are recorded. Copy schemas have no browser-role schema access and were never added to the REST exposed-schema list. No live application records, credentials or schema were changed. The snapshot and both rehearsal schemas are retained; temporary SQL-upload schemas were removed transactionally.

This rehearsal was followed by the completed production rollout documented above.


## Temporary PIN lockout recovery — 12 October 2026

ONM-32 incident: issuing a temporary PIN replaced credentials but left the account-wide login attempt lockout intact. The login screen also collapsed HTTP 429 into the generic incorrect-details message. Belmina had 24 attempts in one window, including attempts around two PIN resets. Support cleared only her login bucket and recorded the intervention; her latest PIN then reached the onboarding welcome screen in the live browser. Her credential was not changed by support.

Migration `hos-012-pin-recovery.sql` clears the target bucket in the same authorized transaction as issuing a PIN, preserves all other buckets, revokes old sessions, and rejects missing/protected targets. The patch preserves subsequent modifications to `hos_action` and is idempotent. The login UI presents a localized wait-or-request-PIN instruction on 429 without exposing internal errors.

Verification: isolated migrated production-copy `pin-recovery.sql` rollback regression passed, including cross-venue denial, lockout threshold, scoped recovery, credential versioning, session revocation, onboarding and platform reset. Migration applied live; all 10 existing unit tests passed. UI deployment verification follows in tracker.
