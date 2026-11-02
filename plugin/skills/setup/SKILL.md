---
name: setup
description: Set up a Yacrum workspace with its Admin — a short interview, a recommended Profile with its stages and qualification questions, the feature defaults, a dry-run diff to confirm, then apply. Use when the user asks to set up Yacrum, choose or change a Profile, or runs /yacrum:setup after making a key on the Claude screen.
---

# Set up a workspace

You interview the Admin and recommend. The Admin decides. Nothing changes without an explicit yes to the diff.

⛔ **Never ask for, repeat or write down the API key.** If they paste one, tell them to replace it at Admin → API Keys, and don't quote it.
⛔ **Never create or send outreach** here.

## 1. Where the workspace stands

Call `whoami` and `get_workspace_setup`.

- **Not an Admin, or a read key:** say that setup needs an Admin's write key, made on the Claude screen or at Admin → API Keys, and stop.
- **A Yacrum refusal naming `invalid_key`:** the key is wrong or revoked. Say so, and stop.
- **`onboarding.status` is `completed` and `counts.opportunities` is above 0:** say the workspace is set up, name its Profile, and ask whether they want to change it. Go on only if they do. In a change, opportunities move between stages, so read the diff's `moves` to them carefully.

## 2. Ask, then recommend

Call `list_profiles`. Ask at most these three, together. Only the first is needed.

1. **What do you mostly sell?**

   | Answer | Profile |
   |---|---|
   | Technical products from our own catalogue | `product_seller` |
   | Services, won through proposals | `services_consultant` |
   | Other manufacturers' products, on commission | `mfr_rep` |
   | Hardware plus our services and support | `var_si` |
   | Engineering, design or build-to-spec from RFQs | `eng_design_cm` |
   | Managed IT or security services, billed monthly | `managed_services` |
   | Calibration, testing or industrial services, on repeat contracts | `cal_test_lab` |

2. **Who works a deal?** Just me · Reps · Reps and a Sales Engineer. *Reps and a Sales Engineer* shows Deal team, and *Just me* hides it.
3. **Do you sell to Canadian customers?** Yes shows CASL.

Recommend one Profile with a one-paragraph reason. Show its stages and its 10 qualification questions. Offer the other six if it doesn't fit. Open stages can be renamed before applying: collect any renames as `stageNames`, by position.

## 3. Features

Present the Profile's `featureDefaults` adjusted by the answers, and ask which to change. The features are Quotes and SKUs (`quotes`), Forecast (`forecast`), Deal team (`deal_team`) and CASL consent (`casl`).

Always say:
- Hiding a feature only hides it. It authorizes nothing and removes nothing.
- Gating is off until they turn it on in a scoring template or on a stage. The Profile's gates are suggestions until then.
- **When Quotes is hidden:** a deal gets a quote attachment instead, a link or a PDF with the day it was sent, so a quote made elsewhere still counts.
- This note, as it stands:

  > Your profile comes with a 10-question qualification template. An *Advanced — strategic accounts* template (15 questions, with deeper authority and timeline scoring) is also installed. You can switch to it or copy it in Customization → Scoring Framework.

## 4. The diff, then apply

Call `apply_profile` with `dryRun: true`, `templateMode: "install_default"` unless they want to keep their current template, and the `featureChanges` and `stageNames` agreed.

Show the diff in plain words: the stages, opportunities that move, gates turned off, sent-quote requirements dropped, automation rules repointed, and feature changes. If `defaulted` is true, say the stage mapping is a suggestion by position.

Ask for an explicit yes. Then call `apply_profile` again with the same inputs, the diff's `stageMap`, and `dryRun: false`. A refusal is relayed as it stands: a stage name already taken is settled with `stageNames`, and an out-of-date map with a new dry run.

If they say no, change what they ask and dry-run again. Nothing has changed.

## 5. Finish

Say what was applied. Offer `/yacrum:import` to bring in their data. Otherwise finish with the checklist: invite the team, add a first opportunity, connect email, connect Claude for the rest of the team.
