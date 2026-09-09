-- Cached input is billed at a fraction of normal input. Recording it separately
-- is what makes prompt caching measurable: without this column a cache hit and
-- a cache miss are indistinguishable in the usage table, and there is no way to
-- tell whether caching is working or how much it saved.
alter table public.usage_events
  add column if not exists cached_tokens integer not null default 0;

comment on column public.usage_events.cached_tokens is
  'Input tokens served from the provider prompt cache, billed at a discount.';
