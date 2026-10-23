---
name: morning-signals
description: The morning brief from Yacrum — what is worth doing today and why (quiet or expiring quotes, stale or slipping opportunities, lost or paused ones to revisit, dormant customers, renewals, referrals), ranked with judgment, each with a draft, a task or a snooze on offer. Use when the user asks what to work on, for their signals, their morning brief, or as a scheduled weekday task.
argument-hint: "[team]"
---

# Morning signals

The rules for any email you draft are in the `outreach-rules` skill. Follow them.

## 1. Who is asking

Call `whoami`. If the user passed `team` (`$ARGUMENTS`), or their role is Admin or Management and they ask
about the team, use `scope: "team"`. Otherwise use `scope: "mine"`.

## 2. Read the signals

Call `get_signals` with that scope and `limit: 50`. If `nextCursor` is set and fewer than 15 came back after
your filtering, read one more page. Snoozed signals are already left out.

If there are none, say so in one line and stop. Something like: "Nothing needs you today. Your pipeline is up
to date."

## 3. Rank with judgment

Yacrum's `priority` is a starting point. Re-rank using:
- money and stage
- how soon something expires or slips
- whether the same opportunity has several signals (merge them into one item)
- the reason text

Pick **at most 7** for today. For the team view, group them by `owner`.

## 4. Present them

For each item, give:
- **Title:** the company and the opportunity or quote, with the amount in its own currency.
- **Why now:** the `reason`, and one sentence of your own judgment.
- **The move:** the suggested action in your words.
- **For a Canadian contact:** the consent facts, as `outreach-rules` §5 says.
- **Options:** *Draft it* · *Make it a task* · *Snooze* (offer 3 days, 1 week or 2 weeks).

End with the counts by type for anything you left out, e.g. *"Also: 4 stale opportunities, 2 referrals."*

## 5. Act on what the rep picks

- **Draft it:**
  1. `deal_context` for the opportunity.
  2. The rep's recent sent mail and their last thread with the contact.
  3. Draft with the BCC, then `log_activity`, as `outreach-rules` says.
- **Make it a task:** `create_action_item` on the opportunity, with a short title, a due date (tomorrow
  unless the rep says otherwise) and the reason as the description.
- **Snooze:** `snooze_signal` with the signal's `id` and an `until` date. It comes back early if anything
  happens on the record.

## Running it as a scheduled task

When run unattended (a scheduled weekday brief):
- Present the list only.
- Make no drafts, tasks or snoozes.
- End with: "Reply with the numbers to draft, task or snooze."
