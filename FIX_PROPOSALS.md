# Investigation and fix proposals — 10 October 2026

Hospitality Operations System. Investigation of the six numbered findings, with PIN investigation only and additional findings disclosed. Application source remains at commit `9a0652f`; no proposed fix, migration or production write was applied.

## What was checked and what this establishes

Re-read handlers, permission helpers, all affected services and their callers, client stores, reporting calculations, station boards, and shift migrations. Executed isolated fixtures against transpiled current source using an in-memory fake database. Executed a minimal station-mapping candidate in memory and a synthetic cursor algorithm. Performed small read-only requests against the live schema for product-station counts and retrieval timings.

These checks establish specific code paths and identify likely regressions. They do not prove that unimplemented fixes are regression-free. The deployed database's full policy/function/index/trigger definitions are still unavailable through the exposed metadata. PostgreSQL integration tests, migration review and role-specific browser checks remain necessary before rollout. Local fake-database tests do not simulate constraints, RLS, transaction isolation or network delivery.

The user's clarified target is recorded in `PRODUCT_MAP.md`: operational modes are separate from job titles, the bar coordinates whole orders, kitchen sees its preparation items, guest ordering is in-seat, and payment recording differs from payment processing. Preserve custom authentication and `sarayamenu`. Broad business/location schema redesign remains deferred.

## PIN — investigation only (ONM-19)

`src/app/api/waiter/set-pin/route.ts` validates a session and three digits, then writes the requested user's `pin_hash`; it does not compare target to caller or check a credential-management permission. `pin-login` is public and calls the same full-session creator used by other login paths. `verify-pin` requires a caller session but also accepts an arbitrary target. The separate admin PIN-reset flow has different authorization.

This is not merely a confusing waiter chooser: changing the target PIN can lead to a full session for that target, including their platform/venue privileges. No credential was changed and no live attempt was made. The repository routes have no attempt throttling; infrastructure controls were not inspected. There is intentionally no PIN fix proposal or implementation here, pending the user's planned login changes.

## 1. Service-role authorization (ONM-4)

### Evidence

`venue/save`, `upload`, `[venue]/import-menu`, `inventory/adjust`, and `tabs/close` check identity but omit target-venue authorization. In isolated source fixtures, save/adjust/close reached their mutation function for a caller from venue A targeting B without reading membership. Existing closed-tab and shift handlers already demonstrate venue-role checks, so a compatible mechanism exists.

There is a second boundary inside requests. `saveVenueToCloud` looks up products by globally keyed ID and `updateProduct` filters only by ID. A payload authorized for A can contain a product ID belonging to B; the code attempts to overwrite its `restaurant_id` with A. The source fixture reproduced this attempted reassignment. Globally keyed addon/variation IDs and inventory product references need equivalent checks. A top-level venue guard alone would be incomplete.

Invitation is adjacent: a non-admin request without `restaurantId` skips the venue check; re-invitation mutates an existing unactivated account; a manager can request a restaurant role beyond an explicitly defined grant policy. This needs action-specific authorization too, without changing login mechanics.

### Recommended fix

Use a shared server authorization service built on the existing custom session. Resolve the real target from the database and authorize a capability against that target before mutation. Read membership from the server, not `authStore` or request-supplied role/user fields. Reject errors rather than treating failed permission queries as permission.

| Operation | Compatibility baseline / proposed rule |
|---|---|
| Existing venue CMS save, import, asset upload | Existing owner/manager CMS capability; platform admin retained |
| Create a venue | Separate platform-admin operation; do not accidentally turn save into arbitrary venue creation |
| Adjust existing stock | Existing inventory-management capability, currently owner/platform admin |
| Initialize stock for a new product | Explicit narrow capability within authorized product creation; insert once after product creation, never reset an existing stock row |
| Settle a bill | Load tab first, derive its venue, check operational capability and current ownership rule; don't authorize using an unrelated supplied venue |
| Invite staff | Require an authorized target venue for non-admins, restrict which roles the caller may grant, preserve unrelated existing account permissions |

Today the waiter editor permits only the tab's owner to edit/settle. Preserve that baseline in the corrective change. The desired on-shift handling of customer-created bills and any manager override need explicit responsibility rules; do not invent them while fixing this hole. Name capabilities after actions so Waiter/Bar/Kitchen modes can evolve without becoming authorization bypasses.

Validate all nested resource IDs before any write. Product/stock/option ownership must match the authorized venue. Keep predicates on writes as well as preflight checks, and enforce stable parent/child relationships in the database where practical. An upload path must be derived from the canonical authorized location and use a collision-safe namespace, not merely sanitize arbitrary supplied text.

Browser-to-database writes still exist. Server guards do not secure those automatically: review the corresponding deployed custom-session RLS and grants. Do not replace custom auth with Supabase Auth.

### Breakage traps and acceptance checks

- Manager product creation currently calls inventory initialization. Making every inventory endpoint owner-only would break that existing path; move safe initialization into the product transaction instead.
- Creating a product currently queues its save and immediately initializes stock. Validating product existence will expose this race unless sequencing is corrected too.
- Existing admin venue creation uses direct browser services; legacy local-data migration posts full saves. Account for both when separating create from edit, and keep ordinary public menu reads public.
- Role matrix: admin, owner, manager, employee, bar, kitchen, signed-in outsider and anonymous; test same venue, different venue, revoked access, foreign nested IDs, nonexistent IDs and malformed bodies.
- Every rejection must leave all affected records unchanged. Valid CMS upload/import and ordinary waiter settlement must still work.

## 2. Product station mapping (ONM-18)

### Evidence

`getFullProduct` and `getFullMenu` omit `station` when converting database rows to `ProductItem`. `productToRow` defaults missing station to kitchen. Public cart creation also defaults to kitchen, whereas waiter entry defaults to bar. The current product editor has no station control.

Both loaders dropped `bar`, `kitchen` and `both` in isolated fixtures. A minimal in-memory candidate preserving the field passed all six loader/value cases. Live read-only recheck: Barista's 79 products, and the three products in each of the two other stored venues, all have `station = kitchen`. This does not establish whether those values were intentional or overwritten earlier.

### Why the one-line fix is unsafe alone

Barista currently benefits from the waiter fallback to bar. Restoring the stored kitchen value changes newly added waiter lines to kitchen. `BarActiveTabs` displays only fired bar/both lines, so it can hide those new lines. The customer-order bar board already has a separate way to show food-only lines, but the waiter-tab board does not. Kitchen currently lacks the waiter-tab feed altogether.

### Recommended fix

1. Preserve and validate station through both loaders and save paths. An omitted field in an old client must preserve an existing value, not overwrite it with kitchen. New products need a deliberate initial routing choice; avoid divergent hidden defaults.
2. Make the bar's whole-order visibility independent of preparation destination, in line with the clarified product requirement. Keep preparation grouping visible and keep held/backlog items distinct from items actually sent for preparation. Do not use `both` merely to make food visible to the bar; that would imply a preparation destination.
3. Review actual product routing before a controlled backfill; do not infer all drinks/food or change historical line snapshots blindly. Provide the appropriate editing/import/default path so future products can be assigned correctly.
4. Preserve routing captured on existing bill/order lines. Changing the product catalog must not retroactively change a historical preparation record. Supporting kitchen preparation for waiter-originated orders is a separate connection to implement deliberately, not something the mapper fixes by itself.

Acceptance: every station round-trips; theme-only save leaves stations unchanged; old-client omission preserves data; food-only and mixed orders remain visible to bar; kitchen filters preparation items correctly; backlog remains held; both guest and waiter entry are checked. Release board compatibility before or together with mapping/data changes.

## 3. Partial saves and settlement/inventory writes (ONM-7/8/9)

These are two separate fixes, with a common need for database transactions and concurrency control.

### 3A. CMS/menu save

Current flow: a 600ms debounce sends the entire venue bundle. The server performs many independent writes; even a visual setting change rewrites products and deletes/reinserts their option rows. Addon/variation read and deletion errors are not consistently checked. The debounce cancels a pending timer, not a request already in flight. Two devices can overwrite each other's older snapshots even if each request succeeds.

Recommended containment: stop treating failed relation reads as empty successful data, propagate every write failure, expose actual saving/saved/failed state, and serialize/coalesce saves per venue within a client. Keep the user's edits after failure. These changes reduce risk but do not make separate HTTP writes atomic.

Recommended durable change: split presentation settings from catalog mutation. Make a logical product edit, including its options, one transaction; make replace-import an explicit transaction. Preserve unchanged option IDs and happy-hour/stock relationships. Use an expected revision/version checked inside the transaction; reject stale edits with a conflict rather than silently overwriting newer data. Revisions should match the unit being edited so changing a color need not conflict with changing a product.

A narrowly scoped database function called through the existing server route is one implementation path. A PostgREST request runs in a transaction, so a single function can commit all its writes or roll back on error; several separate REST calls cannot share that protection. [PostgREST transaction documentation](https://postgrest.org/en/stable/references/transactions.html).

Use service-only execution privileges for these server-owned mutation functions, with explicit authorization before the call and trusted actor identity supplied only by the server. Prefer invoker semantics with the intended caller privileges; if definer privileges are genuinely needed, lock down search paths and grants. Exposing a privileged RPC directly to anonymous callers would reintroduce the hole. [Supabase function security documentation](https://supabase.com/docs/guides/database/functions).

Checks: inject failure at option replacement; concurrently save two revisions; verify no partial product or lost unrelated edit; preserve existing IDs, inventory, happy-hour references, dependency metadata, import merge/replace semantics, theme previews and user drafts. An old full-bundle client must not bypass revisions after rollout; give it a clear reload/conflict response instead of accepting silent overwrites.

### 3B. Tab settlement and counted stock

Current `closeTab` writes closed status before deducting stock. A source fixture with an injected deduction failure rejected the request while the tab was already closed. Retrying cannot safely resume that flow. Stock uses read/modify/write arithmetic, and separate item/total writes can race with close. Reordering the same HTTP calls only changes which partial failure happens first.

Recommended bounded fix: one settlement transaction that validates the actor, locks the tab, validates its current state, obtains the final lines, recalculates the total from persisted price snapshots, records the chosen payment method, adjusts applicable counted stock, writes movements and closes exactly once. Use an idempotency key tied to actor/venue/tab/action and request fingerprint: repeating the same request returns the original result; a conflicting request cannot deduct again. Tab status and a unique settlement record must prevent double-close even when two requests use different keys.

Every add/remove/activate operation must participate in the same parent-tab locking/state-check protocol, or a line can still be added during/after settlement. Lock affected stock rows in deterministic order and use atomic quantity updates. Changing only the close route is insufficient. PostgreSQL row locks provide this coordination when all relevant write paths participate. [PostgreSQL locking documentation](https://www.postgresql.org/docs/17/explicit-locking.html).

Preserve current behavior intentionally: untracked/missing stock is skipped; negative balances are currently possible; do not introduce a new zero-stock sales block or recipe deduction as a hidden side effect. Aggregate repeated product lines for stock consumption while preserving their separate price snapshots. Price changes must not reprice earlier rounds.

Important tradeoff: cash/card has already been handled by a person; a database rollback cannot undo the physical payment. The UI must distinguish a failed recording from an unpaid customer and safely retry the recording. For future complex inventory integrations, prefer settlement plus a durable consumption event in one transaction, with an idempotent stock processor and visible pending/reconciliation state. That requires an actual worker/recovery mechanism; fire-and-forget promises are not a substitute. Do not introduce that additional subsystem just to repair today's simple counted-stock path.

Checks: double-click, retry after lost response, simultaneous settlement, add/remove versus close, simultaneous stock adjustment, duplicate product at different prices, missing/untracked/negative stock, injected movement failure and backlog settlement. Existing handling charges/deducts held items too; whether unsent items may be settled is an unresolved product rule, not a silent fix.

## 4. Reporting without fetching history wholesale (ONM-20)

### Current behavior, precisely

- Waiter bills: the Narudzbe screen sends the selected period to `tabs/closed`, and the service filters by venue/status/closed_at. It does not fetch all 5,106 bills for the Today view. It still has no pagination, and it fetches item rows for every returned bill.
- Customer orders: `useOrders` calls an all-history venue query, with JSON items included, and the page filters dates in the browser. An old selected period may be absent from the latest 1,000 fetched rows.
- Analytics and CSV derive from those arrays. A truncated input creates plausible but incomplete totals. Batching 75 bill IDs does not protect against a 1,000-item response within a batch.
- Shift summary separately fetches matching bills, all their items, and customer orders to aggregate in JavaScript. It has the same completeness risks.
- The bar additionally refetches details per open tab even after `getOpenTabs` has already fetched their items. More history pagination would not fix this active-screen duplication.

Read-only follow-up: Barista had 90 closed bills on October 9 and 472 in the October 5–12 calendar-week window at query time. Today's pilot is not proof against higher-volume truncation. Those numbers are dated snapshots, not forecasts or the app's current incorrectly named week preset.

### Recommended request model

| User action | Data requested | Data not required |
|---|---|---|
| Open Narudzbe | Authoritative period summary and first 50 lightweight bill/order headers, requested concurrently | Every line of every historical bill |
| Switch Today/Week | Matching cached result immediately when available; background freshness check; new result if absent | All history or arbitrary artificial wait |
| Scroll/request more | Next 50 headers using a stable cursor | Prior pages again or every bill's items |
| Open one bill | That bill's authorized detail; retain it in a bounded client cache | Details for unopened bills |
| Open product/staff analytics | Grouped results for that range and breakdown | Thousands of raw rows for client reduction |
| Export | Separate authorized, complete range export using a stable snapshot/cutoff contract | Whatever happens to be loaded on screen |
| Receive activity change | Invalidate affected current summary/list/detail; coalesce redundant refreshes | Refetch every date period and venue |

The summary query aggregates inside Postgres and returns totals/grouped results, so the API row cap does not truncate the underlying sum. Return summaries separately from paged lists; never calculate complete totals from just the visible page. Avoid multiplying bill totals when joining their item rows: aggregate each source at its proper grain before joining. Include a report contract/version and an as-of timestamp.

A read-only RPC can return the initial summary and page under one consistent database snapshot if their combined latency stays low. Otherwise return the first page and cheap summary independently, and defer expensive product breakdowns until needed. Do not make the visible list wait on every optional statistic. Read model changes and a few purpose-built functions/indexes do not require deciding the future business/location hierarchy now; use the existing location key.

### Paging, indexes and consistency

Use keyset ordering such as `(closed_at DESC, id DESC)` for closed tabs, including both values in the cursor. For a combined customer/waiter feed, include a source discriminator as well. Bind/validate cursors against venue, filters, sort and snapshot; a cursor does not grant access. Request 51 rows to return 50 plus `hasMore`, without a separate exact-count query for each scroll.

A synthetic fixture traversed 7,007 rows with tied timestamps in 50-row pages without duplicates or omissions. This checks the proposed ordering algorithm only. New arrivals can be surfaced as a refresh/new-items signal rather than reshuffling the page under the reader. Historical corrections need version invalidation; an as-of cutoff by itself is not a strict snapshot of mutable rows. Large exact exports may need a database snapshot or a generated export artifact.

Inspect deployed indexes and query plans before adding anything. Candidate access paths are a location/closed_at/id partial index for closed tabs, location/created_at/id for customer orders, tab_id for lines, and the corresponding location/time path for stock movements. Add waiter/time indexes only if measured queries justify them. Rollups by location/day/waiter/payment/product are a later optimization if indexed live aggregation is too slow; they must support corrections/reconciliation rather than becoming an unverified second ledger.

### Cache behavior and speed

- Keep a bounded in-memory cache keyed by authenticated user/access scope, location, explicit period, timezone, filters, metric version and cursor. Clear private data on logout/user change; do not share a previous waiter's cached report on the same device.
- A cache hit should paint promptly, with freshness indicated when revalidating. Keep backend work independent of later animation timings. An initial target of under 50ms for displaying an already-cached view is a measurement goal, not a measured result.
- Prefetch only likely next data after the visible request has completed, or on deliberate navigation intent. Limit it on slow connections; cancel obsolete requests and deduplicate in-flight ones. Never prefetch whole history.
- Use explicit private/no-store HTTP handling for sensitive responses; any application-level server data cache sits behind fresh authorization and includes every permission-sensitive dimension. Do not accidentally rely on framework route caching. This repo uses Next 14, whose caching behavior must be handled explicitly. [Next 14 caching documentation](https://nextjs.org/docs/14/app/building-your-application/caching).
- Realtime is an invalidation hint, not the sole correctness mechanism. Repair the existing reconnect dependency, refresh after own mutations and on reconnect/focus, and have bounded fallback refresh when delivery is unavailable. The custom PostgREST header has not been verified as usable identity for Realtime subscriptions.
- Avoid treating permission/network failure as an empty successful report. Keep the last result with an error/stale state rather than showing a misleading zero.

Small read-only transport probe, three sequential samples per shape: 50 selected tab headers were 12,858 JSON bytes and 283–382ms; 50 full tab rows without items were 16,151 bytes and 263–294ms. Two count requests took 220–227ms. These are workstation-to-endpoint timings with connection/TLS/network overhead, not SQL execution measurements or a load test; they do not prove the wider row is faster. They show why fewer sequential request legs and warm UI caching matter. There is no basis yet to promise millisecond-fresh totals to every remote owner on a cold connection.

Benchmark the eventual implementation on realistic data at 1,000/day and 7,000/week and beyond. Separate database execution, app-server time, payload size, network and browser render; record p50/p95 under concurrent usage. Measure both cold authorized loads and warm navigation.

### Correctness rules to settle alongside retrieval

The current "Ova sedmica" subtracts seven days and includes today, spanning eight calendar dates rather than the calendar week. Propose Monday-start venue-local week, with explicit dates in the UI. Confirm that meaning instead of quietly changing existing reports. Use the location timezone (initially Europe/Sarajevo for Barista), not the owner's travel timezone or server timezone, and half-open windows `[start, end)` so adjoining shifts do not both count a boundary bill.

Separate recorded settled tab value from customer order value. Customer orders have no established payment-confirmation record; selected card/cash is not proof of payment. Current orders-page revenue includes cancelled orders, whereas shift summaries exclude them. Choose a documented metric contract and display unknown/unattributed values rather than allocating customer orders to a waiter without evidence. For existing waiter bills, reporting uses `waiter_id` and `closed_at`; a table opened in one shift and settled in another needs an explicit attribution rule before changing that behavior.

Acceptance: counts/sums/export agree for 0, 50, 1,000, 1,001 and 7,000+ records; item counts exceeding 1,000 also agree; timestamp ties, changing filters, rapid venue switch, midnight/week/DST boundaries, cancelled/unpaid orders, deleted staff/product labels and access revocation are covered. Keep active bar/kitchen feeds separate from historical report paging so an older unfulfilled order cannot disappear behind a Today filter.

## 5. Venue-scoped guest cart and table context (ONM-22)

### Evidence

`cartStore` is one global items array with no venue field. `tableSessionStore` persists one table label/expiry for the entire browser tab. Public layout reads `?table=` without storing venue identity. Checkout combines the current URL venue with that global cart and label. Navigating A to B can therefore carry A's order context into B. The fixture also confirmed that an identical cart key merges quantity while retaining the first line's price.

The public CMS uses shared flat active-venue state; the layout's ready flag and asynchronous loader are not enough to prevent a previous venue's data from briefly remaining active or an older load completing late. Clearing the cart in one effect would not fully solve the underlying context race.

### Recommended fix

Keep one active guest ordering context: `{locationId, tableId/tableLabel, expiry, cartLines, contextVersion}`. Stamp each added line with its location and validate it against the active context. Bind QR resolution to a real active table within that location. A digital-menu visit without a table remains valid for browsing.

On a location change, start an empty context; if a nonempty draft would be lost, explain/confirm that transition before discarding it. Persist table context per location in sessionStorage, with expiry; keep cart persistence behavior unchanged unless deliberately requested. Old stored table sessions lack location identity and must expire rather than being guessed into a venue. Key/reset view state per venue and ignore/cancel stale data-load responses; verify context again at submit time and before clearing a completed draft.

Route guest order submission through server validation: location, active table, enabled ordering, product ownership, available options, quantities and authoritative applicable prices. Derive routing from catalog data and use an idempotency key for retry/double submission. This stays a public guest action; it must not require staff login or Supabase Auth. To make validation meaningful, the deployed anonymous direct-insert path must be closed or enforce equivalent rules; a client-only guard can be bypassed. Preserve public menu read access.

Do not accidentally enable the future guest-to-waiter shared-bill workflow while fixing isolation. Creating a customer order currently does not open/attach a waiter tab or assign responsibility. That connection needs explicit product rules for repeat orders, simultaneous guests and multiple on-shift waiters. Likewise a QR table label is not proof of physical presence; stronger table-session issuance is a separate design decision.

Checks: A/table-1 to B/table-1, back navigation, expired session, missing table, refresh, menu-only mode, product options, changed happy-hour price, double-click/retry, switching venue during submission and two different locations open in separate browser tabs. Retain the user's draft on failure; do not clear a new context when an old request succeeds.

## 6. Shift nested-resource authorization (ONM-21)

### Evidence

Shift routes authorize the requested venue, but `saveDaySchedule` updates a supplied segment ID with only an ID predicate and includes a new `restaurant_id` in the payload. The isolated source fixture moved a foreign segment to the requested venue. Actual deployed constraints were not tested. Hours are written and existing segments may be deleted before all supplied IDs are validated.

`saveDateRoster` validates assignee membership but does not validate that each segment belongs to the venue and date's weekday. `getSegmentById` loads a global segment and its template assignments before a summary builds a requested-venue result; this can expose foreign segment/assignment information even though sales queries themselves remain venue-filtered. The supplied migration has separate foreign keys, not a composite segment/location constraint.

### Recommended fix

Validate the entire request before any mutation: actual calendar date, day 1–7, strict time values, unique segment IDs, ownership, matching weekday and eligible assignees. Scope every read/update/delete to location plus resource ID; do not allow ownership fields to be changed by editing a segment. Require the expected row to exist rather than treating a zero-row update as success.

Save a day/roster atomically after validation. New segment IDs are server-generated. Add a composite parent/location relationship where practical, after auditing existing inconsistencies; keep custom-session RLS aligned for direct browser access. Fetch summary segments through the authorized venue before loading any assignments or names. Use non-disclosing not-found responses for foreign resources.

Preserve current saved-empty-roster versus template-fallback behavior. Do not opportunistically change owner eligibility, add overnight shifts, or reinterpret historical schedules as part of this authorization repair. Historical rosters currently depend on mutable weekly segments, and deleting a segment cascades assignments; preserving historical meaning is a separate issue needing a deliberate solution.

Checks: valid owner/manager/admin operations, unauthorized venue, foreign segment on same weekday, wrong weekday, foreign assignee, nonexistent ID, duplicate IDs, invalid date/time, empty roster, closed day and a failure halfway through saving. Test historical reads after schedule edits before claiming history is preserved.

## Other findings: the first six were a selection, not the full list

| Finding | Evidence / scope | Suggested direction |
|---|---|---|
| Repeated-round pricing (new ONM-29) | Actual service fixture: 1 x 2 KM followed by 1 x 3 KM becomes 2 x 2 KM. Existing lines keep the first unit price. | Agree when price locks; preserve distinct price/option snapshots and merge only compatible lines. Coordinate with backlog activation. |
| Bar sidebar highlight (new ONM-30) | `pathname.includes('/bar')` matches `/admin/barista/products`. Exact cause matches user report. | Match the route segment/full href, including intended nested routes, rather than a substring of the venue slug. |
| Backlog activation collisions and persistent dismissal (ONM-17) | Activation can create duplicate fired rows for the same product; later `maybeSingle` fails. Clearing a whole tab hides subsequent rounds. | Use stable line/batch identity and acknowledge prepared quantities/rounds, not a whole still-open visit forever. |
| Happy-hour clock (ONM-23) | Memoized map depends on fetched schedules, not passing time. | Recompute at the next relevant boundary and after resume; apply a documented price-lock rule. |
| Cart bar reactivity (ONM-24) | Selectors watch stable getter functions instead of changing items/scalars. | Subscribe to reactive derived values/state. |
| Checkout hook ordering and invisible failure (ONM-25/6) | Five hooks after conditional return; submission catch hides error. | Stable hook order and recoverable user-visible error, preserving draft/idempotency. |
| Platform-role edit not persisted (ONM-26) | Button changes local store only. | Authorized persisted operation plus refreshed custom-session permissions, if this control remains part of the future login/staff design. |
| Category identity mismatch (ONM-28) | IDs and labels mixed; rename does not update product references. | Agree stable category identity and migrate carefully; preserve presentation labels independently. |
| Preparation/payment conflation | Kitchen and bar mutate one shared order status; card can be labelled Online although not processed; some amounts hard-code euros. | Define preparation/delivery/settlement states separately; accurate method/status labels and location currency. |
| Guest-to-waiter connection absent | Customer orders do not currently become assigned waiter bills; waiter tabs do not feed kitchen. | Explicit next product workflow, not a claim that existing screens already meet the new system definition. |
| Stock initialization/history issues | Init upsert can reset stock on repeated/replace imports; first positive adjustment omits movement; daily opening reconstruction ignores manual movements. | Insert-only init, atomic audited movements, and a reconciled movement-based report. |
| Reporting semantics and dates | Cancelled/unspecified-payment values, shift boundary overlap, eight-date week, mixed timezones, grouping by mutable name. | One explicit report contract and stable identities; preserve historical snapshots. |
| RLS/Realtime uncertainty (ONM-27) | Anonymous count queries previously timed out; authenticated Realtime not established by custom fetch header. | Inspect deployed policies/functions/publications and actual delivery before choosing cache invalidation assumptions. No exposure/root cause inferred from timeouts. |
| Active-view excess requests | Bar repeats per-tab detail reads after bulk item loading; item subscriptions are not venue-filtered; reconnect key does not recreate order subscription. | Reuse loaded data, scoped/coalesced invalidation and correct reconnect lifecycle. |
| Other operational debt (ONM-2/10) | Unescaped QR print/CSV text, unvalidated preview messages, upload validation/overwrite behavior, stale legacy routes, unconfigured lint, incomplete DB bootstrap, broad PWA cache deletion. | Separate targeted corrections; these are not all launch blockers of equal severity. |

## Proposed implementation order and regression limits

1. Correct target/nested-resource authorization and shift ownership using the current roles as a compatibility baseline; keep planned login/PIN redesign separate.
2. Correct station mapping together with board visibility and reviewed product routing; do not ship the isolated one-line change against today's catalog.
3. Establish atomic/idempotent settlement and compatible line mutation, plus safe product/stock initialization. Separate scoped CMS saves with revisions from this operational transaction.
4. Replace report array aggregation with authoritative summaries and paged detail, then measure and add cache/prefetch where it improves real navigation.
5. Isolate guest ordering context and validate submission before broader guest-order rollout; define the customer-to-operational-bill connection as a distinct product step.

This ordering is a proposal, not an implementation started without discussion. Small confirmed UI fixes can be independently scoped. Product-level decisions that remain are operational ownership/override, price lock timing, shift attribution, held-item settlement, report period semantics and actual product preparation routing.

The strongest checked compatibility warnings are: station restoration can hide current bar items; blanket inventory authorization can break manager product creation; adding venue guards alone leaves nested-ID vulnerabilities; locking close alone leaves item-mutation races; paging rows alone makes totals incomplete; and client cart reset alone leaves stale CMS/submission races. The proposed fixes explicitly account for these interactions, but integration verification is still required once code and migrations exist.
