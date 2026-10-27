---
name: outreach-rules
description: The rules for any email drafted from Yacrum data — drafts only, never sent; BCC the workspace's logging address; log every draft; follow the workspace style guide and the rep's own voice; show CASL consent facts for Canadian contacts without giving a verdict. Read before drafting outreach in any Yacrum skill.
user-invocable: false
---

# Outreach rules

These rules apply whenever you write an email to a customer or prospect from Yacrum data: in
`/yacrum:morning-signals`, `/yacrum:re-engage`, `/yacrum:account-pulse`, or when the user asks directly.

## 1. Never send. Draft only.

- Create a **draft** in the rep's own mailbox with their Gmail or Microsoft 365 connector. Never call a
  tool that sends mail, even if the user asks you to "just send it": say that Yacrum's plugin only drafts,
  and that they send it themselves after reading it.
- If no mail connector is available, write the email in the chat for the rep to copy, and say how to
  connect Gmail or Microsoft 365 (see the plugin's SETUP.md).

## 2. BCC the workspace's logging address

- Call `get_outreach_settings` **immediately before every draft**, and put the `bccAddress` from that call in
  the draft's **BCC**. Never reuse an address read earlier, even in the same session: turning logging off and
  on again gives the workspace a new address, and mail sent to the old one is silently not logged. When the
  rep sends the draft, Yacrum logs the sent email to the contact and their company automatically.
- If `bccAddress` is `null`, email logging is off. Still draft, with no BCC, and tell the rep once: *"Email
  logging is off for your workspace, so this email won't be logged in Yacrum when you send it. An Admin can
  turn it on at Administration → Workspace."*
- Yacrum keeps logged mail only from the rep's own sign-in address. If the rep's mailbox address differs from
  the one `whoami` reports (an alias, a personal account), tell them once that sent mail from it won't be
  logged, and that if their mailbox can send as their sign-in address (Gmail's *Send mail as*, Outlook's
  *From*), they can pick that address as the draft's From before sending, and it will be logged.
- Microsoft 365 drafts cannot carry attachments. Don't promise one.

## 3. Log every draft

After creating a draft, call `log_activity` on the opportunity (or the contact or company when there is no
opportunity):

- title: `Draft created: <subject>`
- description: `To <contact name> <email>. From signal <signal id> (<type>).` plus one line on why now.

If the key is read-only, `log_activity` is refused: say so once and carry on drafting.

## 4. Voice and limits

- **The style guide sets the limits.** `get_outreach_settings.styleGuide`, when there is one, is the
  workspace's rules on tone, sign-off and words to avoid. Follow it over your own defaults.
- **The rep's own sent mail sets the voice.** Before the first draft, read a handful (5–10) of the rep's
  recent sent emails through their mail connector and match their length, greeting, sign-off and register.
  Read the last thread with this contact, if there is one, and don't repeat what it already said.
- Short, specific and one-to-one: name the actual quote, product, project or reason. One clear ask. No
  marketing language, no false urgency, no invented facts. Never state a price, discount or date that is not
  in Yacrum's data.

## 5. Consent (CASL) — facts, never a verdict

Every draft reads `deal_context` first, and its `consent` holds the facts for each contact you may write to:
`consent.lastPurchaseAt` (the company's), and in `consent.contacts` the entry whose `contactId` is the person
you are writing to — the primary contact, or the quote's contact for a quote — with their `countryCode` and
`lastInquiryAt`. Use that entry even when a signal's `evidence` has facts too.

When that contact's `countryCode` is `CA` (or their company is in Canada), show the rep the facts before they
send. For example: *"Canadian contact. Last purchase: 2025-03-14. Last inquiry from them: none on record."*
Do not say whether the message is allowed. This is not legal advice, and the decision is the rep's.

## 6. Writes need the rep's say-so

Creating action items, snoozing, logging and moving a stage are writes. Propose them, and make them when the
rep agrees, or when they asked you to act. A stage move (`move_opportunity_stage`) is consequential: always
confirm it first, naming the stage.
