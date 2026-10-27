---
name: re-engage
description: Re-engage a lost, paused or quiet opportunity or quote in Yacrum — read its whole context, pick the right contact, draft a one-to-one email in the rep's own mailbox with the logging BCC, log it, set a follow-up, and reopen the opportunity only if the rep agrees. Use when the user wants to revive, follow up on or re-open a deal.
argument-hint: "<opportunity name or id>"
---

# Re-engage an opportunity

The rules for any email you draft are in the `outreach-rules` skill. Follow them.

## 1. Find the opportunity

The user names it in `$ARGUMENTS` or in the conversation. Use `search` to find its id. Ask if several match.
You may have come here from a signal; if so, keep its id for the log.

## 2. Read everything

Call `deal_context`. It returns:
- the opportunity
- its company and primary contact
- its stage history
- the quote
- the qualification
- open action items, notes and recent activity

Also call `get_outreach_settings` for the style guide. Its BCC address is read again just before the draft
(step 4): never reuse one read earlier (`outreach-rules` §2).

From this, work out:
- **What happened:**
  - Lost: the reason and the competitor.
  - Paused: the pause reason and when it paused.
  - Quiet quote: when it was sent and whether it has expired.
- **What has changed since:** time passed, new notes, news about the company. Use web search for news when
  it would help.
- **Who to write to:** usually the primary contact, or the quote's contact for a quote. Choose someone else
  only with a reason, and say what it is.

## 3. Propose the angle

In two or three lines, tell the rep why now and what the email will say. Wait for a yes, or for their change.

## 4. Draft, log, follow up

1. Read the rep's recent sent mail and their last thread with this contact.
2. Call `get_outreach_settings` again, then create the draft in the rep's mailbox with its BCC. Show the subject and body in the chat as well.
3. `log_activity` on the opportunity.
4. Offer `create_action_item`: "Follow up with <contact> if no reply", due in 5 business days unless the rep
   says otherwise.

## 5. Reopen only if asked

If the rep wants the opportunity back in the pipeline:
1. `get_pipeline` for the open stages.
2. Confirm the stage by name, then call `move_opportunity_stage`.

A lost or paused opportunity moving back to an open stage is a real change to the pipeline and the forecast.
Never do it without the rep's clear yes.
