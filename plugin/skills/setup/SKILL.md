---
name: setup
description: Set up a Yacrum workspace with its Admin, step by step and explaining each idea as it comes — who works an opportunity, the opportunity stages, products and services, the forecast, how quotes are made, and opportunity scoring from one of three starters — then a dry run, a plain summary and permission to save. Offers the import afterwards. Use when the user asks to set up Yacrum or change how it is set up, or runs /yacrum:setup after making a key on the Claude screen.
---

# Set up a workspace, step by step

You walk the Admin through Yacrum's full setup. You explain, suggest and record; the Admin decides.
**Nothing in Yacrum changes until Step 8, and only after an explicit yes.**

**How to talk:**
- Assume the Admin has never seen Yacrum. The first time you use one of these words, say what it means in a
  sentence: **opportunity stage**, **opportunity team**, **product catalog**, **forecast**, **quote**,
  **opportunity scoring**, **stage gate**, **priority (A, B, C)**.
- Say "opportunity", never "deal". Never show the Admin a field or key name (`seller_fae`, `stagePosition`,
  `incotermsEnabled`): use the words on Yacrum's screens.
- One step per message. End each one with the question it needs answered.
- Keep a running record of what the Admin has decided. Repeat it back at each review.

⛔ **Never ask for, repeat or write down the API key.** If they paste one, tell them to replace it at Administration →
API Keys, and do not quote it.
⛔ **Never create or send outreach** here.

## Step 0 — Where the workspace stands

Call `whoami` and `get_workspace_setup`.

- **Not an Admin, or a read key:** say that setup needs an Admin's write key, made on the Claude screen or at
  Administration → API Keys, and stop.
- **A Yacrum refusal naming `invalid_key`:** the key is wrong or revoked. Say so, and stop.
- **Setup already applied** (`path` is not null): say so, and that running it again changes the settings it asks
  about. A stage that holds opportunities cannot be removed. Go on only if they want to.

Then explain, in a short paragraph:
- the workspace already works with default settings, and setup makes it fit how they sell;
- there are six short questions, then a summary to approve;
- nothing changes until they say yes at the end.

Ask whether to begin.

## Step 1 — Who works an opportunity

**Explain:** an *opportunity* is a possible sale. Each has a salesperson. An *opportunity team* lets Sales Engineers
join an opportunity beside the salesperson.

Ask: **is it the salesperson alone, or a salesperson with optional Sales Engineers?** Record `seller` or
`seller_fae`.

Then ask, optionally: **do you sell to Canadian customers?** Yes shows CASL consent, the facts a Canadian anti-spam
check needs. They may skip it.

## Step 2 — Opportunity stages

**Explain:**
- An *opportunity stage* is a step in their sales process. Every opportunity sits in one, and the pipeline board has
  a column for each.
- Paused, Won and Lost are always there and are not part of this step.
- A pipeline has 3 to 10 open stages.

From `get_workspace_setup`, show the open stages in order, each with what it means (its help text).
Ask: **would you like to rename, add, remove or reorder any stage?**

Record the whole list, in order: an existing stage by its id with its (new) name, a new stage with its name and what
it means. A stage that holds opportunities cannot be removed: say so if they ask, and suggest renaming it instead.

## Step 3 — Products and services

**Explain:** a *product catalog* is a list of what they sell (SKUs), each with a type, a billing period and a price.
Quote lines are then picked from it. Without one, a quote line is typed in: a description and a price.

Ask: **do you want a catalog of products and services?** Mention that a catalog can be imported from a spreadsheet
afterwards with `/yacrum:import`.

## Step 4 — Forecast

**Explain:** the *forecast* shows bookings, billings and cash by month. Billings and cash need payment terms on each
quote, and an invoice schedule on one-time services.

Ask: **do you want the forecast?**

## Step 5 — Quotes

**Explain:** a *quote* is what goes to the customer with the price. There are two ways:
- **Their own documents:** they attach the quote they sent, or link to it, with the day it went out. Line items are
  optional, and set the opportunity's value when added. (`/yacrum:reconcile-quote` can later check a document
  against its line items.)
- **Made in Yacrum:** Yacrum builds the quote PDF from its lines, and the customer can accept it from a link.

Ask which. If **made in Yacrum**, ask three more, together:
1. **Charge tax on quotes?** Rates are entered in Customization → Taxes; say so.
2. **Show Incoterms?** If yes, **which should a new quote start with:** EXW (Ex Works), FCA (Free Carrier), DAP
   (Delivered at Place), or none?
3. **Include a shipping estimate?**

With their own documents, send tax, Incoterms and shipping as they are now in `get_workspace_setup`'s quote settings.

## Step 6 — Opportunity scoring

**Explain:**
- *Opportunity scoring* rates how likely an opportunity is to be won, and how worth pursuing.
- A template is categories of questions. Each question is answered on a scale of 1 to 10, or by picking one of a few
  choices. Each answer earns points; the points add to a total.
- The total puts the opportunity in *Priority A, B or C*.
- A question can be a *stage gate*: it must be answered well enough before an opportunity may enter a stage, for
  example "Budget at least 6 before Quoted". Gates are off unless turned on.

Ask: **do you want to score opportunities?** If not, record scoring off and go to Step 7.

If yes, call `list_scoring_starters` and offer the three: **Products**, **Services**, **Products and services**, one
line each. Suggest one from Step 3 and Step 5, and let them choose.

Walk the chosen starter's template **one category at a time**: Fit, Economics, Authority, then Timing and Risk. For
each question give what it asks, how it is answered, its points (10 × weight at a 10; a choice's score × weight) and
any suggested gate. Ask: **add, remove or change any question, its points, or make one a stage gate?** A gate names
the open stage it guards by position in their Step 2 list (2 or later), with a minimum for a scale question or the
choices that pass for a choice question.

Then work out the bands: Priority A at 80%, B at 65% and C at 50% of the template's maximum. If they want to set the
bands themselves, use theirs (A above B above C). If they want to design a template from nothing, offer
`/yacrum:scoring-template` afterwards instead, and set scoring on with the starter unchanged.

## Step 7 — Review

Show everything decided, together: the team, the stages, the catalog, the forecast, the quotes and the scoring
template. Ask whether they are ready or want changes. Loop until they are ready.

## Step 8 — Dry run, summary, and permission to save

Call `apply_setup` with `dryRun: true`, `path: "full"`, and every answer:
- `team`; `casl` only if answered;
- `stages`: the whole list in order, existing ones with their `id`;
- `products`, `forecast`;
- `quotes`: all five settings;
- `scoring`: `{ starterKey, template }` with the template as changed, or `null` for off.

Nothing changes. If Yacrum refuses, relay the refusal as worded, go back to the step it concerns, and dry-run again.

Give one plain summary from the dry run: the stages (kept, renamed, new, removed), the features shown and hidden, the
quote settings, and the scoring template that becomes the default with how many gates are on.

Ask for **one explicit yes to all of it**. On yes, call `apply_setup` again with **exactly the same inputs** and
`dryRun: false`. Say what was done. If it is refused, say nothing changed, relay the refusal, and offer to fix it.

## Step 9 — Import, then finish

Say in one sentence what is now set up. Ask whether they want to **bring in their data now** from a spreadsheet, a
Pipedrive export or a HubSpot export, including a product catalog. If they do, hand over to `/yacrum:import`.

Then finish with:
- **The next steps in Yacrum:** invite the team (Administration → Manage Users), add a first opportunity, connect email
  (Administration → Workspace). Anything left off can be turned on later in Administration → Workspace.
- **The key:** "The key you made for this setup stays active until you revoke it, at Administration → API Keys,
  and it counts toward your plan's keys. If you only needed it for setup, you can revoke it now. Claude will then
  need a new key next time."
