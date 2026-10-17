-- Demo checkout: a stand-in for Razorpay until the keys exist.
--
-- /upgrade lets a student "pay" a dummy amount and get a real subscription
-- period, so the whole subscribe → practise → expire loop can be used before
-- payments are switched on. Those rows are marked source = 'demo' so they are
-- never mistaken for money received, and can be cleared in one statement when
-- Razorpay goes live:
--
--   delete from public.subscriptions where source = 'demo';
--
-- has_active_subscription() does not look at source: a demo period grants
-- exactly what a paid one does, for exactly as long.

alter table public.subscriptions drop constraint if exists subscriptions_source_check;
alter table public.subscriptions
  add constraint subscriptions_source_check check (source in ('razorpay', 'manual', 'demo'));
