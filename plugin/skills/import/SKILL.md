---
name: import
description: Import another CRM's export or a spreadsheet into Yacrum with its Admin — upload the files, settle every answer, show the report with duplicates and held rows, confirm, run and summarize. Use when the user wants to bring data into Yacrum from Pipedrive, HubSpot or a spreadsheet, or runs /yacrum:import.
argument-hint: "[full paths to the files]"
---

# Import data

Nothing reaches the workspace's records until the Admin has seen the report and said yes.

⛔ **Never decide a duplicate group yourself, and never accept a stage suggestion unasked.**
⛔ **Say nothing about consent.** A count of Canadian addresses is only that.
⛔ **Never ask for, repeat or write down the API key.**

## 1. The files and the source

Call `whoami`. If this is not an Admin's write key, say so and stop.

Ask for the **full path** of each file, such as `/Users/sam/Downloads/deals.csv`. Excel (`.xlsx`) or CSV, at most 12 files, 10 MB each and 25 MB together. A file attached to the chat isn't enough, because the server reads from the computer.

Ask where they came from, proposing an answer from the file names: `hubspot-crm-exports-…` is HubSpot. The sources are `pipedrive`, `hubspot` and `spreadsheet`. Confirm it. If they have no export yet, `get_import_templates` gives the spreadsheet templates and how to make each CRM's export.

## 2. Upload

Call `preview_import` with `files` and `source`. Keep the `id` it returns.

- **"Nothing was sent to Yacrum":** the file was refused on this computer. Say why. Never suggest a way around it, such as renaming the file.
- **Yacrum says a file is a sheet of another source:** tell them, and upload again with that source once they agree.
- **`unrecognised` is not empty:** name those files. They were left out.

## 3. Settle the answers

Follow `next` in what comes back, and call `preview_import` with `importId` each time.

**`next: "columns"` (a spreadsheet):** for each file, show its headers and samples with what each was guessed to be. Confirm or correct them, then send `columns`.

**`next: "answers"`:** start from `setup.mapping`, change only what the Admin answers, and send the whole of it as `mapping`. Choices come from `setup.options`, and what to ask from `setup.survey`.
- **Members:** each name in the export to a member, and who owns the rest (`defaultUserId`).
- **Stages:** each stage in the export to an open stage. Show `setup.stageSuggestions` as suggestions, and put one in `mapping.stages` only when the Admin accepts it. A stage left unanswered holds its rows.
- **Lost reasons:** each to one of theirs, with the default for the rest.
- **Company type:** the type for new companies.
- **Open deals in the forecast:** ask, as `includeOpenDealsInForecast`.
- **Custom fields, if asked:** show the columns in `setup.survey.offered` by their label, with how full each is, and ask which to keep and whether each is free text or a list. Send each kept column under its `ref` (such as `company:Market Segment`), never its header, as `text` or `select`.
- **Product types, if asked:** for each product in `setup.survey.untypedProducts`, show the user the types in `setup.options.skuTypes` and ask which. Send them in `productTypes` exactly as listed (`HW Product`, not *hardware*). Never guess a type, and never invent one.

**The preview may ask two more things:**
- **`needsRate`:** some opportunities are in the other currency and the workspace has no USD/CAD rate. Ask the user for the rate (1 USD in CAD) and send it as `usdCadRate`. Tell them it is saved for the workspace when the import starts, cannot be cleared, and stays if the import is undone.
- **`needsContact`:** companies with no people, each with the opportunities that need a contact. For each, ask the user for a contact's name and email and send it in `contactsToAdd` under the `companyRef`, or let them leave it out, and those opportunities are not imported. Never make one up.

A refusal with `problems` says what to change. If `previewProblems` appears, the workspace has changed since the answers were saved, so settle those again.

## 4. The report

Show `preview` before anything runs:
- **Counts:** what will be created, what is already here, and `alreadyImported` from an earlier import.
- **Duplicates:** each group, with its members, why it matched (`match`) and what the plan did (`merged`). An exact match merges unless the Admin says otherwise, and a near one only if they say so. Ask about each, send the answer in `mapping.duplicates` by the group's `id` (`true` to merge), and preview again.
- **Held rows:** how many, with their reasons. They won't be imported until the answers change.
- **Warnings and skipped columns.**
- **`canadianContacts`:** when above 0, state the count. When `suggestCasl` is true, add that they can show CASL for this workspace, and call `set_workspace_features` with `casl: true` only if they ask.

## 5. Confirm and run

Ask for an explicit yes. Then call `import_records` with the `importId`, and again with the same id while `more` is true. Tell them how far it has got between calls. A large import takes many calls, and a repeat is safe.

If a call is refused, relay it. `get_import_status` says where the import stands, and they can go on with it.

## 6. Summarize

Call `get_import_status`. Give what was created, held and failed, from `totals`. Say **undo is available**: all of it or none, refused while records made since hang off what it created. Call `undo_import` only after they ask and you have said what will go.
