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

config({ path: ".env.local" });
config({ path: ".env" });

const SCHEMA = `
create table customers (
  id integer primary key,
  name text not null,
  city text not null,
  segment text not null,
  joined_on text not null
);
create table products (
  id integer primary key,
  name text not null,
  category text not null,
  unit_price integer not null
);
create table orders (
  id integer primary key,
  customer_id integer not null,
  product_id integer not null,
  quantity integer not null,
  ordered_on text not null,
  status text not null
);
`;

const VISIBLE = SCHEMA + `
insert into customers values
  (1,'Aarav Menon','Mumbai','enterprise','2023-01-14'),
  (2,'Priya Raghavan','Bengaluru','smb','2023-03-02'),
  (3,'Rohan Das','Mumbai','smb','2023-05-19'),
  (4,'Sneha Kulkarni','Pune','enterprise','2024-02-08'),
  (5,'Imran Qureshi','Delhi','smb','2024-04-21'),
  (6,'Meera Iyer','Bengaluru','enterprise','2024-07-30'),
  (7,'Vikram Shah','Delhi','startup','2024-09-11'),
  (8,'Ananya Bose','Kolkata','startup','2025-01-05');

insert into products values
  (1,'Analytics Suite','software',48000),
  (2,'Support Plan','services',12000),
  (3,'Data Connector','software',18000),
  (4,'Onboarding','services',30000),
  (5,'Storage Add-on','infrastructure',9000);

insert into orders values
  (1,1,1,2,'2024-01-15','shipped'),
  (2,1,2,1,'2024-02-20','shipped'),
  (3,2,3,4,'2024-02-28','shipped'),
  (4,3,1,1,'2024-03-11','cancelled'),
  (5,3,5,6,'2024-04-02','shipped'),
  (6,4,1,3,'2024-05-17','shipped'),
  (7,4,4,1,'2024-06-01','pending'),
  (8,5,2,2,'2024-06-23','shipped'),
  (9,6,1,1,'2024-08-09','shipped'),
  (10,6,3,2,'2024-09-14','shipped'),
  (11,7,5,10,'2024-10-02','shipped'),
  (12,7,2,1,'2024-11-19','cancelled'),
  (13,8,4,1,'2025-01-20','pending'),
  (14,2,1,1,'2025-02-14','shipped'),
  (15,5,3,3,'2025-03-08','shipped');
`;

/**
 * Same schema, deliberately different answers.
 *
 * Different cities, different segment mix, different totals — so a query that
 * hardcoded the visible answer produces the wrong rows here.
 *
 * It also has to exercise every question. A first draft had no Mumbai customer
 * and no customer without a shipped order, so two exercises returned nothing
 * here — which would have let a hardcoded empty result pass and, worse, failed
 * students whose correct query also returned nothing. The seeder refuses a
 * solution that returns no rows on either dataset for exactly that reason.
 */
const HIDDEN = SCHEMA + `
insert into customers values
  (1,'Kabir Nair','Chennai','smb','2023-02-11'),
  (2,'Divya Pillai','Hyderabad','enterprise','2023-04-17'),
  (3,'Arjun Rao','Chennai','enterprise','2023-08-23'),
  (4,'Nisha Verma','Mumbai','startup','2024-01-30'),
  (5,'Farhan Ali','Hyderabad','smb','2024-03-12'),
  (6,'Tara Joshi','Mumbai','smb','2024-06-06'),
  (7,'Dev Malhotra','Chennai','startup','2024-11-25');

insert into products values
  (1,'Analytics Suite','software',48000),
  (2,'Support Plan','services',12000),
  (3,'Data Connector','software',18000),
  (4,'Onboarding','services',30000),
  (5,'Storage Add-on','infrastructure',9000);

insert into orders values
  (1,1,3,5,'2024-02-01','shipped'),
  (2,1,5,2,'2024-03-14','shipped'),
  (3,2,1,4,'2024-04-09','shipped'),
  (4,2,4,2,'2024-05-22','shipped'),
  (5,3,1,2,'2024-06-30','cancelled'),
  (6,3,2,3,'2024-07-15','shipped'),
  (7,4,5,8,'2024-08-19','pending'),
  (8,5,3,1,'2024-09-27','pending'),
  (9,5,1,1,'2024-10-11','shipped'),
  (10,6,2,2,'2024-12-03','shipped'),
  (11,7,4,1,'2025-01-16','shipped'),
  (12,7,3,2,'2025-02-28','cancelled'),
  (13,2,5,4,'2025-03-19','shipped'),
  (14,6,1,1,'2025-04-02','shipped');
`;

const SCHEMA_NOTE = `customers(id, name, city, segment, joined_on)
products(id, name, category, unit_price)
orders(id, customer_id, product_id, quantity, ordered_on, status)

Revenue for an order is quantity x unit_price. Only 'shipped' orders count as revenue unless a question says otherwise.`;

type Exercise = {
  slug: string;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  solution_sql: string;
  order_matters: boolean;
  hint?: string;
  /** A version that only works on the visible data — used to prove the hidden set discriminates. */
  hardcoded: string;
};

const EXERCISES: Exercise[] = [
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
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const problems: string[] = [];

  for (const e of EXERCISES) {
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
    const fakeVisible = await runQuery(VISIBLE, e.hardcoded);
    const fakeHidden = await runQuery(HIDDEN, e.hardcoded);
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
    console.log(
      `  ${e.slug.padEnd(32)} visible ${onVisible.result.rows.length} rows, hidden ${onHidden.result.rows.length} rows` +
        `  (hardcoded passes visible: ${fakePassesVisible}, hidden: ${fakePassesHidden})`,
    );
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
