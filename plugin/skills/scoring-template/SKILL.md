---
name: scoring-template
description: Build an opportunity scoring template with an Admin through an interview — what makes a good opportunity in their business, the categories and questions, each question's answers and points, the Priority A, B and C bands, and any stage gates — then show the whole template, save it to Yacrum on a yes, and make it the default if they want. Use when the user wants to design, build or customize a scoring or qualification template, or from /yacrum:setup.
---

# Build a scoring template

You interview the Admin and draft. The Admin decides. **Nothing is saved until they say yes to the whole template.**

**How to talk:**
- Explain each idea the first time it comes up. Say "opportunity", never "deal".
- One topic per message, ending in its question.
- Keep the draft template in front of the Admin as it grows.

## 1. What is there now

Call `list_scoring_templates` and `get_pipeline`. Then explain:
- An *opportunity scoring template* is categories of questions that rate how good an opportunity is.
- A question is answered on a scale of 1 to 10, or by picking one of a few choices, each with its points.
- The points add to a total, and the total places the opportunity in **Priority A, B or C**.
- A question can be a **stage gate**: it must be answered well enough before an opportunity may enter a stage.
  A gate can be on, or saved off as a suggestion.

Say which template is the default now, and how many the workspace has: at most ten. Ask whether to **start from the
current default** (customizing it) or **from scratch**.

## 2. Their sales process

Ask about what decides whether they win. Cover these, a few at a time:
- What makes an opportunity a good fit for them?
- Who decides on the buyer's side, and how do they find out?
- How budget is set and approved.
- What drives timing and urgency.
- Who they usually compete with, and why they win or lose.

From the answers, **propose 3 to 5 categories with 2 to 4 questions each** (at most 30 questions in all). Name each
question as a rep would ask it, with one line of guidance. When starting from the current template, show it first
and propose only the changes.

The usual shape is **10 points per category**, so four categories make 40. Suggest it, but follow the Admin.

## 3. Each question's answers and points

For each question, settle:
- **Scale or choices.** On a scale of 1 to 10, the answer times its *weight* is its points: weight 1 makes 10
  the most. With choices, there are two or more, each with its own points; points may be negative for a choice that
  counts against.
- **Guidance**, if the wording needs it.
- **A stage gate, if any:**
  - the stage (by name, from `get_pipeline`, open or Won);
  - for a scale question, the lowest answer that passes;
  - for choices, which ones pass;
  - whether it is **on** now or saved **off** as a suggestion.

## 4. The priority bands

Total the most the template can score. Propose where Priority A, B and C start, A highest, then B, then C: about 80%,
65% and 50% of the total. Adjust as the Admin asks.

## 5. Review, then save

Show the whole template:
- its name;
- the categories and questions, each with its answers, points, guidance and gate;
- the A, B and C bands;
- the total.

Ask for changes until the Admin is happy.

- **Name:** a new name, never a template's that exists. A customized copy of a template is
  "<template name> — custom".
- Ask whether to make it the **default**: the template new scores start on. Existing scores keep theirs.

On an explicit yes, call `create_scoring_template` with:
- the whole template;
- each gate's `stageId` from `get_pipeline`;
- `makeDefault` as they chose.

Yacrum never edits a template in place: to change it later, build a changed copy the same way. If Yacrum refuses, it
names what is wrong (a name in use, more than 30 questions, a gate on a stage that is not open or Won): relay it as
worded, fix it with the Admin, and try again.

Finish by saying what was saved and whether it is now the default. Mention that reps answer it on each opportunity,
and that `/yacrum:qualify-opportunity` helps them do it.
