import type { ObjectiveSeed } from "./types";

/**
 * Statistics — the third leg of the analytics round, beside SQL and Excel.
 *
 * Weighted to what business interviews actually probe: reading an A/B test,
 * not being fooled by a correlation, and knowing what a p-value and a
 * confidence interval do and do not say. Every numeric key was computed
 * independently before it was written here, and every explanation shows the
 * working.
 */
export const STATISTICS: ObjectiveSeed[] = [
  // ---- Describing data ------------------------------------------------------
  {
    topic: "descriptive statistics",
    difficulty: "easy",
    stem: "A dark store's daily orders over five days were 12, 15, 11, 40 and 12. What are the mean and the median?",
    options: ["Mean 18, median 12", "Mean 12, median 18", "Mean 18, median 15", "Mean 16, median 12"],
    answer: "Mean 18, median 12",
    explanation:
      "Mean = (12 + 15 + 11 + 40 + 12) / 5 = 90 / 5 = 18. Sorted: 11, 12, 12, 15, 40, so the median is 12. The one 40-order day drags the mean up; the median is the better picture of a typical day.",
  },
  {
    topic: "descriptive statistics",
    difficulty: "easy",
    stem: "Salaries in a company are skewed to the right by a handful of very high earners. How do the mean and median compare?",
    options: ["The mean is above the median", "The mean is below the median", "They are equal", "It cannot be said without the data"],
    answer: "The mean is above the median",
    explanation:
      "A long right tail pulls the mean towards the extreme values while the median, the middle observation, barely moves. Right skew puts the mean above the median.",
  },
  {
    topic: "descriptive statistics",
    difficulty: "easy",
    stem: "A retailer wants to know which single shoe size to stock the most of. Which average answers that?",
    options: ["Mode", "Mean", "Median", "Standard deviation"],
    answer: "Mode",
    explanation:
      "The mode is the most frequent value. An average shoe size of 8.3 is not a size anyone buys.",
  },
  {
    topic: "descriptive statistics",
    difficulty: "easy",
    stem: "An app's 90th-percentile response time is 2.0 seconds. What does that mean?",
    options: [
      "90% of responses took 2.0 seconds or less",
      "The average response took 2.0 seconds",
      "10% of responses took 2.0 seconds or less",
      "Responses are 90% faster than 2.0 seconds",
    ],
    answer: "90% of responses took 2.0 seconds or less",
    explanation:
      "A percentile is the value below which that share of observations falls. The remaining 10% were slower than 2.0 seconds.",
  },
  {
    topic: "descriptive statistics",
    difficulty: "medium",
    stem: "Segment A has 200 customers spending ₹1,000 each on average; segment B has 800 customers spending ₹500 on average. What is the average spend across all customers?",
    options: ["₹600", "₹750", "₹500", "₹900"],
    answer: "₹600",
    explanation:
      "Weight by customers, not segments: (200 × 1,000 + 800 × 500) / 1,000 = 6,00,000 / 1,000 = ₹600. Averaging the two averages gives ₹750, which ignores that B is four times larger.",
  },

  // ---- Spread ---------------------------------------------------------------
  {
    topic: "dispersion",
    difficulty: "medium",
    stem: "A sample of four daily returns (in %) is 4, 8, 6 and 2. What is the sample standard deviation?",
    options: ["2.58", "2.24", "6.67", "5.00"],
    answer: "2.58",
    explanation:
      "Mean = 5. Squared deviations: 1, 9, 1, 9, total 20. For a sample divide by n − 1 = 3, giving a variance of 6.67, and the square root is 2.58. Dividing by n (the population formula) would give 2.24.",
  },
  {
    topic: "dispersion",
    difficulty: "medium",
    stem: "Store A's weekly sales average ₹2,00,000 with a standard deviation of ₹40,000. Store B averages ₹50,000 with a standard deviation of ₹15,000. Which is more variable relative to its size?",
    options: [
      "Store B — coefficient of variation 30% against 20%",
      "Store A — its standard deviation is larger",
      "They are equally variable",
      "They cannot be compared because the means differ",
    ],
    answer: "Store B — coefficient of variation 30% against 20%",
    explanation:
      "The coefficient of variation divides the standard deviation by the mean: A is 40,000 / 2,00,000 = 20%, B is 15,000 / 50,000 = 30%. That is exactly the tool for comparing spread across different scales.",
  },
  {
    topic: "dispersion",
    difficulty: "medium",
    stem: "Order values, in hundreds of rupees, have a first quartile of 20 and a third quartile of 40. Using the 1.5 × IQR rule, above what value is an order an outlier?",
    options: ["70", "60", "80", "50"],
    answer: "70",
    explanation:
      "IQR = Q3 − Q1 = 40 − 20 = 20. Upper fence = Q3 + 1.5 × IQR = 40 + 30 = 70.",
  },

  // ---- Probability ----------------------------------------------------------
  {
    topic: "probability",
    difficulty: "easy",
    stem: "30% of a telecom's customers are on premium plans. 10% of premium customers churn in a year, and 25% of standard customers do. What is the overall annual churn rate?",
    options: ["20.5%", "17.5%", "35.0%", "22.0%"],
    answer: "20.5%",
    explanation:
      "Total probability: 0.30 × 0.10 + 0.70 × 0.25 = 0.03 + 0.175 = 0.205, or 20.5%.",
  },
  {
    topic: "probability",
    difficulty: "hard",
    stem: "Using the same telecom — 30% premium, 10% premium churn, 25% standard churn — a customer has just churned. What is the probability they were on a premium plan?",
    options: ["14.6%", "10.0%", "30.0%", "3.0%"],
    answer: "14.6%",
    explanation:
      "Bayes: P(premium | churned) = P(premium and churned) / P(churned) = 0.03 / 0.205 = 14.6%. Churners are mostly standard customers, so a churner is less likely to be premium than a random customer (30%).",
  },
  {
    topic: "probability",
    difficulty: "medium",
    stem: "Two independent fraud checks each catch 80% of fraudulent transactions. What share of frauds is caught by at least one of them?",
    options: ["96%", "80%", "64%", "100%"],
    answer: "96%",
    explanation:
      "A fraud slips through only if both checks miss it: 0.2 × 0.2 = 0.04. So at least one catches it with probability 1 − 0.04 = 0.96. Multiplying 0.8 × 0.8 = 64% is the chance both catch it.",
  },
  {
    topic: "expected value",
    difficulty: "medium",
    stem: "A campaign costs ₹2 lakh. It has a 40% chance of adding ₹8 lakh of gross profit and a 60% chance of adding ₹1 lakh. What is its expected net value?",
    options: ["₹1.8 lakh", "₹3.8 lakh", "₹2.6 lakh", "₹4.5 lakh"],
    answer: "₹1.8 lakh",
    explanation:
      "Expected gain = 0.4 × 8 + 0.6 × 1 = 3.2 + 0.6 = ₹3.8 lakh. Subtract the ₹2 lakh cost: ₹1.8 lakh.",
  },
  {
    topic: "distributions",
    difficulty: "hard",
    stem: "Each visitor independently converts with probability 10%. Three visitors arrive. What is the probability that exactly one converts?",
    options: ["24.3%", "27.1%", "30.0%", "10.0%"],
    answer: "24.3%",
    explanation:
      "Binomial: 3 ways to choose which visitor converts × 0.1 × 0.9 × 0.9 = 3 × 0.081 = 0.243. 27.1% is the chance that at least one converts (1 − 0.9³).",
  },

  // ---- The normal distribution ----------------------------------------------
  {
    topic: "distributions",
    difficulty: "medium",
    stem: "Delivery times are roughly normal with a mean of 30 minutes and a standard deviation of 5. About what share of deliveries take between 20 and 40 minutes?",
    options: ["95%", "68%", "99.7%", "90%"],
    answer: "95%",
    explanation:
      "20 to 40 is the mean ± 2 standard deviations, which covers about 95% of a normal distribution (68% within 1, 95% within 2, 99.7% within 3).",
  },
  {
    topic: "distributions",
    difficulty: "hard",
    stem: "With delivery times normal, mean 30 minutes and standard deviation 5, about what share of deliveries take longer than 35 minutes?",
    options: ["16%", "32%", "34%", "5%"],
    answer: "16%",
    explanation:
      "35 is one standard deviation above the mean. 68% lie within ±1 SD, leaving 32% outside, split equally between the two tails: 16% above.",
  },
  {
    topic: "distributions",
    difficulty: "medium",
    stem: "An aptitude test has a mean of 60 and a standard deviation of 8. A candidate scores 76. What is their z-score?",
    options: ["2.0", "1.6", "16", "0.5"],
    answer: "2.0",
    explanation: "z = (score − mean) / SD = (76 − 60) / 8 = 2.0 standard deviations above the mean.",
  },

  // ---- Sampling -------------------------------------------------------------
  {
    topic: "sampling",
    difficulty: "medium",
    stem: "Basket values have a standard deviation of ₹20. For a random sample of 100 baskets, what is the standard error of the sample mean?",
    options: ["₹2", "₹0.20", "₹20", "₹4"],
    answer: "₹2",
    explanation: "Standard error = SD / √n = 20 / √100 = 20 / 10 = ₹2.",
  },
  {
    topic: "sampling",
    difficulty: "medium",
    stem: "To halve the standard error of an estimated mean, by what factor must the sample size grow?",
    options: ["4", "2", "√2", "8"],
    answer: "4",
    explanation: "Standard error falls with √n. Halving it needs √n to double, which means n × 4.",
  },
  {
    topic: "sampling",
    difficulty: "medium",
    stem: "What does the central limit theorem say?",
    options: [
      "The distribution of sample means approaches a normal distribution as the sample size grows, even when the population is not normal",
      "Any population becomes normally distributed once enough data is collected",
      "A large enough sample removes bias from an estimate",
      "Individual observations become normal when the sample is large",
    ],
    answer:
      "The distribution of sample means approaches a normal distribution as the sample size grows, even when the population is not normal",
    explanation:
      "It is about the mean of repeated samples, not the data itself. That is why confidence intervals for a mean work on skewed data like order values. It says nothing about bias: a large biased sample is still biased.",
  },
  {
    topic: "sampling",
    difficulty: "easy",
    stem: "A bank measures customer satisfaction by surveying only customers who called the complaints line this month. What is the main problem?",
    options: ["Selection bias", "The sample is too small", "Measurement error", "Nothing, if enough customers respond"],
    answer: "Selection bias",
    explanation:
      "The sample is chosen by a trait related to the answer — people who complained. More responses would only make a biased estimate more precise, not more correct.",
  },

  // ---- Inference ------------------------------------------------------------
  {
    topic: "hypothesis testing",
    difficulty: "medium",
    stem: "A test of a new checkout flow gives p = 0.03. Which statement is correct?",
    options: [
      "If the new flow truly had no effect, a difference at least this large would appear about 3% of the time",
      "There is a 3% probability that the new flow has no effect",
      "There is a 97% probability that the new flow works",
      "The new flow improves conversion by 3%",
    ],
    answer: "If the new flow truly had no effect, a difference at least this large would appear about 3% of the time",
    explanation:
      "A p-value is computed assuming the null hypothesis is true. It is not the probability that the null is true, and it says nothing about the size of the effect.",
  },
  {
    topic: "hypothesis testing",
    difficulty: "medium",
    stem: "In an A/B test, what is a Type I error?",
    options: [
      "Concluding the new version is better when it is not",
      "Failing to detect a real improvement",
      "Running the test on too small a sample",
      "Measuring the wrong metric",
    ],
    answer: "Concluding the new version is better when it is not",
    explanation:
      "Type I is a false positive: rejecting a true null. Missing a real effect is a Type II error.",
  },
  {
    topic: "hypothesis testing",
    difficulty: "medium",
    stem: "An analyst loosens the significance level from 0.01 to 0.05, with everything else unchanged. What happens?",
    options: [
      "The risk of a Type I error rises and the risk of a Type II error falls",
      "Both error risks fall",
      "The risk of a Type I error falls and the risk of a Type II error rises",
      "Neither error risk changes",
    ],
    answer: "The risk of a Type I error rises and the risk of a Type II error falls",
    explanation:
      "A looser threshold rejects the null more readily: more false positives, fewer missed effects. For a fixed sample, the two trade off.",
  },
  {
    topic: "confidence intervals",
    difficulty: "medium",
    stem: "A 95% confidence interval for average order value is ₹480 to ₹520. Which interpretation is correct?",
    options: [
      "If the sampling were repeated many times, about 95% of intervals built this way would contain the true average",
      "95% of all orders are between ₹480 and ₹520",
      "The sample average has a 95% chance of being ₹500",
      "There is a 5% chance the data were recorded incorrectly",
    ],
    answer: "If the sampling were repeated many times, about 95% of intervals built this way would contain the true average",
    explanation:
      "The 95% describes the method. The interval is about the average, not individual orders — individual orders spread far wider than ₹480 to ₹520.",
  },
  {
    topic: "confidence intervals",
    difficulty: "hard",
    stem: "A sample of 400 orders has a mean of ₹500 and a standard deviation of ₹100. What is the approximate 95% confidence interval for the mean?",
    options: ["₹490.2 to ₹509.8", "₹480 to ₹520", "₹304 to ₹696", "₹495 to ₹505"],
    answer: "₹490.2 to ₹509.8",
    explanation:
      "Standard error = 100 / √400 = 5. Margin = 1.96 × 5 = 9.8. So 500 ± 9.8. ₹304 to ₹696 uses the standard deviation instead of the standard error; ₹495 to ₹505 is only ± 1 standard error.",
  },

  // ---- A/B testing ----------------------------------------------------------
  {
    topic: "a/b testing",
    difficulty: "medium",
    stem: "Control: 10,000 visitors, 500 conversions. Variant: 10,000 visitors, 600 conversions. What is the variant's relative lift in conversion rate?",
    options: ["+20%", "+1%", "+10%", "+16.7%"],
    answer: "+20%",
    explanation:
      "Conversion goes from 5% to 6%. The absolute change is 1 percentage point; the relative lift is 1 / 5 = 20%. 16.7% is 100 / 600 — measured from the wrong base.",
  },
  {
    topic: "a/b testing",
    difficulty: "hard",
    stem: "For the same test — 500 of 10,000 in control, 600 of 10,000 in the variant — a two-proportion z-test gives roughly what z-statistic, and is the result significant at 5%?",
    options: [
      "About 3.1 — significant at 5%",
      "About 1.2 — not significant at 5%",
      "About 3.1 — not significant at 5%",
      "About 0.01 — not significant at 5%",
    ],
    answer: "About 3.1 — significant at 5%",
    explanation:
      "Pooled rate = 1,100 / 20,000 = 0.055. Standard error = √(0.055 × 0.945 × (1/10,000 + 1/10,000)) ≈ 0.00322. z = 0.01 / 0.00322 ≈ 3.1, beyond the 1.96 needed for 5% significance (two-sided).",
  },
  {
    topic: "a/b testing",
    difficulty: "medium",
    stem: "A team checks its A/B test every day and stops the moment p drops below 0.05. What does this do?",
    options: [
      "Inflates the false-positive rate well above 5%",
      "Reduces the false-positive rate",
      "Has no effect as long as the final sample is large",
      "Only reduces the test's power",
    ],
    answer: "Inflates the false-positive rate well above 5%",
    explanation:
      "Every look is another chance for noise to cross the threshold. Stopping at the first crossing turns a 5% error rate into a much higher one. Fix the sample size in advance, or use a method designed for sequential looks.",
  },

  // ---- Correlation and regression -------------------------------------------
  {
    topic: "correlation",
    difficulty: "easy",
    stem: "Across a year, ice-cream sales and drowning incidents rise and fall together. What is the most likely explanation?",
    options: [
      "A third factor — hot weather — drives both",
      "Ice cream causes drowning",
      "Drowning incidents increase ice-cream sales",
      "The correlation is coincidence and means nothing",
    ],
    answer: "A third factor — hot weather — drives both",
    explanation:
      "A confounder moves both series. The correlation is real, but it is not causal between the two variables.",
  },
  {
    topic: "correlation",
    difficulty: "medium",
    stem: "The correlation between price and units sold across stores is −0.8. Which statement is correct?",
    options: [
      "There is a strong negative linear relationship",
      "There is a weak negative relationship",
      "80% of the variation in units sold is explained by price",
      "Raising price by 1% cuts units by 0.8%",
    ],
    answer: "There is a strong negative linear relationship",
    explanation:
      "|r| = 0.8 is strong. The share of variation explained is r² = 64%, not 80%, and a correlation is not an elasticity.",
  },
  {
    topic: "regression",
    difficulty: "medium",
    stem: "A regression of weekly sales on a single driver has a correlation coefficient of 0.7. What share of the variation in sales does it explain?",
    options: ["49%", "70%", "84%", "30%"],
    answer: "49%",
    explanation: "For a single predictor, R² = r² = 0.7² = 0.49, or 49%.",
  },
  {
    topic: "regression",
    difficulty: "medium",
    stem: "A fitted model says units sold = 120 + 4.5 × ad spend (₹ lakh). What does it predict at ₹10 lakh of ad spend?",
    options: ["165", "124.5", "450", "45"],
    answer: "165",
    explanation: "120 + 4.5 × 10 = 120 + 45 = 165 units.",
  },
  {
    topic: "regression",
    difficulty: "medium",
    stem: "In units sold = 120 + 4.5 × ad spend (₹ lakh), fitted on observational data, what does the 4.5 mean?",
    options: [
      "Each extra ₹1 lakh of ad spend is associated with 4.5 more units sold, on average",
      "Each extra ₹1 lakh of ad spend causes exactly 4.5 more units to be sold",
      "Units sold are 4.5 when ad spend is zero",
      "Ad spend explains 4.5% of units sold",
    ],
    answer: "Each extra ₹1 lakh of ad spend is associated with 4.5 more units sold, on average",
    explanation:
      "A slope is an average association. On observational data it is not proof of cause — seasons or promotions may move ad spend and sales together. The intercept, 120, is the value at zero spend.",
  },
  {
    topic: "simpson's paradox",
    difficulty: "hard",
    stem: "Hospital A has a higher overall survival rate than Hospital B, yet B has the higher survival rate among mild cases and among severe cases separately. What best explains this?",
    options: [
      "Hospital A treats a much larger share of mild cases",
      "The data must contain an error",
      "Hospital A is the better hospital",
      "The two hospitals treated the same number of patients",
    ],
    answer: "Hospital A treats a much larger share of mild cases",
    explanation:
      "Simpson's paradox: the overall rate is a weighted average, and A's mix is weighted towards the easy cases. Compared like for like, B does better in both groups.",
  },
];
