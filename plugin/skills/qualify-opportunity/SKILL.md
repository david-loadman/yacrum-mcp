---
name: qualify-opportunity
description: Score an opportunity in Yacrum against its scoring template with the rep — work through each question using what Yacrum and the rep know, propose every answer with its reason, save only what the rep confirms, then say which stage gates are met and offer the next move. Use when the user wants to qualify, score or re-score a deal, or asks what a deal needs before it can move to the next stage.
argument-hint: "<opportunity name or id>"
---

# Qualify an opportunity

You help the rep score an opportunity honestly. You propose; the rep decides. Nothing is saved, and no stage moves,
without the rep's yes.

## 1. Find it, and read everything

- The user names the opportunity in `$ARGUMENTS` or in the conversation. Find its id with `search`; ask if several match.
- Call `deal_context`. Note:
  - the opportunity's stage
  - its `qualification`: the template it is scored against and the answers so far, or null
  - `gates`: the stage gates ahead
  - the notes, recent activity, quotes and contacts. These are your evidence.
- Call `list_scoring_templates`.
  - **The template:** the one the opportunity is scored against, else the default.
  - **Another template:** only if the rep asks for one. Switching a scored opportunity deletes its answers, so
    say so and get a yes first.

## 2. Work through the questions

Go category by category, in the template's order. For each question:
- **Say what it asks**, with its guidance (`helpText`).
- **Propose an answer:** for a scale question a number from 1 to 10; for a select question one of its options,
  named by its label. Give the evidence in one line, such as "the 14 Oct note says budget is approved by the CFO".
  - If there is no evidence, say so and ask the rep. Never guess a high answer to clear a gate.
- **If the question is a stage gate**, say so: "required to enter Qualified: at least 7". Say whether your
  proposed answer passes.
- **Keep the pace brisk.** Group the questions you have good evidence for and ask the rep to confirm them
  together. Ask about the rest one at a time.

An answer the rep already gave is kept unless they change it.

## 3. Save what the rep confirmed

- Call `score_opportunity` once, with the confirmed answers by question id (option ids for select questions), and
  `templateId` only when it is not the default or the template is being switched.
- Add a short `notes` line if the rep gave reasons worth keeping.
- **If Yacrum refuses** (for example, a Sales member changing someone else's score), relay the reason. Don't retry
  as someone else.
- Report the result: the score, its **percent** of the template's maximum (what opportunities are ranked by),
  and its tier.

## 4. The gates, and the offer

- **Call `stage_readiness`.**
- **When `readyFor` is set:** say "Every gate of <stage> is met" and **offer** the move. Make it with
  `move_opportunity_stage` only if the rep says yes. Never move it on your own (Yacrum's rule: a met gate is
  offered, never applied).
- **When it is not:** list what the next stage still needs: each unmet question with what passes and the answer
  now, and "a sent quote" where a stage asks for one. Suggest the action that would meet it, such as "send the
  quote", or "confirm the budget sign-off with the CFO". Offer to `create_action_item` for it on confirmation.
- **Overriding a gate:** only an Admin or a Management member may move past an unmet gate, with a reason.
  - Check `whoami`.
  - Offer the override only to those roles, and only with a reason the rep gives in their own words, passed as
    `overrideReason`.
  - Never suggest overriding to a Sales rep, and never write the reason for them.

## 5. Log it

Offer `log_activity` on the opportunity: "Scored: <percent>% (<tier>) on <template>", plus anything the rep
learned. Do it only if they agree.
