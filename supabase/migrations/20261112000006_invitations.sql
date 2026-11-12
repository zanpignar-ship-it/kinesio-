-- Members and invitations without e-mail sending: the owner creates an invitation and copies the link.
-- Only the SHA-256 of the token is stored (invitations.token_hash).

-- Members of an organization with their e-mail (auth.users is not reachable through the Data API).
create function public.organization_members(p_org uuid)
returns table (user_id uuid, email text, role public.member_role, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_org
    and p_org in (select private.user_org_ids())
  order by m.role, u.email;
$$;
revoke all on function public.organization_members(uuid) from public, anon;
grant execute on function public.organization_members(uuid) to authenticated;

-- What an invitation link leads to (for the signed-in visitor), or null when it is not usable.
create function public.invitation_info(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  if (select auth.uid()) is null or p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v from public.invitations i
  where i.token_hash = extensions.digest(p_token, 'sha256') and i.accepted_at is null and i.expires_at > now();
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'organization', (select o.name from public.organizations o where o.id = v.organization_id),
    'role', v.role,
    'email', v.email,
    'email_matches', lower(v.email) = lower((select u.email from auth.users u where u.id = (select auth.uid()))),
    'already_member', exists (select 1 from public.memberships m where m.organization_id = v.organization_id and m.user_id = (select auth.uid()))
  );
end;
$$;
revoke all on function public.invitation_info(text) from public, anon;
grant execute on function public.invitation_info(text) to authenticated;

-- Accept: the signed-in user's e-mail must match the invitation. Returns the organization id.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v public.invitations;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into v from public.invitations i
  where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') and i.accepted_at is null and i.expires_at > now()
  for update;
  if not found then
    raise exception 'Invitation not valid' using errcode = 'P0001', hint = 'LT_INVITATION_INVALID';
  end if;
  if lower(v.email) <> lower((select u.email from auth.users u where u.id = uid)) then
    raise exception 'Invitation is for another e-mail' using errcode = 'P0001', hint = 'LT_INVITATION_EMAIL';
  end if;
  insert into public.memberships (organization_id, user_id, role)
  values (v.organization_id, uid, v.role)
  on conflict (organization_id, user_id) do nothing;
  update public.invitations set accepted_at = now() where id = v.id;
  return v.organization_id;
end;
$$;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
