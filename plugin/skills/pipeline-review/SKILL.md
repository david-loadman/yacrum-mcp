---
name: pipeline-review
description: The weekly pipeline review from Yacrum — what moved, slipped, closed and appeared since last week, the pipeline and forecast now, and what needs attention — as a chat summary and a shareable report, with coaching tasks and opportunity updates the user confirms. Use for a weekly sales meeting, a one-to-one with a rep, or when asked what changed in the pipeline.
argument-hint: "[team | <rep name>] [since YYYY-MM-DD]"
---

# Weekly pipeline review

## 1. Whose pipeline, since when

Call `whoami`.
- **Scope:** `team` for Admin or Management unless they name a rep. For one rep, use `scope: "team"` with
  `salesPersonId`; `search` or `list_opportunities` gives the id. Otherwise use `mine`.
- **Since:** a date in `$ARGUMENTS`, or a week ago by default.

## 2. Read

1. **`pipeline_changes`** with that scope and since.
   - The outcomes are `new`, `advanced`, `regressed`, `won`, `lost`, `paused` and `removed`, plus the
     `slipped` and `amountChanged` flags.
   - It also gives the open pipeline's totals then and now, per currency and in the base currency.
   - **If it refuses with `not_found`:** no weekly snapshot is that old yet. The first is taken on a Monday.
     Say so, give `details.earliestSnapshot`, and continue with the rest.
2. **`pipeline_summary`**, with `salesPersonId` for one rep: open opportunities by stage.
3. **`forecast`**: this quarter's months. Cash appears only for Admin and Management.
4. **`get_signals`** with the same scope and `types: ["deal.slipping", "deal.stale", "deal.no_next_step", "quote.expiring"]`:
   what needs attention.

## 3. Summarise in the chat

- **The headline:** the pipeline then and now (count, amount and weighted), and the change. Keep each
  currency separate, or use the base figure, which converts both sides at today's rate.
- **Won and lost:** each with its amount, and the lost reason where one exists.
- **What moved:** advanced and regressed opportunities, and new ones.
- **What slipped:** each close date, from then to now.
- **Needs attention:** at most five items from the signals, each with the action it needs.
- **The forecast:** this month and next.

## 4. A shareable report

When the user wants something to share, turn the summary into a clean document using the
document or artifact tools available, with tables per section. Don't include any email addresses.

## 5. Coaching and updates, on confirmation

Propose these, and make each only when the user confirms:
- **Coaching tasks:** `create_action_item` for the rep who owns each item needing attention. Examples: "Agree
  a next step on <opportunity>" and "Confirm the close date for <opportunity>".
- **Opportunity updates:** `update_opportunity`, for example a new expected close date or probability the
  user gives you.
- **Stage moves:** `move_opportunity_stage`. Always confirm the stage by name first.
