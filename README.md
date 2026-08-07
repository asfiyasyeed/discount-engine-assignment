# Opptra Discount Engine — Base Implementation

This is the base implementation for the Opptra FDE Intern assignment.
Fork this repo, complete the tasks in the assignment brief, and submit your GitHub link + Loom.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploying

```bash
npm run build
```

Deploy the `dist/` folder to Vercel, Netlify, or any static host.
The live deployment URL must be in your README before submission.

## How to use

1. Upload `sample-data/rules.csv` as the discount rules input
2. Upload `sample-data/cart.csv` as the cart input
3. Click **Calculate Discounts**

## Project structure

```
src/
  engine/
    discountEngine.js   ← pure discount logic (no UI)
    csvParser.js        ← CSV → typed objects
  components/
    CsvUploader.jsx     ← file upload area
    DataTable.jsx       ← reusable table
    ErrorBanner.jsx     ← parse error display
  App.jsx               ← main UI + state
  main.jsx              ← entry point

sample-data/
  rules.csv             ← sample discount rules
  cart.csv              ← sample cart items
```

## CSV formats

**rules.csv**

| Column     | Type              | Example          |
|------------|-------------------|------------------|
| rule_id    | string            | RULE-01          |
| scope      | brand \| platform | platform         |
| applies_to | string            | Amazon India     |
| type       | percentage \| flat| percentage       |
| value      | number            | 15               |
| stackable  | true \| false     | false            |

**cart.csv**

| Column     | Type   | Example      |
|------------|--------|--------------|
| item_id    | string | ITEM-01      |
| product    | string | Cushion Cover|
| brand      | string | Natura Casa  |
| platform   | string | Amazon India |
| base_price | number | 1299         |

## Discount logic

- When multiple non-stackable rules match an item, the one giving the **largest saving in rupees** is applied.
- Rules marked `stackable: true` apply **on top of** the winning non-stackable rule.
- If no rules match, the base price is returned with a "No offers available" note.

## Expected results for the sample data

| Item    | Base Price | Final Price | Reasoning                              |
|---------|-----------|-------------|----------------------------------------|
| ITEM-01 | Rs.1,299  | Rs.1,104    | Platform offer: 15% off (beats Rs.150) |
| ITEM-02 | Rs.849    | Rs.629      | Brand offer: Rs.150 off + Platform 10% |
| ITEM-03 | Rs.599    | Rs.509      | Platform offer: 15% off                |
| ITEM-04 | Rs.2,499  | Rs.2,499    | No offers available                    |
| ITEM-05 | Rs.449    | Rs.382      | Platform offer: 15% off                |
| ITEM-06 | Rs.899    | Rs.809      | Platform offer: 10% off                |







my readme

# Discount Engine — Opptra FDE Intern Case Study

A customer-facing cart pricing engine that applies brand, platform, and cart-level discount rules, always picking the maximum saving for the customer, with support for natural language rule input and PDF cart uploads.

**Live deployment:** https://discount-engine-assignment-dj3t19t08-asfiya-syeed.vercel.app/

**walkthrough:** https://cap.so/s/bzd46ncrjmg8w01

---

## Run Locally

```bash
git clone https://github.com/YOUR_USERNAME/discount-engine
cd discount-engine
npm install
npm run dev
```

Open `http://localhost:5173`. Upload `sample-data/rules.csv` and `sample-data/cart.csv`, then click **Calculate Discounts** to verify output against the expected results table below.

---

## What's Built

### Base Engine (provided, verified)
- CSV upload for rules and cart items
- Item-level discount logic: when multiple non-stackable rules match an item, the one with the larger rupee saving wins, regardless of scope. Stackable rules apply on top of the winning non-stackable rule, or on their own if no non-stackable rule matches.
- Items with no matching rule show "No offers available" at base price.

### Cart-Level Offer
- Evaluated after all item-level discounts are applied, against the sum of final item prices — not raw base prices.
- If the total meets or exceeds the rule's minimum threshold, the percentage discount applies to the whole cart, shown as a separate line (e.g. "Cart offer: 10% off — Rs.593 saved").
- If the threshold isn't met, the cart offer row does not render at all — not a ₹0 line, not a hidden element.

### Natural Language Rule Input
- A text field sends plain-English rule descriptions to an LLM, which returns a structured candidate `DiscountRule`.
- The parsed rule is shown in a **confirmation card** before it's added — nothing reaches the active rule list without explicit user confirmation. This exists because LLM output is unverified input, no different from any other external data source.
- Ambiguous input (e.g. "give a discount for big orders" — no value, no threshold) is surfaced as unresolvable rather than guessed at, and the user is asked to be more specific.
- Confirming re-runs the engine against the current cart with the new rule included.

### PDF Cart Upload
- Extracts a Product / Brand / Platform / Base Price table from an uploaded PDF and replaces the current cart entirely.
- The engine automatically re-runs against the existing active rules.
- **Malformed rows are validated and rejected individually, not silently guessed or crashed on.** If a row is missing a field, has a non-numeric price, or a non-positive price, it's skipped with a specific reason shown in a warning banner (e.g. "Invalid price: -50"). Clean rows in the same file still load correctly.

---

## Expected Results (base engine, verified against sample data)

| Item | Base Price | Rule(s) Applied | Final Price |
|---|---|---|---|
| ITEM-01 Cushion Cover | Rs.1,299 | RULE-01 wins (Rs.195 > Rs.150) | Rs.1,104 |
| ITEM-02 Bed Sheet Set | Rs.849 | RULE-02 (−Rs.150) + RULE-03 stacked (−10%) | Rs.629 |
| ITEM-03 Wall Shelf | Rs.599 | RULE-01 (15% off) | Rs.509 |
| ITEM-04 Ceramic Vase | Rs.2,499 | No rules match | Rs.2,499 |
| ITEM-05 Cutting Board | Rs.449 | RULE-01 (15% off) | Rs.382 |
| ITEM-06 Desk Organiser | Rs.899 | RULE-03 (10%, stackable) | Rs.809 |

**Cart Total (post-item-discount):** Rs.5,932 → meets Rs.4,000 threshold → RULE-04 applies (−10%) → **Final Cart Total: Rs.5,339**

---

## Architecture

The core discount engine (`discountEngine.js`) has a fixed contract: it takes an array of `CartItem` objects and an array of `DiscountRule` objects, and returns priced results. It has no knowledge of where that data came from.



CSV upload ───┐
NL rule text ─┼──▶ [adapter] ──▶ same CartItem[] / DiscountRule[] shape ──▶ discountEngine.js ──▶ UI
PDF upload ───┘


Every input mode is an independent adapter whose only responsibility is producing that same shape:
- `csvParser.js` — deterministic, from the base repo
- `llmParser.js` — calls the LLM, gates output behind a confirmation step before it's trusted
- `pdfParser.js` — extracts and validates a fixed-column table, rejecting malformed rows individually

The discount engine itself was never modified while adding these features. This was a deliberate constraint (the spec asks for inputs to adapt to the engine, not the reverse), and also just better design — one calculation path is easier to trust than three.

---

## Tradeoff Decisions & Known Gaps

**Malformed PDF rows are rejected, not repaired.** An earlier version tried to recover incomplete rows by guessing missing fields (e.g. taking "the last word before the price" as the brand). This produced silently wrong data — a real brand, "LivSpace Pro," was split into product "LivSpace" and brand "Pro." I judged that a pricing tool showing a plausible-but-wrong price is more dangerous than one that shows nothing, so the parser now validates every field explicitly and rejects rows it can't confidently parse, with a specific reason shown to the user.

**Negative prices are rejected, not sanitized.** An earlier price-matching regex silently dropped the minus sign on values like "Rs.-50," turning an invalid price into a valid-looking one. Fixed to explicitly capture and reject non-positive prices.

**The demo-data fallback was removed.** The original PDF parser silently returned a hardcoded sample cart if parsing completely failed, "so testing wouldn't get blocked." This was removed — showing fake data with no warning on a real upload failure is worse than an honest empty state with a clear error.

**Known gap — two stackable rules on the same item.** The sample data never has this case; behavior here is untested and not something I'd claim confidence in without adding a test.


---

## Tech Stack

[React + Vite / whatever you're actually using] · [LLM provider] · pdfjs-dist for PDF parsing · deployed on [Vercel/Netlify]