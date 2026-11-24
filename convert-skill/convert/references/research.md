# Research: competitors and the buyers' words

The point: write the page from what buyers already say and what the market already shows, not from
what sounds good. Everything you note here is quoted, linked and dated. Nothing is paraphrased into
a "quote", and nothing is made up to fill a gap. A gap stays a gap.

## Competitors (3 to 5)

How to find them, in this order, stopping when you have 3–5 real ones:
1. The page itself: "vs", "alternative to", comparison tables, "works with" (partners are not competitors).
2. Search: `<product> alternatives`, `<category> app`, `best <category> 2026`, `<main competitor> vs`.
   G2 / Capterra / Product Hunt / App Store "similar" lists are good sources of names.
3. Ask the person only if all of that turns up nothing usable.

Pick the ones a buyer would really compare against: same buyer, same job, similar price. One big
name the buyer knows is useful as a reference point; the others should be close peers. Skip
directories, review sites and agencies.

For each one, capture the page the same way as the person's:

```bash
node <skill>/scripts/capture.mjs https://competitor.com ./convert/<site>/competitors/<name>
```

Then note in `research/competitors.md`, per competitor, with the URL:
- **Headline and sub**, verbatim.
- **The one promise**: what outcome they sell, in one line.
- **First screen**: what the buyer sees before scrolling (product shot? person? number? form?).
- **Proof**: what kind (logos, counts, reviews, press, ratings), where it sits. Their claims, not yours.
- **Price**: shown or hidden, the number, the plans.
- **CTA**: the words on the main button, and what it asks for (signup, card, demo, download).
- **Section order**: the list of blocks top to bottom (page.json `sections` has it).
- **How it looks**: colours, type, product shots or illustration, density. One line.
- **What to take**: one thing they do better than the person's page. **What to avoid**: one thing.

Finish with **Patterns**: what 3+ of them all do (the category's expectations: a buyer will look for
it) and what none of them say (the opening).

## The buyers' words (reviews)

Where, in this order of value: G2, Capterra, Trustpilot, App Store / Google Play, Reddit threads,
Product Hunt comments, YouTube comments on review videos, Amazon for physical products. Search
`<competitor> review`, `<competitor> reddit`, `site:reddit.com <category> <problem>`,
`<competitor> 1 star`, `<competitor> cancel`.

Collect, for the person's product and for the competitors:
- **Low reviews (1–2 stars)**: what made people leave or hate it. These are the pains the page must
  answer, and the objections.
- **High reviews (4–5 stars)**: what made people stay. These are the outcomes buyers care about, in
  their words. The best headline lines come from here.
- **Questions people ask** before buying (Reddit, Product Hunt): these become the objections block.

Write each one to `research/voice.md` like this, grouped by theme (pain, outcome, objection,
switch trigger):

```
> "I have a WHOOP, a food app and a PDF of blood work and none of them talk to each other"
> — r/whoop, u/name, 2025-03 · https://www.reddit.com/r/whoop/comments/...
```

Rules:
- **Verbatim.** Copy the words exactly, typos included. Cut with "…" only, never rewrite.
- **Linked.** The exact URL of the page you read it on. If you can't open the page, you can't use
  the quote. A search-result snippet is not a source.
- **Public only.** No names of private people on the new page; the username stays in voice.md.
- 15–40 quotes is enough. Stop when the themes repeat.
- If a site blocks reading (some review sites do), say so in voice.md and use another.
- Reviews of competitors are evidence of what buyers want. They are never shown on the person's
  page as if they were about the person's product.

At the top of voice.md, write the **5 phrases buyers use most** for the pain and the outcome, each
with the quote it comes from. Those words go into the headline, the sub and the section titles.

## The person's own facts

From the old page (page.json) and anything in the project (README, pricing config, docs, changelog,
app store listing), list in `research/facts.md` every fact the new page may use: price, plans,
integrations, features, numbers, guarantees, policies, real customer quotes, real logos. Each with
where it came from (file path or URL). The new page uses only these, the quotes, and what the
person tells you.
