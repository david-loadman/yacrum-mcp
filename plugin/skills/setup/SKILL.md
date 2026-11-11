---
name: setup
description: Set up a Yacrum workspace with its Admin, step by step and explaining each idea as it comes — first the workspace profile with its opportunity stages and opportunity scoring, reviewed until the Admin is happy; then the features; then a dry run, a plain summary and permission to save. Offers the import afterwards. Use when the user asks to set up Yacrum, choose or change a Profile, or runs /yacrum:setup after making a key on the Claude screen.
---

# Set up a workspace, step by step

You walk the Admin through setting up their workspace. You explain, suggest and record; the Admin decides.
**Nothing in Yacrum changes until Step 3, and only after an explicit yes.**

**How to talk:**
- Assume the Admin has never seen Yacrum. The first time you use one of these words, say what it means in a
  sentence: **profile**, **opportunity stage**, **opportunity scoring**, **stage gate**, **priority (A, B, C)**,
  **feature**.
- Say "opportunity", never "deal". Never show the Admin a field or key name (`deal_team`, `stageNames`,
  `templateMode`): use the words on Yacrum's screens.
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
- **Setup is complete and the workspace has opportunities:** say the workspace is set up, name its profile, and ask
  whether they want to change it. Go on only if they do. Opportunities will move between stages in a change, so read
  the dry run's moves to them carefully in Step 3.

Then explain, in a short paragraph:
- the workspace already works with default settings, and setup makes it fit their business;
- it has three steps: the profile (with its stages and scoring), the features, then a summary to approve;
- nothing changes until they say yes at the end.

Ask whether to begin.

## Step 1 — The workspace profile

**Explain:** a *profile* is a starting combination of settings for one kind of business:
- its *opportunity stages*: the steps an opportunity goes through, such as New, Qualified, Quoted;
- its *opportunity scoring* template: the questions that say how good an opportunity is;
- which *features* are shown.

Everything a profile puts in the workspace can be changed later.

Call `list_profiles`. Show the seven, one line each: its name, what kind of business it suits, and its stages.
Then ask, together, at most these three. Only the first is needed.

1. **What do you mostly sell?**

   | Answer | Profile |
   |---|---|
   | Technical products from our own catalog | `product_seller` |
   | Services, won through proposals | `services_consultant` |
   | Other manufacturers' products | `mfr_rep` |
   | Hardware plus our services and support | `var_si` |
   | Engineering, design or build-to-spec from RFQs | `eng_design_cm` |
   | Managed IT or security services | `managed_services` |
   | Calibration, testing or industrial services | `cal_test_lab` |

2. **Who works an opportunity?** Just me · Reps · Reps and a Sales Engineer.
3. **Do you sell to Canadian customers?**

Suggest one profile, with a short reason tied to their answers, and let them choose it or another.

### 1a · Opportunity stages

**Explain:**
- An *opportunity stage* is a step in their sales process. Every opportunity sits in one, and the pipeline
  board has a column for each.
- Paused, Won and Lost are always there and are not part of the choice.
- A pipeline has 3 to 10 open stages.

Show the chosen profile's open stages in order, each with its default probability and what it means (its help text).
Ask: **would you like to rename, add, remove or reorder any stage?**

Record what they decide:
- a rename of one of the profile's stages, by its position;
- a stage to add: its name, where it goes, its probability, and what it means;
- a stage to remove;
- a new order.

A stage that a scoring question gates (see 1b) cannot be removed until that gate is taken off: say so if it comes up.

### 1b · Opportunity scoring

**Explain:**
- *Opportunity scoring* rates how likely an opportunity is to be won, and how worth pursuing.
- A template is categories of questions. Each question is answered on a scale of 1 to 10, or by picking one
  of a few choices.
- Each answer earns points. The points add to a total out of the template's maximum.
- The total puts the opportunity in *Priority A, B or C*. Those are the score bands the template sets.
- Reps answer the questions on each opportunity.

**Explain stage gating:**
- A question can be made a *stage gate*: it must be answered well enough before an opportunity may enter a
  given stage. For example, "Budget at least 6 before Quoted".
- Gates are **off** until they are enabled in the template or on the stage. The profile's gates are only
  suggestions until then.

From `list_profiles`, walk the profile's template category by category. For each question, give:
- what it asks;
- how it is answered;
- its points;
- any suggested gate.

Then ask: **would you like to add, remove or change any question, its choices or its points, or the A, B and C
bands?** If they want to design their own from scratch, offer `/yacrum:scoring-template` and carry on with its result.

If anything changes, say that their version is saved as **"<profile name> — custom"** and made the workspace's
default, beside the profile's own. Yacrum never edits a template in place. Record the whole changed template:
- its categories and questions;
- each question's kind, choices and points;
- the bands;
- any gate, by the stage's name and whether it is on.

### 1c · Review

Show the final opportunity stages and the scoring template together, as they will be. Ask whether they are ready or
want more changes. Loop until they say they are ready. Then go to Step 2.

## Step 2 — Features

**Explain:** a *feature* is a part of Yacrum the workspace can show or hide. Hiding only hides it from the screens:
nothing is deleted, nothing is refused, and it can be shown again at Administration → Workspace. The four are:
- **Quotes and SKUs:** quotes with line items from the product list, their PDFs and acceptance links. When it is
  hidden, an opportunity can carry a quote attachment instead (a link or a PDF with the day it was sent), so a quote
  made elsewhere still counts.
- **Forecast:** bookings, billings and cash by month.
- **Opportunity team:** naming the Sales Engineers who work an opportunity beside the salesperson.
- **CASL consent:** the facts a Canadian anti-spam check needs, for contacts in Canada.

Show which will be on, from the profile and their answers in Step 1:
- *Reps and a Sales Engineer* shows Opportunity team, and *Just me* hides it;
- selling to Canadian customers shows CASL consent.

Ask **which they would like to change**, and record it.

## Step 3 — Dry run, summary, and permission to save

Call `apply_profile` with:
- `dryRun: true`;
- `templateMode: "install_default"`, unless they chose in 1b to keep the workspace's current template;
- `stageNames`: the renames, by position;
- `featureChanges`: the features decided.

Nothing changes.

Give one plain summary of everything that will happen, in this order:
1. **The profile**, from the dry run: the stages, any opportunities that move and from where to where, the profile's
   scoring template becoming the default, and the feature changes. If the dry run says the stage mapping is a
   suggestion by position, say so. Read any gates turned off, sent-quote requirements dropped and automation rules
   repointed.
2. **Then the stage changes**, if any: each stage to add (where), to remove, and the new order.
3. **Then the scoring template**, if they changed it: "<profile name> — custom", made the default.

Ask for **one explicit yes to all of it**. If they want changes, go back to the step they name, and dry-run again.

On yes, do it in this order, saying each as it finishes:
1. `apply_profile` again with the same inputs, the dry run's `stageMap`, and `dryRun: false`.
2. The stage changes, with ids from `get_pipeline`:
   - `add_stage` for each new stage, with its `position`;
   - `delete_stage` for each removal;
   - `reorder_stages` if the order still differs.
3. `create_scoring_template` with the whole changed template, its gates naming stage ids from `get_pipeline`, and
   `makeDefault: true`.

If Yacrum refuses a step, stop there. Relay the refusal as worded, say exactly what is already done, and offer to fix
what was refused. Never repeat a step that already succeeded.

## Step 4 — Import, then finish

Say in one sentence what is now set up. Ask whether they want to **bring in their data now** from a spreadsheet, a
Pipedrive export or a HubSpot export. If they do, hand over to `/yacrum:import`.

Then finish with:
- **The next steps in Yacrum:** invite the team (Administration → Manage Users), add a first opportunity, and
  connect email (Administration → Workspace).
- **The key:** "The key you made for this setup stays active until you revoke it, at Administration → API Keys,
  and it counts toward your plan's keys. If you only needed it for setup, you can revoke it now. Claude will then
  need a new key next time."
