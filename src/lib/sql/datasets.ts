/**
 * The store dataset every platform SQL exercise runs on, and the default a
 * teacher writes their own exercise against.
 *
 * Moved here from scripts/seed-sql.ts so the seeder and the teacher authoring
 * route share one copy. A teacher's exercise stores its own copy of the setup
 * when it is saved, so editing this later changes no existing exercise.
 */

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

export const STORE_SETUP = SCHEMA + `
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
export const STORE_HIDDEN_SETUP = SCHEMA + `
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

export const STORE_SCHEMA_NOTE = `customers(id, name, city, segment, joined_on)
products(id, name, category, unit_price)
orders(id, customer_id, product_id, quantity, ordered_on, status)

Revenue for an order is quantity x unit_price. Only 'shipped' orders count as revenue unless a question says otherwise.`;
