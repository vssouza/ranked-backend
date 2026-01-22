-- 1) find member id by email (Need a registered user first)
select internal_id, email, username, display_name
from public.members
where email = 'you@example.com'
limit 1;

-- 2) promote
insert into public.ranked_admins (member_id)
values ('<MEMBER_INTERNAL_ID>')
on conflict (member_id) do nothing;

-- 3) when promoted by another user
insert into public.ranked_admins (member_id, created_by_member_id)
values (
  '<NEW_ADMIN_MEMBER_ID>',
  '<EXISTING_SUPER_ADMIN_MEMBER_ID>'
)
on conflict (member_id) do nothing;

-- 3 ) verify
select
  ra.member_id,
  m.email,
  m.username,
  ra.created_at,
  ra.created_by_member_id
from public.ranked_admins ra
join public.members m on m.internal_id = ra.member_id
order by ra.created_at desc;


-- 4) Demote (if needed)
delete from public.ranked_admins
where member_id = '<PASTE_INTERNAL_ID_UUID_HERE>';

