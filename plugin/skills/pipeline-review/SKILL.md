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

Make **all five** reads before writing anything. Don't skip one to save time: each feeds a section below, and a
skipped read makes its section look empty when it isn't.

1. **`pipeline_changes`** with that scope and since.
   - The outcomes are `new`, `advanced`, `regressed`, `won`, `lost`, `paused` and `removed`, plus the
     `slipped` and `amountChanged` flags.
   - It also gives the open pipeline's totals then and now, per currency and in the base currency.
   - **If it refuses with `not_found`:** no weekly snapshot is that old yet. The first is taken on a Monday.
     Say so, give `details.earliestSnapshot`, and continue with the rest.
2. **`pipeline_summary`**, with `salesPersonId` for one rep: open opportunities by stage.
3. **`forecast`**: this quarter's months. Cash appears only for Admin and Management.
4. **`stage_readiness`** for each open opportunity in scope: the largest ten by amount when there are more.
   It shows what is ready to advance and what is blocked by a stage gate.
5. **`get_signals`** with the same scope and `types: ["deal.slipping", "deal.stale", "deal.no_next_step", "quote.expiring"]`:
   what needs attention.

## 3. Summarise in the chat

Give **every** section below, in this order, under its own heading. When a section has nothing in it, write
"None this week": a section left out reads as nothing to report.

- **The headline:** the pipeline then and now (count, amount and weighted), and the change. Keep each
  currency separate, or use the base figure, which converts both sides at today's rate.
- **Won and lost:** each with its amount, and the lost reason where one exists.
- **What moved:** advanced and regressed opportunities, and new ones.
- **What slipped:** each close date, from then to now.
- **Needs attention:** at most five items from the signals, each with the action it needs.
- **Sales Health:** the open opportunities marked R (off track) or Y (at risk), with each note. `list_opportunities`
  carries it as `status` and `statusDescription`. Name any whose health the week's changes now contradict, such
  as a G opportunity that slipped twice.
- **Ready to advance:** each opportunity whose `readyFor` is set. Name the stage it can move to. Offer the move;
  never make it unasked.
- **Blocked by a gate:** each opportunity whose next stage has an unmet gate. Name what is missing (a scoring
  answer, or a sent quote) and the action that would meet it.
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
- **Sales Health:** `set_sales_health`, with the status and a one-line note together. Propose the new status
  and the note, and write it only when the user confirms. Never change it on your own reading alone.
- **Stage moves:** `move_opportunity_stage`. Always confirm the stage by name first.
- **Scoring:** for a blocked opportunity whose rep wants to work it through, suggest `/yacrum:qualify-opportunity`.
- **A gate override** (`overrideReason`): only for an Admin or a Management user (`whoami`), and only with a
  reason they give. Never for a Sales rep.
