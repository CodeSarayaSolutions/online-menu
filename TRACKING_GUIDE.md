# Online Menu Tracking Guide

This project uses `tracking.db` as the living technical memory for architecture,
features, bugs, UX decisions, API risks, permissions, implementation progress,
and finished module documentation.

The tracker matters because the previous markdown docs drifted from the real
codebase. Future work should be traceable from problem, to decision, to
implementation, to verified finished state.

## Read This First

At the start of project work:

1. Read this file.
2. Query open tracker items from `tracking.db`.
3. Check whether the current task relates to an existing item before creating a
   new one.
4. Update the tracker when a decision, implementation step, risk, or
   verification result changes.

Useful query:

```bash
sqlite3 tracking.db "
  SELECT code, primary_type, status, priority, module, title
  FROM items
  WHERE status NOT IN ('verified', 'closed', 'wont_do')
  ORDER BY
    CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
    id;
"
```

## Type Model

Use one `primary_type` to describe the workflow shape:

- `bug`: broken or risky behavior
- `feature`: new capability or product behavior
- `task`: maintenance, setup, docs cleanup, migration, refactor
- `research`: planning work where the answer is not decided yet
- `decision`: an architectural or product choice

Use tags for areas and facets:

- `api`, `security`, `permissions`, `users`, `user-groups`
- `uiux`, `admin`, `public`, `checkout`, `payments`, `receipts`
- `supabase`, `venue-cloud`, `inventory`, `tabs`
- `docs`, `architecture`, `technical-doc`
- `workflow`, `error-handling`, `data-loss`, `styling`

This keeps an item like "service-role routes lack venue checks" as a `bug`
while still tagging it with `api`, `security`, `permissions`, and `supabase`.

## Status Rules

- `new`: captured but not discussed in detail
- `discussing`: actively being shaped with product/architecture questions
- `planned`: agreed direction, not being implemented yet
- `in_progress`: implementation or detailed writing is underway
- `blocked`: cannot proceed without missing information or external state
- `implemented`: code/docs exist, but verification is not complete
- `verified`: finished state and verification evidence are filled in
- `closed`: no further work needed
- `wont_do`: intentionally rejected or deferred out of scope

Hard rule: no item moves to `verified` unless `finished_state` and
`verification` are filled in.

The database enforces this rule with a CHECK constraint.

## How To Write Items

Every meaningful item should explain:

- `problem`: what is wrong, missing, risky, or desired
- `desired_outcome`: how it should behave
- `current_state`: what the code or product does now
- `implementation_notes`: the intended approach or important constraints
- `finished_state`: how the module/feature works after completion
- `verification`: build, test, manual check, screenshot, or review evidence

Use `events` for progress notes and discussion history. Do not bury important
decisions only in chat.

## Technical Documentation Rule

The tracker should contain enough structured information to generate or rewrite
human technical docs later.

For every module-level feature or fix, the finished state should answer:

- What does this module or feature do?
- Who uses it?
- Which routes, services, stores, and database tables does it touch?
- What permissions apply?
- What failure states exist and how are they handled?
- How was it verified?

## Common Commands

List all open work:

```bash
sqlite3 tracking.db "
  SELECT code, status, priority, module, title
  FROM items
  WHERE status NOT IN ('verified', 'closed', 'wont_do')
  ORDER BY id;
"
```

Show one item with tags:

```bash
sqlite3 tracking.db "
  SELECT i.code, i.primary_type, i.status, i.priority, i.module, i.title,
         group_concat(t.name, ', ') AS tags,
         i.problem, i.desired_outcome, i.current_state,
         i.implementation_notes, i.finished_state, i.verification
  FROM items i
  LEFT JOIN item_tags it ON it.item_id = i.id
  LEFT JOIN tags t ON t.id = it.tag_id
  WHERE i.code = 'ONM-1'
  GROUP BY i.id;
"
```

Add a progress event:

```bash
sqlite3 tracking.db "
  INSERT INTO events(item_id, event_type, note)
  SELECT id, 'progress', 'Short progress note here.'
  FROM items
  WHERE code = 'ONM-1';
"
```

Mark an item verified:

```bash
sqlite3 tracking.db "
  UPDATE items
  SET status = 'verified',
      finished_state = 'Describe the final implemented behavior.',
      verification = 'Describe the proof: tests, build, manual check, screenshot, etc.'
  WHERE code = 'ONM-1';
"
```

## Current Documentation Direction

The old markdown docs are stale. Track their replacement under `ONM-2`.

Until that is resolved, treat `tracking.db` plus this guide as the maintained
technical source of truth. The old docs may be archived, removed, or replaced
with a short current architecture document derived from tracker content.
