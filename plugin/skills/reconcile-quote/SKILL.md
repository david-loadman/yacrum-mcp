---
name: reconcile-quote
description: Check an external quote's document (the customer's own PDF or link) against the quote's line items in Yacrum — read both, list every difference (missing or extra lines, quantities, prices, periods, totals), and change a line only when the rep confirms that line. Use when the user asks to reconcile, check or match a quote document with its lines, or after attaching an external quote.
---

# Reconcile an external quote with its lines

An *external quote* is a quote in Yacrum whose document is the customer's own, attached or linked. Its line items in
Yacrum set the opportunity's value and feed the forecast, so they should match the document. You find where they do
not. **You change nothing without the rep's yes to each change.**

Say "opportunity", never "deal".

## Step 1 — Find the quote

From what the rep names, find the opportunity (`search` or `list_opportunities`) and its quote (`list_quotes`, then
`get_quote`). If the quote is not marked `external`, say this skill is for a quote made from the customer's own
document, and stop.

## Step 2 — Read both sides

- **The lines in Yacrum:** from `get_quote`: each line's description (and code, if picked from the catalog), type,
  billing period, quantity, unit price and line total, and the quote's totals and currency.
- **The document:** call `get_quote_document`. A link or a short-lived PDF address comes back; read it. If you cannot
  read it (no access, an image you cannot read, a sign-in page), say so plainly and ask the rep to paste the
  document's lines instead. Never guess a figure.

## Step 3 — Compare

Match lines by code first, then by description. List, in a table:
- lines in the document and not in Yacrum;
- lines in Yacrum and not in the document;
- matched lines whose quantity, unit price, billing period or term differ;
- the totals on each side, before tax. Note tax, shipping and discounts the document shows separately, and say that
  Yacrum's figures are before tax.

If everything matches, say so in one line and stop.

## Step 4 — Offer the fixes

For each difference, propose one change to the Yacrum lines (add, change or remove a line), and ask which to make.
The Yacrum lines can be changed in the quote form in Yacrum. A quote that has been sent is frozen: changing its lines
makes a new revision. Say so before any change.

⛔ Never change the document, the sent date or the link. Never send anything to the customer.
