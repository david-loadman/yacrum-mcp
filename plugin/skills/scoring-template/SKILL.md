---
name: scoring-template
description: Set up opportunity scoring with an Admin through an interview — first which of Yacrum's twelve Qualification questions apply to their business and any stage gates on them, then a Fit template built around the business's own goals (categories, questions, answers and points, the Priority A, B and C bands) — show each change whole, save it on a yes, and make the template the default if they want. Use when the user wants to design, build or customize a scoring, qualification or Fit template, or to set stage gates, or from /yacrum:setup.
---

# Set up opportunity scoring

You interview the Admin and draft. The Admin decides. **Nothing is saved until they say yes to that change, shown
whole.**

**How to talk:**
- Explain each idea the first time it comes up. Say "opportunity", never "deal".
- One topic per message, ending in its question.
- Keep the draft in front of the Admin as it grows.
- Call the first framework "Qualification", never by any other name.

## 1. What is there now

Call `list_scoring_templates` and `get_pipeline`. Then explain the two scores every opportunity gets, read apart:
- **Qualification: is the opportunity real?** Does the buyer have a real, funded, reachable, time-bound reason to buy?
  Twelve questions Yacrum sets, three for each letter: **Need, Economic impact, Access to authority, Timeline**. Each
  is answered 0 Unknown, 1 Claimed, 2 Confirmed or 3 Documented: how well it is known. The score is out of 100, each
  letter worth 25, with a weakest letter. It is what stage gates and the Sales Health proposal use.
- **Fit: do we want it?** How well the opportunity serves the business's own tactical and strategic goals. The
  workspace's own questions, answered 1 to 10 or by a choice; the points place it in **Priority A, B or C**, which ranks
  opportunities that compete for people and time. **Fit never gates a stage.**

Together: qualified and high Fit, pursue hard; qualified and low Fit, take it but don't over-invest; not yet qualified
and high Fit, invest in discovery; not qualified and low Fit, nurture or walk away.

Ask which they want to work on: **Qualification**, **Fit**, or both (Qualification first).

## 2. Qualification: which questions apply

The questions cannot be added, reworded or reordered, and the scale and the 25 points per letter are fixed. An Admin
may switch off a question that does not apply to their business, edit its help text, and set a stage gate on it.

- Go letter by letter. For each question give its label and its help text (what earns a 2 and a 3), and whether it is
  on now.
- Ask: **does each apply to how you sell?** Suggest leaving all twelve on unless the Admin has a clear reason.
- Switching one off makes the others in its letter share its 25 points; its answers are kept and come back if it is
  switched on again. **At least one question in each letter stays on**, and a question with a gate stays on (clear the
  gate first).
- **Help text**, if the Admin wants their own words for what earns a 2 and a 3. Restoring Yacrum's is always possible.

## 3. Qualification: stage gates, if any

**Explain:** a *stage gate* is a Qualification question that must be answered well enough before an opportunity may
enter a stage, for example "A1 at least 2 · Confirmed before Proposal". Gates hold every opportunity, are checked on
every forward move, and only an Admin or a Management member may move past one, with a reason. **No gate is on unless
the Admin sets one.** A gate can also be kept off, as a suggestion.

For each gate the Admin wants, settle:
- the question, by key and label;
- the stage it guards, by name from `get_pipeline` (open or Won);
- the minimum: 1 Claimed, 2 Confirmed or 3 Documented;
- whether it is on now, or kept off as a suggestion.

Don't suggest gates the Admin did not ask about.

## 4. Qualification: Sales Health thresholds, if asked

Yacrum proposes Sales Health from the Qualification score; a person always decides. Show the current thresholds from
`settings`: Green at a score of `greenMin` or more with no letter under `greenLetterMinPct`% of its 25; Red under
`redBelow`, or no answer changed in `staleDays` days at a late stage; Yellow otherwise. Change them only if the Admin
asks.

## 5. Save Qualification

Show every Qualification change together: the questions switched off or on, the help text changed, each gate (question,
stage, minimum, on or off), and any threshold. Say that a gate holds every opportunity from now on.

On an explicit yes, call `update_qualification_settings` with `questions` by key (`enabled`, `helpText`, `gate` with
the stage's `stageId` and `minValue`, `gateEnabled`) and `settings`. If Yacrum refuses, it names the question and why
(the last one on in a letter, or a gated question): the ones before it stand. Relay it as worded, fix it with the
Admin, and send the rest.

## 6. Fit: the business's goals

Fit is the Admin's own. Say which template is the default now, and how many the workspace has: at most ten. Ask
whether to **start from the current default** (customizing it) or **from scratch**.

Ask what makes an opportunity worth winning for *them*, a few at a time:
- What can they deliver with what they sell today, and what stretches them?
- Capacity: the sales and delivery people, and when.
- Margin and return on effort.
- Risk they would carry: technical, contractual or financial.
- Their ideal customer, follow-on potential, and strategic value (a reference, a logo, a new market).
- The relationship, and where they stand against the alternatives.

Leave the buyer's need, budget, access and timing out of Fit: Qualification asks those.

From the answers, **propose 2 to 4 categories with 2 to 5 questions each** (at most 30 questions in all). Yacrum's
default is ten questions in Tactical and Strategic, equal weights. Name each question as a rep would ask it, with one
line of guidance that anchors the scale, such as "10 above target · 7 at target · 4 below target · 1 at or near cost".
When starting from the current template, show it first and propose only the changes.

## 7. Fit: each question's answers and points

For each question, settle:
- **Scale or choices.** On a scale of 1 to 10, the answer times its *weight* is its points: weight 1 makes 10 the most.
  With choices, there are two or more, each with its own points; points may be negative for a choice that counts
  against.
- **Guidance**, if the wording needs it.

A Fit question is never a stage gate. If the Admin asks for one, offer a Qualification gate instead (step 3).

## 8. Fit: the priority bands

Total the most the template can score. Propose where Priority A, B and C start, A highest, then B, then C: 80%, 65%
and 50% of the total. Adjust as the Admin asks.

## 9. Save Fit

Show the whole template:
- its name;
- the categories and questions, each with its answers, points and guidance;
- the A, B and C bands;
- the total.

Ask for changes until the Admin is happy.

- **Name:** a new name, never a template's that exists. A customized copy of a template is
  "<template name> — custom".
- Ask whether to make it the **default**: the template new Fit scores start on. Existing scores keep theirs.

On an explicit yes, call `create_scoring_template` with the whole template and `makeDefault` as they chose.

Yacrum never edits a Fit template in place: to change it later, build a changed copy the same way. If Yacrum refuses,
it names what is wrong (a name in use, more than 30 questions): relay it as worded, fix it with the Admin, and try
again.

Finish by saying what was saved: the Qualification changes, the Fit template and whether it is now the default.
Mention that reps answer both on each opportunity, and that `/yacrum:qualify-opportunity` helps them do it.
