# Financial scenarios — CaseCode

*Phase 6. **This is an assumption-based model, not a forecast.** CaseCode
has no revenue, customers or usage history (see `product_analysis.md` §5).
Nothing here may be presented as actual or expected revenue. It shows what
the economics look like if the stated assumptions hold, and which
assumptions matter most.*

All figures are in Indian rupees (₹), annual unless stated. Lakh (L) = 1,00,000; crore (Cr) = 1,00,00,000.

---

## 1. Formulas

```
ACV (average annual contract value) = seats per institution × price per seat
ARR = paying institutions × ACV
MRR = ARR ÷ 12
AI cost = total seats × AI cost per seat
Cost of revenue (COGS) = AI cost + infrastructure + customer support/onboarding
Gross profit = ARR − COGS            Gross margin = Gross profit ÷ ARR
Operating result = Gross profit − fixed operating costs (team, tools, travel, marketing)
Contribution per institution = ACV − (seats × AI/seat) − support/inst − infra share/inst
Break-even institutions ≈ fixed operating costs ÷ contribution per institution
```

## 2. Assumptions

| # | Assumption | Low | Base | High | Basis |
|---|---|---|---|---|---|
| A1 | Seats per institution | 150 | 300 | 500 | **Assumption.** One batch at a small institute vs both years of a 120–250 intake programme |
| A2 | Price per seat / year | ₹500 | ₹600 | ₹800 | **Hypothesis** (`business_model.md` §4) |
| A3 | ACV (A1 × A2) | ₹75,000 | ₹1,80,000 | ₹4,00,000 | Derived |
| A4 | AI cost per seat / year | ₹69 | ₹69 | ₹69 | **Derived from measured tokens × official 2027 Gemini 3.6 Flash prices [S6]:** 60% of seats active × (50 graded answers × ₹1.44 + 10 AI sessions × ₹4.32) |
| A5 | Infrastructure | ₹0.5L at 5 inst. → ₹1L at 20 → ₹2.5L at 50 → ₹5L at 100 | same | same | Code constant ₹47,520/yr (Vercel Pro + Supabase Pro) at small scale; **scaling is an assumption** |
| A6 | Support & onboarding cost per institution | ₹15,000 | ₹15,000 | ₹15,000 | **Assumption** (people time) |
| A7 | Fixed operating costs | ₹25L (≤20 inst.), ₹45L (50), ₹75L (100) | same | same | **Assumption:** small founding team plus tools, legal, travel and marketing, then sales and support hires. **Replace with the real team plan.** |
| A8 | Retention | not modelled | — | — | No data |

---

## 3. Revenue scenarios

### Low — ACV ₹75,000 (150 seats × ₹500)

| Institutions | ARR | MRR | Seats | COGS | Gross margin | Fixed opex | Operating result |
|---|---|---|---|---|---|---|---|
| 5 | ₹3,75,000 | ₹31,250 | 750 | ₹1,76,750 | 52.9% | ₹25L | **−₹23.0L** |
| 20 | ₹15,00,000 | ₹1,25,000 | 3,000 | ₹6,07,000 | 59.5% | ₹25L | **−₹16.1L** |
| 50 | ₹37,50,000 | ₹3,12,500 | 7,500 | ₹15,17,500 | 59.5% | ₹45L | **−₹22.7L** |
| 100 | ₹75,00,000 | ₹6,25,000 | 15,000 | ₹30,35,000 | 59.5% | ₹75L | **−₹30.4L** |

### Base — ACV ₹1,80,000 (300 seats × ₹600)

| Institutions | ARR | MRR | Seats | COGS | Gross margin | Fixed opex | Operating result |
|---|---|---|---|---|---|---|---|
| 5 | ₹9,00,000 | ₹75,000 | 1,500 | ₹2,28,500 | 74.6% | ₹25L | **−₹18.3L** |
| 20 | ₹36,00,000 | ₹3,00,000 | 6,000 | ₹8,14,000 | 77.4% | ₹25L | **+₹2.9L** |
| 50 | ₹90,00,000 | ₹7,50,000 | 15,000 | ₹20,35,000 | 77.4% | ₹45L | **+₹24.7L** |
| 100 | ₹1.80 Cr | ₹15,00,000 | 30,000 | ₹40,70,000 | 77.4% | ₹75L | **+₹64.3L** |

### High — ACV ₹4,00,000 (500 seats × ₹800)

| Institutions | ARR | MRR | Seats | COGS | Gross margin | Fixed opex | Operating result |
|---|---|---|---|---|---|---|---|
| 5 | ₹20,00,000 | ₹1,66,667 | 2,500 | ₹2,97,500 | 85.1% | ₹25L | **−₹8.0L** |
| 20 | ₹80,00,000 | ₹6,66,667 | 10,000 | ₹10,90,000 | 86.4% | ₹25L | **+₹44.1L** |
| 50 | ₹2.00 Cr | ₹16,66,667 | 25,000 | ₹27,25,000 | 86.4% | ₹45L | **+₹1.28 Cr** |
| 100 | ₹4.00 Cr | ₹33,33,333 | 50,000 | ₹54,50,000 | 86.4% | ₹75L | **+₹2.71 Cr** |

**Average revenue per institution** = the ACV of each scenario (₹75,000 / ₹1,80,000 / ₹4,00,000).

---

## 4. Break-even

| Scenario | Contribution per institution | Break-even at ₹25L fixed | at ₹45L fixed |
|---|---|---|---|
| Low | ₹44,650 | ~56 institutions | ~101 institutions |
| Base | ₹1,39,300 | **~18 institutions** | ~32 institutions |
| High | ₹3,45,500 | ~7 institutions | ~13 institutions |

**Reading:** the business works if contracts land near **₹1.5L+ a year**. At
₹75,000 contracts with hands-on onboarding, it does not break even at any
realistic scale. **Contract size is the decisive variable**, and so is the
contract minimum in the pricing.

---

## 5. Customer acquisition cost (CAC) — not defensible yet

There is no sales history, so CAC can only be framed:

- **Likely motion:** founder-led, in person: 4–8 meetings, a demo, an 8–10 week pilot, committee approval.
- **Illustrative CAC range [Assumption]:** ₹50,000–₹1,50,000 per closed institution (travel, founder time at cost, pilot AI cost of roughly ₹5,000–₹10,000, events).
- **Payback at base contribution (₹1.39L/yr):** ~4–13 months.
- **LTV:** not computable without retention data. *If* institutions renew for 3 years (unvalidated), base lifetime contribution ≈ ₹4.2L → LTV:CAC ≈ 3–8.

Validate CAC with real data from the first 5–10 sales conversations: meetings per close, days to close, and pilot-to-paid conversion.

---

## 6. Stress test — the AI cost risk

| Case | AI cost per seat / yr (2027 prices) | vs ₹600 seat price |
|---|---|---|
| Base usage (A4) | ₹69 | 12% |
| Starter quota fully used by 80% of seats | ₹242 | 40% |
| Pro quota fully used by 80% of seats | ₹461 | 77% — **margin collapses** |
| Pro quota fully used by every seat | ₹576 | 96% |
| Grading on Gemini 3.1 Flash-Lite (if quality holds) | grading cost ₹0.26 vs ₹1.44 per answer | cuts the grading part ~5× |

Mitigations already in code: per-student quota, platform-wide daily cap,
per-institution cost and margin reporting. **Pricing decision needed:**
quota per tier, model choice for grading, and context caching. These should
be settled before signing fixed-price contracts that run into 2027.

---

## 7. Variables with the biggest impact on profitability (ranked)

1. **Contract size** (seats × price), and especially the **contract minimum**.
2. **Fixed operating cost**: team size and salaries dominate everything else.
3. **Renewal rate**: unknown; drives LTV and CAC tolerance.
4. **AI usage intensity × model price**: small at realistic usage, existential at the cap, and doubling in 2027.
5. **Sales cycle length / CAC**: academic-year budgeting can delay revenue by 6–12 months.
6. Support load per institution (faculty training, content import).

## 8. What this model deliberately leaves out

Taxes (GST is collected and passed through), payment terms and receivables,
founder salaries below market, fundraising costs, and any growth in prices.
Replace A7 with the actual team plan before showing investors a
profitability slide.
