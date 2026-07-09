# DEFERER — Architecture & Execution Plan (demo TODAY, 09.07.2026)

Feature: waiter chooses per item batch SEND NOW vs BACKLOG. Backlogged items are invisible
to the bar until the waiter ACTIVATES them (as he heads down, choosing what he can carry).

## 0. Verified current state (investigated 09.07)

- Waiter flow: waiter/[tabId]/page.tsx -> tabService.addItemToTab() -> INSERT/UPDATE on
  sarayamenu.tab_items -> Supabase realtime (subscribeToTabs) -> BarActiveTabs.tsx
  refreshes -> item appears on bar screen INSTANTLY on every tap. There is NO send step
  today. This is exactly the problem Deferer solves.
- Bar page (admin/[venue]/bar/page.tsx) renders two things: StationOrdersBoard
  (customer online orders, separate `orders` flow — NOT touched by this feature) and
  BarActiveTabs (waiter tabs — THIS is where Deferer lands).
- addItemToTab already merges duplicates: finds existing row by (tab_id, product_id) and
  increments quantity.
- closeTab deducts inventory from ALL tab_items regardless of anything -> unaffected.
- KNOWN DEMO RISK (pre-existing bug, fix is P1): bar "clear" hides the whole tab via
  sessionStorage set; items activated AFTER clearing that tab will never appear. In demo:
  do not tap clear on a tab you will add to again, or do P1 fix.

## 1. Data model (migration — run in Supabase SQL editor, schema sarayamenu)

```sql
ALTER TABLE sarayamenu.tab_items
  ADD COLUMN fire_status text NOT NULL DEFAULT 'fired'
    CHECK (fire_status IN ('backlog','fired')),
  ADD COLUMN fired_at timestamptz DEFAULT now();

-- legacy rows: fired by default -> zero behavior change for existing data
CREATE INDEX IF NOT EXISTS tab_items_fire_status_idx
  ON sarayamenu.tab_items (tab_id, fire_status);
```

No new tables. No RLS changes (client already inserts/updates tab_items directly).

## 2. Types — src/types/supabase.ts

Add to tab_items Row/Insert/Update:
```ts
fire_status: 'backlog' | 'fired';   // Insert/Update: optional
fired_at: string | null;            // Insert/Update: optional
```

## 3. Service layer — src/services/tabService.ts

1. addItemToTab(tabId, item) -> add fireStatus: 'fired' | 'backlog' to the item param
   (default 'fired').
   - Duplicate-merge rule changes: match existing row by (tab_id, product_id,
     FIRE_STATUS). Backlog merges with backlog, fired merges with fired. Never merge
     across states (activating must be an explicit event, and a new fired batch appearing
     as its own line on the bar is correct).
   - On insert set fire_status, and fired_at = now() only when fired, else NULL.
2. New: activateTabItems(itemIds: string[]) ->
   UPDATE tab_items SET fire_status='fired', fired_at=now() WHERE id IN (...).
   Realtime UPDATE event already triggers onItemChange -> bar refreshes. Nothing else needed.
3. New: getBacklogForWaiter(restaurantId, waiterId) -> open tabs of this waiter with their
   tab_items filtered to fire_status='backlog' (reuse getOpenTabs + filter client-side —
   cheapest, no new query plumbing).
4. recalcTabTotal: unchanged — backlog items DO count toward the tab total (guest ordered
   them; they will be made).

## 4. Waiter tab screen — src/app/admin/[venue]/waiter/[tabId]/page.tsx

- Segmented mode toggle above the product list, two options (Bosnian, exact strings):
  "Pošalji odmah" (default) | "Odgodi".
  addProduct passes fireStatus: mode === 'odgodi' ? 'backlog' : 'fired'.
- In the tab item list, backlog rows get an amber badge "Na čekanju".
- Sticky action button visible when backlog items exist:
  "Aktiviraj sve na čekanju (N)" -> activateTabItems(allBacklogIdsOfThisTab).

## 5. Waiter floor screen — src/app/admin/[venue]/waiter/page.tsx (THE demo moment)

- Bottom sticky bar visible when the waiter has any backlog items across his open tabs:
  "Na čekanju: N stavki — Aktiviraj".
- Tapping opens a bottom sheet listing backlog items grouped by table (table_label),
  each row with a checkbox (default: all checked). Footer button:
  "Pošalji na bar (N)" -> activateTabItems(selectedIds) -> sheet closes -> items pop
  onto the bar screen in realtime. This is the "choose how many I can carry" from the spec.
- Data source: getBacklogForWaiter; refresh via existing subscribeToTabs pattern.

## 6. Bar screen — src/components/admin/BarActiveTabs.tsx

- Everywhere items are considered (barTabs filter + rendered barItems), add
  i.fire_status === 'fired' to the existing station filter. Tabs whose only bar items are
  backlog do not appear at all.
- P1 (only if time remains): replace cleared: Set<tabId> with
  Record<tabId, clearedAtISO>; show tab again if any fired item has fired_at > clearedAt.
  Fixes the pre-existing "cleared tab swallows new items" bug.
- P1: play playBarChime() when refresh brings previously-unseen fired bar items
  (mirror the known-ids pattern from bar/page.tsx).

## 7. Execution order for Codex (log per tracking regulations, next ONM IDs)

| # | Task | Files | Size |
|---|------|-------|------|
| ONM-a | Migration SQL (give as copy-paste for Supabase SQL editor — do NOT run via MCP) | — | 5 min |
| ONM-b | Types | types/supabase.ts | 5 min |
| ONM-c | tabService: fireStatus param, merge rule, activateTabItems, getBacklogForWaiter | tabService.ts | 15 min |
| ONM-d | Waiter tab page: toggle + badge + activate-all | waiter/[tabId]/page.tsx | 15 min |
| ONM-e | Bar filter fired-only | BarActiveTabs.tsx | 5 min |
| ONM-f | Floor page backlog sheet | waiter/page.tsx (+small component) | 20 min |
| ONM-g | P1: cleared-timestamp fix + chime | BarActiveTabs.tsx | 10 min |

P0 = a–f. If time collapses, f can degrade to d only (activate from inside the tab) — the
feature still demos, just table-by-table.

## 8. Demo script (2 phones/windows)

1. Bar screen open on /admin/{venue}/bar, waiter logged in on phone.
2. Add espresso "Pošalji odmah" -> appears on bar instantly (today's behavior, baseline).
3. Switch to "Odgodi", add 2 kafe + kola -> bar stays clean. Point at bar screen: nothing.
4. Walk-to-bar moment: floor page -> "Na čekanju: 3 — Aktiviraj" -> uncheck one ->
   "Pošalji na bar (2)" -> they pop onto the bar live. Coffee never dies flat.
5. Close tab -> totals include everything, inventory deducts as before.

## 9. Guardrails

- All UI strings Bosnian. No Croatian/Serbian variants.
- No schema renames, no touching the orders (customer) flow, no deploy/push without
  Ismar's explicit go.
- Build must pass next build before any commit.
