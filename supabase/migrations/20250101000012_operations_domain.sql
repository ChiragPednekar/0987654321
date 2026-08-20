-- Operations as a first-class domain, plus categories for the three domains
-- that had none or too few.
--
-- The enum value is added in its own statement: Postgres will not let a new
-- enum value be used in the same transaction that creates it.

alter type domain add value if not exists 'operations';
