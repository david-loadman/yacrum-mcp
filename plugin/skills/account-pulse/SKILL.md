---
name: account-pulse
description: A one-page brief on a customer or prospect before a meeting — what Yacrum knows (opportunities, quotes, open items, recent activity), the last email thread, and fresh news from the web — with attendees, risks and three questions to ask. Use when the user is preparing for a call or meeting, or asks how an account is doing.
argument-hint: "<company name, or 'next meeting'>"
---

# Account pulse

## 1. Which account

- **The user names a company** (`$ARGUMENTS`): `search` for it.
- **They say "my next meeting" or "today's meeting":** read their calendar through their calendar connector,
  if one is available, and take the next external meeting. The company is the attendees' email domain, which
  you match with `search`.
- **No calendar connector:** ask which company.

## 2. Gather

Read these in Yacrum:
1. `get_company`.
2. `list_opportunities` for the company. Use all kinds, then focus on the open and paused ones.
3. `deal_context` for each open opportunity, at most three of them, the largest first.
4. `list_quotes` for those opportunities.
5. `list_action_items` with `companyId` and `status: "Open"`.

Read these elsewhere:
- **Mail:** the last thread with the company's contacts, through the rep's mail connector.
- **The web:** recent news about the company from the last three months, such as funding, hiring, leadership
  changes, product launches, acquisitions and layoffs. Cite each source. Leave out anything you can't attach
  to this company with confidence.

## 3. Write the brief

One page, in this order:
- **Who:** the attendees and their roles, with the Yacrum contacts matched.
- **Where things stand:**
  - each open opportunity: its stage, amount, expected close, qualification tier and Sales Health (G/Y/R and its note, from `deal_context`)
  - the latest quote and its status
  - the last activity, and when it was
- **Open items:** the action items, with their owners and due dates.
- **What's new:** the news, with links.
- **Risks:** stale activity, a slipping close date, an expiring quote, a weak qualification answer, a
  competitor named.
- **Three questions to ask:** specific to this account, each tied to a risk or an open item.

## 4. Offer to log it

Offer `log_activity` on the company: "Pre-call brief: <meeting>", with the three questions. Do it only if
the rep agrees.

If what you found contradicts an opportunity's Sales Health, for example a G opportunity with a lost
champion, propose a new status and its note. Write it with `set_sales_health` only if the rep agrees.
