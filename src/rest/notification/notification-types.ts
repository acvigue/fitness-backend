/**
 * Canonical list of notification types used across the app. The
 * `Notification.type` column on disk is a free-form string, so adding new
 * types is cheap, but every value the frontend renders should be in this set
 * — the OpenAPI enum on `NotificationResponseDto.type` is generated from it.
 */
export const NOTIFICATION_TYPES = [
  // Team
  'TEAM_INVITE',
  'TEAM_INVITE_RESPONSE',
  'TEAM_JOIN_REQUEST',
  'TEAM_REQUEST_RESPONSE',
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_TRANSFERRED',
  'TEAM_DELETED',
  'MEMBER_LEFT',
  'REMOVED_FROM_TEAM',
  'TEAM_BROADCAST',
  'TEAM_CHAT_MESSAGE',
  // Organization
  'ORGANIZATION_INVITE',
  'ORGANIZATION_INVITE_RESPONSE',
  'ORGANIZATION_ROLE_CHANGED',
  'ORGANIZATION_MEMBER_REMOVED',
  // Tournament
  'TOURNAMENT_INVITATION_RECEIVED',
  'TOURNAMENT_REMINDER',
  'TOURNAMENT_FORFEIT_RECORDED',
  'TOURNAMENT_MATCH_RESULT_PENDING',
  'TOURNAMENT_MATCH_RESULT_CONFIRMED',
  'TOURNAMENT_MATCH_RESULT_DISPUTED',
  // Meetups
  'MEETUP_PROPOSAL',
  'MEETUP_ACCEPTED',
  'MEETUP_DECLINED',
  'MEETUP_CANCELLED',
  // Gym
  'GYM_STATUS_CHANGED',
  // Achievements
  'ACHIEVEMENT_UNLOCKED',
  // Moderation
  'MESSAGE_FLAGGED',
  'MESSAGE_DELETED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_UNSUSPENDED',
  'ACCOUNT_BANNED',
  'ACCOUNT_UNBANNED',
  'ACCOUNT_RESTRICTED',
  'SUSPENSION_APPEAL_SUBMITTED',
  'SUSPENSION_APPEAL_DECIDED',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
