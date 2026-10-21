/**
 * Seeds SQL exercises.
 *
 *   npm run seed:sql
 *
 * Every exercise carries two datasets with the same schema: the one the
 * student sees, and a hidden variant. The seeder runs each reference solution
 * against both and refuses anything that does not work on both — a solution
 * that only fits the visible rows would fail students who wrote a correct
 * query, which is the worst failure this feature could have.
 *
 * It also checks that the hidden dataset actually discriminates: it runs a
 * deliberately hardcoded version of each answer and insists that it passes on
 * the visible data and fails on the hidden data. If it passes both, the hidden
 * variant is too similar and the anti-hardcoding guarantee is not real.
 *
 * Idempotent on slug.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { compareResults, runQuery } from "../src/lib/sql/runner";
import {
  STORE_HIDDEN_SETUP as HIDDEN,
  STORE_SCHEMA_NOTE as SCHEMA_NOTE,
  STORE_SETUP as VISIBLE,
} from "../src/lib/sql/datasets";

config({ path: ".env.local" });
config({ path: ".env" });

type Exercise = {
  slug: string;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  solution_sql: string;
  order_matters: boolean;
  hint?: string;
  /**
   * A version that only works on the visible data — used to prove the hidden
   * set discriminates. Left out, it is built from the visible answer itself.
   */
  hardcoded?: string;
};

export const EXERCISES: Exercise[] = [
  {
    slug: "sql-total-shipped-revenue",
    title: "Total revenue from shipped orders",
    topic: "aggregation",
    difficulty: "easy",
    prompt:
      "Return a single row with the total revenue across all shipped orders. Revenue is quantity x unit_price.",
    solution_sql:
      "select sum(o.quantity * p.unit_price) as revenue from orders o join products p on p.id = o.product_id where o.status = 'shipped'",
    order_matters: false,
    hint: "Join orders to products, filter to shipped, then SUM the product of the two columns.",
    hardcoded: "select 678000 as revenue",
  },
  {
    slug: "sql-revenue-by-category",
    title: "Revenue by product category",
    topic: "aggregation",
    difficulty: "medium",
    prompt:
      "For each product category, return the category and its total shipped revenue.",
    solution_sql:
      "select p.category, sum(o.quantity * p.unit_price) as revenue from orders o join products p on p.id = o.product_id where o.status = 'shipped' group by p.category",
    order_matters: false,
    hint: "GROUP BY the category once the join and the filter are in place.",
    hardcoded:
      "select 'software' as category, 498000 as revenue union all select 'services', 36000 union all select 'infrastructure', 144000",
  },
  {
    slug: "sql-top-spending-customer",
    title: "The customer who spent the most",
    topic: "ranking",
    difficulty: "medium",
    prompt:
      "Return the name and total shipped spend of the single customer who has spent the most.",
    solution_sql:
      "select c.name, sum(o.quantity * p.unit_price) as spend from orders o join products p on p.id = o.product_id join customers c on c.id = o.customer_id where o.status = 'shipped' group by c.id, c.name order by spend desc limit 1",
    order_matters: false,
    hint: "Three tables joined, grouped per customer, ordered by the total and cut to one row.",
    hardcoded: "select 'Sneha Kulkarni' as name, 144000 as spend",
  },
  {
    slug: "sql-repeat-customers",
    title: "Customers who ordered more than once",
    topic: "aggregation",
    difficulty: "easy",
    prompt:
      "Return the name of every customer who has placed at least two orders, of any status.",
    solution_sql:
      "select c.name from customers c join orders o on o.customer_id = c.id group by c.id, c.name having count(*) >= 2",
    order_matters: false,
    hint: "HAVING filters groups after they are formed, the way WHERE filters rows before.",
    hardcoded:
      "select 'Aarav Menon' as name union all select 'Priya Raghavan' union all select 'Rohan Das' union all select 'Sneha Kulkarni' union all select 'Imran Qureshi' union all select 'Meera Iyer' union all select 'Vikram Shah'",
  },
  {
    slug: "sql-never-cancelled",
    title: "Customers who never cancelled",
    topic: "subqueries",
    difficulty: "medium",
    prompt:
      "Return the name of every customer who has never had an order with status 'cancelled'.",
    solution_sql:
      "select name from customers where id not in (select customer_id from orders where status = 'cancelled')",
    order_matters: false,
    hint: "NOT IN against a subquery listing the customers who did cancel.",
    hardcoded:
      "select 'Aarav Menon' as name union all select 'Priya Raghavan' union all select 'Sneha Kulkarni' union all select 'Imran Qureshi' union all select 'Meera Iyer' union all select 'Ananya Bose'",
  },
  {
    slug: "sql-above-average-order",
    title: "Orders worth more than average",
    topic: "subqueries",
    difficulty: "hard",
    prompt:
      "Return the id and value of every shipped order worth more than the average shipped order.",
    solution_sql:
      "select o.id, o.quantity * p.unit_price as value from orders o join products p on p.id = o.product_id where o.status = 'shipped' and o.quantity * p.unit_price > (select avg(o2.quantity * p2.unit_price) from orders o2 join products p2 on p2.id = o2.product_id where o2.status = 'shipped')",
    order_matters: false,
    hint: "The average has to be computed over the same filtered set, which is what the subquery is for.",
    hardcoded:
      "select 1 as id, 96000 as value union all select 3, 72000 union all select 6, 144000 union all select 11, 90000",
  },
  {
    slug: "sql-best-month",
    title: "The strongest month",
    topic: "dates",
    difficulty: "hard",
    prompt:
      "Return the year-month (as YYYY-MM) with the highest shipped revenue, and that revenue. One row.",
    solution_sql:
      "select substr(o.ordered_on, 1, 7) as month, sum(o.quantity * p.unit_price) as revenue from orders o join products p on p.id = o.product_id where o.status = 'shipped' group by month order by revenue desc limit 1",
    order_matters: false,
    hint: "SUBSTR cuts the first seven characters of the date, which is the year and month.",
    hardcoded: "select '2024-05' as month, 144000 as revenue",
  },
  {
    slug: "sql-customers-in-city",
    title: "Customers in one city",
    topic: "filtering",
    difficulty: "easy",
    prompt: "List the name of every customer based in Mumbai.",
    solution_sql: "select name from customers where city = 'Mumbai'",
    order_matters: false,
    hint: "WHERE with a string comparison. Strings need single quotes.",
    hardcoded: "select 'Aarav Menon' as name union all select 'Rohan Das'",
  },
  {
    slug: "sql-count-by-segment",
    title: "How many customers per segment",
    topic: "aggregation",
    difficulty: "easy",
    prompt: "For each segment, return the segment and the number of customers in it.",
    solution_sql: "select segment, count(*) as n from customers group by segment",
    order_matters: false,
    hint: "GROUP BY the column you want one row per.",
    hardcoded:
      "select 'enterprise' as segment, 3 as n union all select 'smb', 3 union all select 'startup', 2",
  },
  {
    slug: "sql-join-order-value",
    title: "What each order was worth",
    topic: "joins",
    difficulty: "medium",
    prompt:
      "Return the order id and its value (quantity x unit_price) for every shipped order.",
    solution_sql:
      "select o.id, o.quantity * p.unit_price as value from orders o join products p on p.id = o.product_id where o.status = 'shipped'",
    order_matters: false,
    hint: "Join orders to products on product_id, then multiply.",
    hardcoded:
      "select 1 as id, 96000 as value union all select 2, 12000 union all select 3, 72000",
  },
  {
    slug: "sql-revenue-by-city",
    title: "Revenue by city",
    topic: "joins",
    difficulty: "medium",
    prompt:
      "Return each city and the total shipped revenue from customers in it, for cities with any shipped revenue.",
    solution_sql:
      "select c.city, sum(o.quantity * p.unit_price) as revenue from orders o join customers c on c.id = o.customer_id join products p on p.id = o.product_id where o.status = 'shipped' group by c.city",
    order_matters: false,
    hint: "Two joins, then GROUP BY city and SUM the product.",
    hardcoded: "select 'Mumbai' as city, 108000 as revenue union all select 'Pune', 144000",
  },
  {
    slug: "sql-top-customers-ordered",
    title: "The three biggest customers",
    topic: "ordering",
    difficulty: "medium",
    prompt:
      "Return the three customers with the highest total shipped revenue, highest first. Give the customer name and their revenue.",
    solution_sql:
      "select c.name, sum(o.quantity * p.unit_price) as revenue from orders o join customers c on c.id = o.customer_id join products p on p.id = o.product_id where o.status = 'shipped' group by c.id, c.name order by revenue desc limit 3",
    order_matters: true,
    hint: "ORDER BY the aggregate, then LIMIT. The order is part of the answer here.",
    hardcoded:
      "select 'Sneha Kulkarni' as name, 144000 as revenue union all select 'Aarav Menon', 108000 union all select 'Priya Raghavan', 120000",
  },
  {
    slug: "sql-customers-without-orders",
    title: "Customers who never ordered anything shipped",
    topic: "outer joins",
    difficulty: "hard",
    prompt:
      "Return the name of every customer who has no shipped order. Customers with only cancelled or pending orders count, as do customers with no orders at all.",
    solution_sql:
      "select c.name from customers c where not exists (select 1 from orders o where o.customer_id = c.id and o.status = 'shipped')",
    order_matters: false,
    hint: "NOT EXISTS, or a LEFT JOIN with a null check. Watch the status filter — it has to be inside the join or the subquery.",
    hardcoded: "select 'Ananya Bose' as name",
  },
  {
    slug: "sql-category-share",
    title: "Share of revenue by category",
    topic: "window functions",
    difficulty: "hard",
    prompt:
      "For each product category, return the category and its share of total shipped revenue as a percentage, rounded to one decimal place.",
    solution_sql:
      "select p.category, round(100.0 * sum(o.quantity * p.unit_price) / (select sum(o2.quantity * p2.unit_price) from orders o2 join products p2 on p2.id = o2.product_id where o2.status = 'shipped'), 1) as pct from orders o join products p on p.id = o.product_id where o.status = 'shipped' group by p.category",
    order_matters: false,
    hint: "A scalar subquery for the denominator, or SUM() OVER (). Multiply by 100.0 rather than 100 so the division is not integer division.",
    hardcoded:
      "select 'software' as category, 62.5 as pct union all select 'services', 8.9 union all select 'infrastructure', 28.6",
  },
  {
    slug: "sql-repeat-buyers",
    title: "Customers who bought more than one product",
    topic: "aggregation",
    difficulty: "medium",
    prompt:
      "Return the name of every customer who has shipped orders for more than one distinct product.",
    solution_sql:
      "select c.name from orders o join customers c on c.id = o.customer_id where o.status = 'shipped' group by c.id, c.name having count(distinct o.product_id) > 1",
    order_matters: false,
    hint: "HAVING filters groups after aggregation. COUNT(DISTINCT ...) is the part that matters.",
    hardcoded:
      "select 'Aarav Menon' as name union all select 'Priya Raghavan' union all select 'Meera Iyer'",
  },  {
    slug: "sql-orders-by-status",
    title: "Orders by status",
    topic: "aggregation",
    difficulty: "easy",
    prompt: "For each order status, return the status and the number of orders with it.",
    solution_sql: "select status, count(*) as n from orders group by status",
    order_matters: false,
    hint: "GROUP BY the status column and COUNT the rows in each group.",
  },
  {
    slug: "sql-customers-joined-2024",
    title: "Customers who joined in 2024",
    topic: "dates",
    difficulty: "easy",
    prompt: "Return the name of every customer who joined during 2024.",
    solution_sql: "select name from customers where joined_on >= '2024-01-01' and joined_on < '2025-01-01'",
    order_matters: false,
    hint: "Dates are stored as YYYY-MM-DD text, so a range comparison on the string works. So does substr(joined_on, 1, 4) = '2024'.",
  },
  {
    slug: "sql-pending-value",
    title: "Value stuck in pending orders",
    topic: "aggregation",
    difficulty: "easy",
    prompt: "Return a single row with the total value (quantity x unit_price) of all pending orders.",
    solution_sql: "select sum(o.quantity * p.unit_price) as pending_value from orders o join products p on p.id = o.product_id where o.status = 'pending'",
    order_matters: false,
    hint: "The same join as revenue, with a different status filter.",
  },
  {
    slug: "sql-order-size-band",
    title: "Banding orders by size",
    topic: "case expressions",
    difficulty: "medium",
    prompt: "For every shipped order, return the order id and a band: 'large' if its value is 50,000 or more, 'medium' if it is 20,000 or more, otherwise 'small'.",
    solution_sql: "select o.id, case when o.quantity * p.unit_price >= 50000 then 'large' when o.quantity * p.unit_price >= 20000 then 'medium' else 'small' end as band from orders o join products p on p.id = o.product_id where o.status = 'shipped'",
    order_matters: false,
    hint: "CASE WHEN ... THEN ... checks its conditions in order and stops at the first that is true, so put the largest threshold first.",
  },
  {
    slug: "sql-shipped-vs-cancelled",
    title: "Shipped and cancelled, side by side",
    topic: "conditional aggregation",
    difficulty: "medium",
    prompt: "For every customer with at least one order, return their name, the number of their shipped orders and the number of their cancelled orders.",
    solution_sql: "select c.name, sum(case when o.status = 'shipped' then 1 else 0 end) as shipped, sum(case when o.status = 'cancelled' then 1 else 0 end) as cancelled from customers c join orders o on o.customer_id = c.id group by c.id, c.name",
    order_matters: false,
    hint: "SUM(CASE WHEN condition THEN 1 ELSE 0 END) counts the rows that meet a condition within each group.",
  },
  {
    slug: "sql-aov-by-segment",
    title: "Average order value by segment",
    topic: "joins",
    difficulty: "medium",
    prompt: "For each customer segment, return the segment and the average value of its shipped orders, rounded to the nearest rupee.",
    solution_sql: "select c.segment, round(avg(o.quantity * p.unit_price)) as avg_value from orders o join customers c on c.id = o.customer_id join products p on p.id = o.product_id where o.status = 'shipped' group by c.segment",
    order_matters: false,
    hint: "Average the order values, not the customers' totals. ROUND with no second argument rounds to a whole number.",
  },
  {
    slug: "sql-largest-order-per-customer",
    title: "Each customer's biggest order",
    topic: "aggregation",
    difficulty: "medium",
    prompt: "For every customer with a shipped order, return their name and the value of their single largest shipped order.",
    solution_sql: "select c.name, max(o.quantity * p.unit_price) as largest from orders o join customers c on c.id = o.customer_id join products p on p.id = o.product_id where o.status = 'shipped' group by c.id, c.name",
    order_matters: false,
    hint: "MAX() of the order value, grouped per customer.",
  },
  {
    slug: "sql-share-of-customers-buying",
    title: "What share of customers have bought",
    topic: "subqueries",
    difficulty: "medium",
    prompt: "Return a single row with the percentage of all customers who have at least one shipped order, rounded to one decimal place.",
    solution_sql: "select round(100.0 * (select count(distinct customer_id) from orders where status = 'shipped') / (select count(*) from customers), 1) as pct",
    order_matters: false,
    hint: "Two counts: distinct customers with a shipped order, and all customers. Use 100.0 so the division is not integer division.",
  },
  {
    slug: "sql-rank-customers",
    title: "Ranking customers by revenue",
    topic: "window functions",
    difficulty: "hard",
    prompt: "For every customer with shipped revenue, return their name, their total shipped revenue, and their rank (1 = highest). Customers with equal revenue share a rank, and the next rank is not skipped.",
    solution_sql: "select c.name, sum(o.quantity * p.unit_price) as revenue, dense_rank() over (order by sum(o.quantity * p.unit_price) desc) as rnk from orders o join customers c on c.id = o.customer_id join products p on p.id = o.product_id where o.status = 'shipped' group by c.id, c.name",
    order_matters: false,
    hint: "DENSE_RANK() OVER (ORDER BY ...) gives ties the same rank without gaps. A window function can order by an aggregate.",
  },
  {
    slug: "sql-running-total",
    title: "Cumulative revenue by month",
    topic: "window functions",
    difficulty: "hard",
    prompt: "Return each year-month (YYYY-MM) with shipped revenue, that month's revenue, and the cumulative revenue up to and including that month. Order by month, earliest first.",
    solution_sql: "with m as (select substr(o.ordered_on, 1, 7) as month, sum(o.quantity * p.unit_price) as revenue from orders o join products p on p.id = o.product_id where o.status = 'shipped' group by month) select month, revenue, sum(revenue) over (order by month) as cumulative from m order by month",
    order_matters: true,
    hint: "Build monthly revenue first (a CTE helps), then SUM(revenue) OVER (ORDER BY month) gives the running total.",
  },
  {
    slug: "sql-month-on-month",
    title: "Month-on-month change",
    topic: "window functions",
    difficulty: "hard",
    prompt: "For each year-month (YYYY-MM) with shipped revenue, return the month, its revenue, and the change from the previous month that had revenue. The first month's change is NULL. Order by month.",
    solution_sql: "with m as (select substr(o.ordered_on, 1, 7) as month, sum(o.quantity * p.unit_price) as revenue from orders o join products p on p.id = o.product_id where o.status = 'shipped' group by month) select month, revenue, revenue - lag(revenue) over (order by month) as change from m order by month",
    order_matters: true,
    hint: "LAG(revenue) OVER (ORDER BY month) returns the previous row's revenue, and NULL for the first row.",
  },
  {
    slug: "sql-top-product-per-category",
    title: "Best-selling product in each category",
    topic: "window functions",
    difficulty: "hard",
    prompt: "For each product category, return the category, the name of the product with the highest shipped revenue in it, and that revenue.",
    solution_sql: "with r as (select p.category, p.name, sum(o.quantity * p.unit_price) as revenue, row_number() over (partition by p.category order by sum(o.quantity * p.unit_price) desc) as rn from orders o join products p on p.id = o.product_id where o.status = 'shipped' group by p.id, p.category, p.name) select category, name, revenue from r where rn = 1",
    order_matters: false,
    hint: "ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) numbers products within each category; keep number 1.",
  },
  {
    slug: "sql-first-order-cohorts",
    title: "Customers by month of first order",
    topic: "ctes",
    difficulty: "hard",
    prompt: "Group customers by the year-month (YYYY-MM) of their first order of any status. Return each month and the number of customers whose first order fell in it.",
    solution_sql: "with first as (select customer_id, min(ordered_on) as first_on from orders group by customer_id) select substr(first_on, 1, 7) as month, count(*) as customers from first group by month",
    order_matters: false,
    hint: "First find each customer's earliest order date with MIN in a CTE, then group those dates by month.",
  },
  {
    slug: "sql-same-city-pairs",
    title: "Customers in the same city",
    topic: "self joins",
    difficulty: "hard",
    prompt: "Return every pair of customers who are based in the same city: the city and the two names. List each pair once.",
    solution_sql: "select a.city, a.name as first_customer, b.name as second_customer from customers a join customers b on a.city = b.city and a.id < b.id",
    order_matters: false,
    hint: "Join the table to itself on city. a.id < b.id stops a customer pairing with themselves and stops each pair appearing twice.",
  },
  {
    slug: "sql-days-to-first-order",
    title: "Days from joining to first order",
    topic: "dates",
    difficulty: "hard",
    prompt: "For every customer with at least one order of any status, return their name and the number of days between the date they joined and their first order.",
    solution_sql: "select c.name, cast(julianday(min(o.ordered_on)) - julianday(c.joined_on) as integer) as days from customers c join orders o on o.customer_id = c.id group by c.id, c.name, c.joined_on",
    order_matters: false,
    hint: "JULIANDAY turns a date into a day number, so subtracting two gives the days between them. Take the MIN order date per customer.",
  },
  {
    slug: "sql-above-segment-average",
    title: "Customers above their segment's average",
    topic: "ctes",
    difficulty: "hard",
    prompt: "Return the name, segment and total shipped revenue of every customer whose total shipped revenue is above the average total for customers with shipped revenue in the same segment.",
    solution_sql: "with t as (select c.id, c.name, c.segment, sum(o.quantity * p.unit_price) as revenue from orders o join customers c on c.id = o.customer_id join products p on p.id = o.product_id where o.status = 'shipped' group by c.id, c.name, c.segment) select name, segment, revenue from t where revenue > (select avg(t2.revenue) from t t2 where t2.segment = t.segment)",
    order_matters: false,
    hint: "Compute each customer's total in a CTE, then compare it with a correlated subquery that averages the CTE within the same segment.",
  },
];

/** A query that returns exactly these rows — the "memorised the answer" control. */
export function literalQuery(result: { columns: string[]; rows: unknown[][] }): string {
  const lit = (v: unknown) =>
    v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  return result.rows
    .map((row, i) =>
      "select " + row.map((v, j) => (i === 0 ? `${lit(v)} as "${result.columns[j].replace(/"/g, "")}"` : lit(v))).join(", "),
    )
    .join(" union all ");
}

/**
 * Runs every reference solution on both datasets and proves the hidden one
 * discriminates. Returns the problems found; empty means safe to seed.
 */
export async function checkExercises(log: (line: string) => void = () => {}): Promise<string[]> {
  const problems: string[] = [];
  const slugs = new Set<string>();

  for (const e of EXERCISES) {
    if (slugs.has(e.slug)) problems.push(`${e.slug}: duplicate slug`);
    slugs.add(e.slug);

    const onVisible = await runQuery(VISIBLE, e.solution_sql);
    const onHidden = await runQuery(HIDDEN, e.solution_sql);
    if (!onVisible.ok || !onVisible.result) {
      problems.push(`${e.slug}: solution fails on the visible data — ${onVisible.error}`);
      continue;
    }
    if (!onHidden.ok || !onHidden.result) {
      problems.push(`${e.slug}: solution fails on the hidden data — ${onHidden.error}`);
      continue;
    }
    if (onVisible.result.rows.length === 0) {
      problems.push(`${e.slug}: solution returns no rows on the visible data`);
    }
    if (onHidden.result.rows.length === 0) {
      problems.push(`${e.slug}: solution returns no rows on the hidden data`);
    }

    // The discrimination check. A hardcoded answer must pass the visible data
    // and fail the hidden data, or the hidden variant is not doing its job.
    const hardcoded = e.hardcoded ?? literalQuery(onVisible.result);
    const fakeVisible = await runQuery(VISIBLE, hardcoded);
    const fakeHidden = await runQuery(HIDDEN, hardcoded);
    if (!fakeVisible.ok || !fakeVisible.result || !fakeHidden.ok || !fakeHidden.result) {
      problems.push(`${e.slug}: the hardcoded control query does not run`);
      continue;
    }
    const fakePassesVisible = compareResults(
      onVisible.result,
      fakeVisible.result,
      e.order_matters,
    ).correct;
    const fakePassesHidden = compareResults(
      onHidden.result,
      fakeHidden.result,
      e.order_matters,
    ).correct;

    if (fakePassesHidden) {
      problems.push(
        `${e.slug}: a hardcoded answer passes the HIDDEN data too — the variant does not discriminate`,
      );
    }
    if (e.hardcoded === undefined && !fakePassesVisible) {
      problems.push(`${e.slug}: the generated control does not reproduce the visible answer`);
    }
    log(
      `  ${e.slug.padEnd(32)} visible ${onVisible.result.rows.length} rows, hidden ${onHidden.result.rows.length} rows` +
        `  (hardcoded passes visible: ${fakePassesVisible}, hidden: ${fakePassesHidden})`,
    );
  }

  return problems;
}

async function main() {
  const problems = await checkExercises(console.log);
  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`\nValidated ${EXERCISES.length} SQL exercises.`);
  if (process.argv.includes("--dry-run")) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const [i, e] of EXERCISES.entries()) {
    const { error } = await admin.from("sql_exercises").upsert(
      {
        slug: e.slug,
        title: e.title,
        prompt: e.prompt,
        topic: e.topic,
        difficulty: e.difficulty,
        schema_note: SCHEMA_NOTE,
        setup_sql: VISIBLE,
        hidden_setup_sql: HIDDEN,
        solution_sql: e.solution_sql,
        order_matters: e.order_matters,
        hint: e.hint ?? null,
        sort_order: i,
        is_published: true,
      },
      { onConflict: "slug" },
    );
    if (error) {
      console.error(`${e.slug}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log(`\nSeeded ${EXERCISES.length} SQL exercises.`);
}

if (process.argv[1]?.endsWith("seed-sql.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
