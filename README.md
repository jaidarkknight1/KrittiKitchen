# Kritti Kitchen Feedback

Customer feedback form for **Kritti Kitchen**.

## Live website

**https://jaidarkknight1.github.io/KrittiKitchen/**

## Questions

1. Taste of the food — 1 to 10  
2. Quality & freshness — 1 to 10  
3. Hygiene & packaging — 1 to 10  
4. Service & delivery — 1 to 10  
5. Overall experience — 1 to 10  
6. Any suggestion? (optional)

Labels: **Needs improvement** → **Excellent**  
Button: **Submit Feedback**

## Response tracking files

| File | What it is |
|------|------------|
| [`data/responses.json`](data/responses.json) | All feedback (JSON) |
| [`data/responses.csv`](data/responses.csv) | Same data for Excel |

## Run locally (saves into those files)

```bash
npm install
npm start
```

Open http://localhost:3000 — each submit appends to the tracking files.

## Analytics dashboard

**https://jaidarkknight1.github.io/KrittiKitchen/analytics/**

Shows total responses, average scores, 1–10 breakdowns, and every answer.
