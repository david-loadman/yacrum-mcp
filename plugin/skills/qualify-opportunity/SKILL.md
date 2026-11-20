---
name: qualify-opportunity
description: Qualify an opportunity in Yacrum with the rep — work through the twelve Qualification questions (Need, Economic impact, Access to authority, Timeline) using what Yacrum and the rep know, propose each answer with its evidence, notes and the people it is about, save only what the rep confirms, then offer the stage gates that are met and a Sales Health update; Fit scoring on request. Use when the user wants to qualify, score or re-score a deal, or asks what a deal needs before it can move to the next stage.
argument-hint: "<opportunity name or id>"
---

# Qualify an opportunity

You help the rep qualify an opportunity honestly. You propose; the rep decides. **Nothing is saved, no stage moves,
and no Sales Health changes without the rep's yes.**

Every opportunity has two scores, read apart:
- **Qualification** asks *is the deal real?* Does the buyer have a real, funded, reachable, time-bound reason to buy?
  It is out of 100, with a **weakest letter**. Only Qualification gates a stage, and it is what Yacrum proposes Sales
  Health from.
- **Fit** asks *do we want it?* How well does it serve the business's own goals? It ranks opportunities as
  **Priority A, B or C**. ⛔ **Fit never gates a stage and never sets Sales Health.**

Call the first one "Qualification", never by any other name.

## 1. Find it, and read everything

- The user names the opportunity in `$ARGUMENTS` or in the conversation. Find its id with `search`; ask if several match.
- Call `deal_context` and `qualification_score`. Note:
  - the opportunity's stage and its Sales Health (`status`, `statusDescription`)
  - `qualification`: each answer so far, its notes and contacts, the score, the weakest letter, and the Sales Health
    `proposal`
  - `fit`: the Fit template's answers and tier, or null
  - `gates`: the stage gates ahead
  - the notes, recent activity, quotes and contacts. These are your evidence.
- Call `list_scoring_templates` for the questions as this workspace has them: each one's help text, whether it is on,
  whether it takes contacts, and its gate. Skip a question that is switched off.

## 2. The scale

Every Qualification question is answered on one scale, for **how well we know it**:

| Answer | Means |
|---|---|
| **0 · Unknown** | Not established. A question never answered is 0 |
| **1 · Claimed** | Our belief, or our contact's word |
| **2 · Confirmed** | Confirmed by the buyer |
| **3 · Documented** | Confirmed and written down, or backed by a second stakeholder |

Say once, early: a high score means *well qualified*, not *likely to win*. A buyer who has confirmed they have no
budget is a real finding: answer how well it is known, and put the news in the notes.

## 3. Work through the questions

Go letter by letter, **Need, Economic impact, Access to authority, Timeline**, in key order (N1 to T3). For each:
- **Say what it asks**, with the workspace's help text: what earns a 2 and a 3 for that question.
- **Propose an answer, 0 to 3,** with the evidence in one line, such as "the 14 Oct note says the CFO approved the
  budget: 2 · Confirmed". If there is no evidence, say so and ask the rep. **Never guess a higher answer to clear a
  gate.**
- **Propose notes:** the details in a sentence or two, in the rep's words where you have them (the pain, the number,
  the event and its date).
- **Where the question takes contacts** (N2 the problem owner and stakeholders, A1 the approver and signer, A2 the
  champion, A3 the buying group, T2 the accountable person), propose the people it is about by name. Take them from
  the opportunity's company first (`deal_context`, `list_contacts`), and search the whole workspace when the rep names
  someone else, such as a partner's person. Ask before guessing.
- **If the question has a stage gate with `enabled` true**, say so: "required to enter Proposal: at least 2 ·
  Confirmed", and whether your proposed answer passes. **With `enabled` false, the gate is only suggested** and holds
  nobody: don't call it required.
- **Keep the pace brisk.** Group the questions you have good evidence for and ask the rep to confirm them together.
  Ask about the rest one at a time.

An answer the rep already gave is kept unless they change it. Show the running score and the weakest letter as you
go, if it helps.

## 4. Save what the rep confirmed

- Call `score_opportunity` once, with `qualification`: only the questions the rep confirmed, each with `answer`,
  `notes` and, where it applies, `contactIds`. A question not sent keeps what it had. Sending `contactIds` replaces the
  question's people, so send the whole list.
- **If Yacrum refuses** (for example, a role that may not qualify), relay the reason as worded. Don't retry as
  someone else.
- Report the result: the score out of 100, each letter, and the weakest letter, as "68 · weak on Access".

## 5. The gates, and the offer

- **Call `stage_readiness`.**
- **When `readyFor` is set:** say "Every gate of <stage> is met" and **offer** the move. Make it with
  `move_opportunity_stage` only if the rep says yes. Never move it on your own: a met gate is offered, never applied.
- **When it is not:** list what the next stage still needs: each unmet question by key and label, what passes
  ("at least 2 · Confirmed") and the answer now, and "a sent quote" where a stage asks for one. Suggest the action that
  would meet it, such as "meet the CFO with your champion" or "send the quote". Offer to `create_action_item` for it on
  confirmation.
- **Overriding a gate:** only an Admin or a Management member may move past an unmet gate, with a reason.
  - Check `whoami`.
  - Offer the override only to those roles, and only with a reason the rep gives in their own words, passed as
    `overrideReason`.
  - Never suggest overriding to a Sales rep, and never write the reason for them.

## 6. Sales Health

Read the saved `proposal` from the result (or `qualification_score`). Yacrum proposes Green, Yellow or Red from the
score, the weakest letter and how recently the answers changed; it never sets one itself.
- Compare it with the opportunity's Sales Health now. If they differ, or the rep's note is out of date, **propose** a
  status and a one-line note saying why, such as "Yellow: 58, weak on Access; we have not met the signer".
- Write it with `set_sales_health` **only after the rep approves that change** in this conversation. The rep may pick
  another colour or word the note their way: use theirs. Never set it from Fit.

## 7. Fit, if the rep wants it

Fit is separate, and optional here. Offer it only once Qualification is done, or when the rep asks.
- Use the opportunity's Fit template (`fit.frameworkId`), else the default from `list_scoring_templates`. Another
  template only if the rep asks for one: switching a scored opportunity deletes its Fit answers, so say so and get a yes
  first.
- For each question propose an answer (1 to 10 for a scale question, one of its options by label for a select one)
  with its reason, and a note where the rep gave one.
- Save the confirmed answers with `score_opportunity` and `fit`: `answers` by question id (option ids for select
  questions), `answerNotes` by question id, and `templateId` only when it is not the default or is being switched.
- Report its percent and tier. Fit gates nothing and moves no Sales Health.

## 8. Log it

Offer `log_activity` on the opportunity: "Qualified: <score> · weak on <letter>" (and "Fit <tier>" if scored), plus
anything the rep learned. Do it only if they agree.
