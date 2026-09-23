-- =============================================================================
-- Function privileges. PostgreSQL grants EXECUTE to PUBLIC by default: revoke
-- everything, then grant explicitly.
-- =============================================================================

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- RLS policies call these helpers with the caller's privileges.
grant usage on schema private to authenticated;
grant execute on function
  private.is_room_member(uuid, uuid),
  private.is_match_player(uuid, uuid),
  private.can_view_match(uuid, uuid),
  private.are_friends(uuid, uuid)
to authenticated;

-- Client RPCs (each checks auth.uid() itself).
grant execute on function
  public.level_for_xp(bigint),
  public.set_country(text),
  public.touch_presence(),
  public.send_friend_request(text, text),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.mark_notification_read(uuid),
  public.list_friends(),
  public.equip_item(text, text),
  public.claim_chest(),
  public.chest_status(),
  public.create_room(text, text, boolean),
  public.join_room(text),
  public.leave_room(uuid),
  public.set_room_locked(uuid, boolean),
  public.kick_from_room(uuid, uuid),
  public.send_invitation(uuid, uuid),
  public.respond_invitation(uuid, boolean),
  public.send_chat_message(uuid, uuid, text),
  public.report_message(uuid, text),
  public.send_gift(uuid, uuid, text),
  public.enqueue_matchmaking(text, uuid[]),
  public.cancel_matchmaking(),
  public.get_ranking(text, integer),
  public.get_my_rank(text)
to authenticated;

-- Trusted server only (Edge Functions with the service role key).
grant execute on function
  public.create_match(uuid, uuid, uuid, text, text, jsonb, jsonb),
  public.commit_match_action(uuid, integer, jsonb, jsonb, jsonb, timestamptz, jsonb),
  public.apply_match_result(uuid, jsonb),
  public.level_for_xp(bigint)
to service_role;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;
