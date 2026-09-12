-- A flagged submission and a suspension are not "system" notices: a student
-- needs to be able to find them again, and an admin needs to be able to count
-- them. Its own value, in its own migration, because ALTER TYPE ... ADD VALUE
-- cannot be used in the same transaction that adds it.
alter type public.notification_type add value if not exists 'integrity_warning';
