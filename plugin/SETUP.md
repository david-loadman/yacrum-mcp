# Setting up the Yacrum plugin

The plugin gives Claude four sales routines that run on your Yacrum data:

| Skill | What it does |
|---|---|
| `/yacrum:morning-signals` | What to work on today and why, with a draft, a task or a snooze for each |
| `/yacrum:re-engage` | Revive a lost, paused or quiet opportunity with an email draft and a follow-up |
| `/yacrum:account-pulse` | A one-page brief before a meeting |
| `/yacrum:pipeline-review` | The weekly review: what moved, slipped, closed and appeared, what is ready to advance and what a stage gate blocks |
| `/yacrum:qualify-opportunity` | Score an opportunity with you, answer by answer, then say which stage gates are met and offer the next move |

⛔ **Nothing is ever sent.** Emails are created as **drafts in your own mailbox** for you to read and send.

## 1. Your Yacrum API key

An Admin opens **Administration → API Keys** in Yacrum, makes a key for you and copies it. The key is shown
only once.

| Key | What Claude can do with it |
|---|---|
| **Read** | Read, and snooze signals |
| **Read and write** | Also log the drafts it makes, create follow-up tasks and update opportunities, as your role allows |

Every call counts against your workspace's monthly API calls.

## 2. Install the plugin

### Claude Code

```bash
claude plugin marketplace add david-loadman/yacrum-mcp
claude plugin install yacrum@yacrum
```

When asked, paste your API key. It is stored as a sensitive setting. Leave the Yacrum address as it is unless
you were given another.

⚠️ The plugin runs the MCP server with `npx yacrum-mcp`, which needs Node.js 20 or later.

### Claude Desktop and claude.ai

⚠️ **A plugin installed with the `claude` command is Claude Code's alone.** Desktop and claude.ai keep plugins on
your Claude account, so install it there as well. Plugins need a paid plan.

1. Open **Customize** in the left sidebar, then the **Plugins** tab.
2. Click **Add**, then **Add marketplace**, and enter `david-loadman/yacrum-mcp`.
3. Install **Yacrum**. Desktop does not ask for a key.
4. **Add the server by hand**, as the [README](../README.md#claude-desktop) shows, with your key and Yacrum's address.

⚠️ **In Desktop the plugin brings the skills, not the tools.** Its own server needs the key and address that Claude
Code asks for at install, and Desktop has nowhere to enter them, so it stays *not started*. The tools come from the
server you added in step 4: keep it. To change which member Claude acts as, change the key there and restart Desktop.
Ask *"who am I in Yacrum?"* to see which key is in use.

⚠️ **Check that the plugin loaded.** Without it, Claude still answers `/yacrum:pipeline-review` from the tools
alone, and the answer looks plausible but skips the skill's steps. In a new chat, ask *"which Yacrum skills do
you have?"*. It should name them.

## 3. Connect your mailbox, so Claude can draft

### Gmail

Connect the **Gmail** connector in Claude, under Settings → Connectors. Claude can then:
- read your recent sent mail, to match your voice
- read your last thread with a contact
- create drafts

### Microsoft 365 (Outlook)

Drafting in Outlook needs more setup, and only a work or school account will do:

1. **A Microsoft 365 work or school account.** Personal outlook.com and hotmail.com accounts cannot be used.
2. **Admin consent.** A **Microsoft Entra Global Administrator** in your organisation consents to the Claude
   Microsoft 365 connector for the organisation.
3. **Write actions turned on.** An admin turns on the connector's **write actions**: "send mail and manage
   drafts". The plugin only ever creates drafts.
4. Connect the **Microsoft 365** connector in Claude, under Settings → Connectors.

⚠️ A draft made in Outlook this way cannot carry attachments.

## 4. Turn on email logging, so sent drafts are logged

Every draft carries your workspace's **logging address** in BCC. When you send it, Yacrum logs the email to
the contact and their company.

- **Turning it on:** an Admin turns logging on at **Administration → Workspace → Email logging**. Until then,
  Claude still drafts and tells you the email won't be logged.
- ⚠️ **Only mail from your own sign-in address is logged.** Mail sent from an alias or a personal account is
  not. If your mailbox can send as your sign-in address (Gmail's *Send mail as*, Outlook's *From*), pick it as
  the draft's From before you send, and the mail is logged.
- **Replies:** a reply stays in your inbox. Copy the logging address on your answer, or forward the reply to
  it, to log it too.
- **The style guide:** an Admin can write an outreach style guide at **Administration → Workspace**, covering
  tone, sign-off and words to avoid. Claude follows it.

## 5. Schedule the morning brief (optional)

In Claude, make a scheduled task that runs `/yacrum:morning-signals` on weekday mornings. Run unattended, it
lists the signals and makes nothing. Reply to it with the items you want drafted, turned into tasks or
snoozed.

## Canadian contacts (CASL)

For a Canadian contact, Claude shows when they last bought from you and when they last wrote in, as Yacrum
records it. It gives no verdict on whether you may email them. The decision is yours, and this is not legal
advice.
