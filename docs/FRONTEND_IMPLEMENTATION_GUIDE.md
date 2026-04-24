# Frontend Implementation Guide

Covers the 19 user stories backed by recent backend work (US#20–#59). Written for the Vue / Nuxt frontend that already consumes the existing `/v1/*` API.

---

## 0. Prerequisites

- **Base URL** unchanged: `/v1`
- **Auth** unchanged: OIDC bearer token in `Authorization: Bearer <jwt>`
- **OpenAPI**: after pulling latest backend, regenerate the frontend API client from `/docs` or `/docs-json`
- **New error codes to handle**:
  - `401 Session has been revoked / Your account is suspended / Your account has been banned` — log out and redirect
  - `403 Action MESSAGING is restricted: <reason>` — show toast, don't retry
  - `403 You are not allowed to view this profile` — hide profile route
- **Package additions on frontend**: no new runtime deps required if you're already on Vue 3 + Pinia. Optionally `date-fns` for reminder intervals.

### Global TypeScript types to sync

Regenerate these from the OpenAPI spec. Notable new/changed shapes:

```ts
// Notification now carries metadata + readAt
interface NotificationResponseDto {
  id: string
  type: string                  // see expanded list below
  title: string
  content: string
  metadata: Record<string, unknown> | null
  readAt: string | null
  dismissed: boolean
  createdAt: string
}

// New notification `type` values added:
// TOURNAMENT_REMINDER | GYM_STATUS_CHANGED | TEAM_BROADCAST
// MESSAGE_FLAGGED | MESSAGE_DELETED
// ACCOUNT_SUSPENDED | ACCOUNT_UNSUSPENDED | ACCOUNT_BANNED | ACCOUNT_RESTRICTED
```

---

## 1. Migration Checklist (breaking / behavior changes)

| Area | Change | Frontend action |
|---|---|---|
| **User profile** | Privacy flags now enforce hiding (bio/sports/tournaments/achievements return null/`[]` to other viewers) | Add empty-state UI per section: "This user has hidden their bio", etc. |
| **Notifications** | Added `metadata`, `readAt`, new `PATCH /v1/notifications/:id/read` | Show unread badge (where `readAt === null`), call PATCH on open. Use `metadata` for deep-linking (e.g., `metadata.broadcastId` routes to broadcast) |
| **Reports** | `POST /v1/report` accepts optional `messageId`. Response DTO now includes `id`, `messageId` | Add "Report this message" action in chat context menu with `messageId` |
| **Chat sendMessage** | May now 403 due to user blocks OR restriction (`MESSAGING`) | Show toast with error detail, don't retry |
| **Team invitations** | May 403 due to user-block or restriction (`TEAM_JOIN`) | Same |
| **Tournament registration** | May 403 due to restriction (`TOURNAMENT_REGISTER`) | Same |
| **Team list** | `GET /v1/teams` now accepts `?q=&sportId=` | Wire search input + sport filter |
| **Meetups list** | `GET /v1/meetups/team/:teamId?status=ACCEPTED` filters | Add "Confirmed only" toggle |
| **Tournament bracket** | New `POST /v1/tournaments/:id/seed-bracket` for RR→bracket | Add "Seed bracket" button after RR complete |
| **OIDC guard** | Rejects suspended/banned users on any request | Wire a global error interceptor that logs out on 401 |

---

## 2. New Endpoints — Quick Reference

Grouped by user story. All protected unless otherwise noted; bearer token required.

### US#20 — View Other Students' Profiles

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/users/:userId/profile` | **(already exists; now enforces privacy)** |
| `GET` | `/v1/users/compare?a=<id>&b=<id>` | **NEW** — returns two profiles + stats |
| `GET` | `/v1/user/profile/privacy` | (existing) read my privacy flags |
| `PATCH` | `/v1/user/profile/privacy` | (existing) update my privacy flags |

`ProfileComparisonResponseDto` shape:
```ts
{
  a: { profile: UserProfileResponseDto, stats: UserComparisonStatsDto }
  b: { profile: UserProfileResponseDto, stats: UserComparisonStatsDto }
}
interface UserComparisonStatsDto {
  tournamentCount: number
  achievementCount: number
  featuredAchievementCount: number
  favoriteSportsCount: number
}
```

### US#21 — View Sports Videos

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/videos?page=&per_page=&sportId=` | (existing) |
| `GET` | `/v1/videos/:id` | (existing) |
| `POST` | `/v1/videos/:id/progress` body `{ positionSeconds, completed? }` | **NEW** |
| `GET` | `/v1/videos/:id/progress` | **NEW** — returns current user's progress |

### US#22 — Tournament Recap Videos

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/tournaments/:id/recaps` | **NEW** — returns `[]` when none |
| `POST` | `/v1/tournaments/:id/recaps` body `{ videoId }` | **NEW** — org manager only, tournament must be `COMPLETED` |
| `DELETE` | `/v1/tournaments/:id/recaps/:recapId` | **NEW** — 204, org manager only |

### US#24 — View Gym Availability

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/gyms/availability?gymId=&from=&to=&status=` | **NEW** — returns `GymSlotResponseDto[]` |
| `POST` | `/v1/gyms/:id/slots` body `{ startsAt, endsAt, status? }` | **NEW** — org member only |

`status` enum: `AVAILABLE | RESERVED | CLOSED`.

### US#25 — Block Other Students

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/users/:userId/block` | **NEW** |
| `DELETE` | `/v1/users/:userId/block` | **NEW** — 204 |
| `GET` | `/v1/users/me/blocks` | **NEW** |

### US#26 — Report Inappropriate Messages

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/report` body `{ reportedId, messageId?, reason? }` | **UPDATED** |
| `GET` | `/v1/report/user` | (existing) — returns my reports with status |

### US#35 — Tournament Reminders

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/reminders/preferences` | **NEW** — returns `ReminderPreferenceResponseDto[]` |
| `PUT` | `/v1/reminders/preferences` body `{ intervalsMinutes: number[], tournamentId? }` | **NEW** — upsert global or per-tournament |

Reminder notifications arrive via `/v1/notifications` with `type === 'TOURNAMENT_REMINDER'` and `metadata.tournamentId`.

### US#37 — Gym Availability Alerts

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/gyms/:id/subscribe` | **NEW** |
| `DELETE` | `/v1/gyms/:id/subscribe` | **NEW** |
| `GET` | `/v1/gyms/subscriptions` | **NEW** — my watched gyms |

Alerts arrive via notifications with `type === 'GYM_STATUS_CHANGED'` and `metadata.{gymId, slotId, status}`.

### US#39 — Round Robin Tournament System

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/tournaments/:id/seed-bracket` | **NEW** — RR→bracket seeding (org manager) |
| `GET` | `/v1/tournaments/:id/standings` | (existing) |
| `POST` | `/v1/tournaments` body `{ ...CreateTournamentDto, format: 'ROUND_ROBIN' }` | (existing) |

### US#44 — Inter-team Messaging

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/teams?q=&sportId=` | **UPDATED** — added filters |
| `POST` | `/v1/team-chats` | (existing) |
| `POST` | `/v1/team-chats/:chatId/messages` | (existing — now block & restriction enforced) |

### US#46 — Schedule Meetups

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/meetups/team/:teamId?status=ACCEPTED` | **UPDATED** — optional status filter |
| `POST` `/v1/meetups` / `PATCH` `/v1/meetups/:id/{accept,decline,cancel}` | (existing) |

### US#50 — Team Leader Gym Status

| Method | Path | Notes |
|---|---|---|
| `PATCH` | `/v1/gyms/:id/slots/:slotId/status` body `{ status, reservedByTeamId?, note? }` | **NEW** — team captain only |

Fires gym alert notifications to subscribers.

### US#54 — Team Broadcasts

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/teams/:teamId/broadcasts` body `{ content }` | **NEW** — captain only |
| `GET` | `/v1/teams/:teamId/broadcasts` | **NEW** — team members |
| `POST` | `/v1/broadcasts/:id/read` | **NEW** — 204, recipient marks read |
| `GET` | `/v1/broadcasts/:id/stats` | **NEW** — captain only, `{ delivered, read, total }` |

### US#56 / US#57 — Department Moderation

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/moderation/messages?q=&from=&to=&teamId=` | **NEW** — dept manager only |
| `POST` | `/v1/moderation/messages/:id/flag` body `{ reason? }` | **NEW** — 204 |
| `DELETE` | `/v1/moderation/messages/:id` body `{ reason }` | **NEW** — 204, audit-logged |

### US#58 — Suspend/Ban Users

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/moderation/users/:userId/suspend` body `{ durationHours, reason }` | **NEW** |
| `POST` | `/v1/moderation/users/:userId/unsuspend` | **NEW** — 204 |
| `POST` | `/v1/moderation/users/:userId/ban` body `{ reason }` | **NEW** |
| `POST` | `/v1/moderation/users/:userId/unban` | **NEW** — 204 |

### US#59 — Partial Restrictions

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/moderation/users/:userId/restrict` body `{ actions, durationHours, reason }` | **NEW** |
| `POST` | `/v1/moderation/users/:userId/unrestrict` body `{ actions }` | **NEW** — 204 |

`actions`: `MESSAGING | TEAM_JOIN | TOURNAMENT_REGISTER`.

---

## 3. Cross-cutting Frontend Patterns

### 3.1 Unified Error Handling

Add to the Axios/Fetch client (e.g., `composables/useApi.ts`):

```ts
interceptor.onError((err) => {
  if (err.status === 401 && /banned|suspended|revoked/.test(err.message)) {
    authStore.logout()
    router.push('/login?reason=account-disabled')
    toast.error(err.message)
    return
  }
  if (err.status === 403 && err.message.startsWith('Action ')) {
    toast.warning(err.message)  // restriction message already human-readable
    return
  }
  if (err.status === 403 && /blocked/.test(err.message)) {
    toast.info(err.message)
    return
  }
  throw err
})
```

### 3.2 Block-aware UI (`useCanInteract`)

Before showing messaging/invite/profile-action buttons, consult the current user's block list:

```ts
// composables/useBlocks.ts
export const useBlocks = defineStore('blocks', () => {
  const blocks = ref<UserBlockResponse[]>([])
  async function load() { blocks.value = await api.get('/users/me/blocks') }
  const iBlocked = (userId: string) => blocks.value.some(b => b.blockedId === userId)
  async function block(userId: string) { blocks.value.push(await api.post(`/users/${userId}/block`)) }
  async function unblock(userId: string) {
    await api.delete(`/users/${userId}/block`)
    blocks.value = blocks.value.filter(b => b.blockedId !== userId)
  }
  return { blocks, load, iBlocked, block, unblock }
})
```

> Only tracks *your outgoing* blocks; the backend handles bidirectional enforcement on its side. If a user has blocked you, attempts to interact return 403 with a human message — surface via toast.

### 3.3 Notification routing

Use `metadata` to deep-link when the user taps a notification:

```ts
function openNotification(n: NotificationResponseDto) {
  api.patch(`/notifications/${n.id}/read`)
  switch (n.type) {
    case 'TEAM_BROADCAST':      return router.push(`/teams/${n.metadata.teamId}/broadcasts`)
    case 'TOURNAMENT_REMINDER': return router.push(`/tournaments/${n.metadata.tournamentId}`)
    case 'GYM_STATUS_CHANGED':  return router.push(`/gyms/${n.metadata.gymId}`)
    case 'TEAM_INVITE':         return router.push(`/invitations`)
    case 'MEETUP_ACCEPTED':     return router.push(`/meetups`)
    case 'ACHIEVEMENT_UNLOCKED':return router.push(`/profile/achievements`)
    default:                    return router.push('/notifications')
  }
}
```

### 3.4 Polling vs. WebSocket

- Existing `ChatGateway` WebSocket covers chat messages only.
- Notifications (reminders, gym alerts, broadcasts) currently arrive via `GET /v1/notifications`. Poll every 30–60s while the app is foregrounded, or show a "new" badge from a periodic check. A push/WS implementation is out of scope for this round.

---

## 4. Per-Story Frontend Checklists

Each item is a suggested Vue component/page. File paths are illustrative — adapt to your project layout.

### US#20 View Other Students' Profiles
- **Page:** `pages/users/[id]/profile.vue` — existing, adjust for privacy empty states (bio: "Bio hidden", etc.)
- **Page:** `pages/users/compare.vue` — side-by-side layout, pulls `/v1/users/compare?a=&b=`
- **Component:** `ProfileCompareCard.vue` — renders one side with stats
- **Component:** `PrivacyHiddenBadge.vue` — reusable empty state
- **Settings:** `pages/settings/privacy.vue` — toggle privacy flags, binds to `PATCH /v1/user/profile/privacy`
- **Tests:** component test hiding `bio` when `privateBio=true` and viewer ≠ owner

### US#21 View Sports Videos
- **Page:** `pages/videos/index.vue` — grid with sport filter + pagination
- **Page:** `pages/videos/[id].vue` — player using `<video>` or a third-party component
- **Composable:** `useVideoProgress(videoId)` — `throttled` POST every 10s of playback, POST `{completed: true}` on `ended`
- **Store:** `stores/videoProgress.ts` — cache last-known progress per video
- **Tests:** progress POST is throttled; completed posts on `ended`

### US#22 Tournament Recap Videos
- **Component:** `TournamentRecapsSection.vue` — on tournament detail page; fetch `/tournaments/:id/recaps`; render "No recap videos yet" when `[]`
- **Component:** `UploadRecapDialog.vue` (org managers only) — either upload a Video first, then call `POST /tournaments/:id/recaps { videoId }`, or pick an existing video
- **Permission check:** hide upload button unless `currentUserOrgRole ∈ {STAFF, ADMIN}` for the tournament's org
- **Tests:** empty state; upload flow; non-completed tournament blocks the button

### US#24 View Gym Availability
- **Page:** `pages/gyms/[id]/availability.vue` — calendar grid (day × time-slots)
- **Filters:** date-range picker, location filter, status chip (AVAILABLE/RESERVED/CLOSED)
- **Composable:** `useGymAvailability(gymId, from, to)` — reactive slot loader
- **Tests:** filter reload; reserved styling

### US#25 Block Other Students
- **Entry points:** profile page overflow menu, message context menu — "Block this user"
- **Page:** `pages/settings/blocks.vue` — list my blocks, unblock button each
- **Store:** `stores/blocks.ts` (see 3.2)
- **UX:** confirm dialog before blocking
- **Tests:** blocking hides messaging actions; toast on 403

### US#26 Report Inappropriate Messages
- **Component:** `ReportMessageDialog.vue` — invoked from chat message long-press/context menu; pre-fills `messageId` + `reportedId` (sender), captures `reason`
- **Page:** `pages/settings/my-reports.vue` — table of my submitted reports with status chip
- **Tests:** duplicate message prevention (server 400); status display

### US#34 Engagement Rewards (Student)
- **Component:** `AchievementToast.vue` — subscribe to new notifications, show when `type === 'ACHIEVEMENT_UNLOCKED'`
- **Profile badges:** featured achievements already render on profile page
- **Page:** `pages/profile/achievements.vue` — full list, tiers with locked/unlocked state
- **No new pages required; hooks are all server-side

### US#35 Receive Tournament Reminders
- **Settings page:** `pages/settings/reminders.vue`:
  - Global default intervals (multi-select: 24h, 1h, 15m)
  - Per-tournament override table for tournaments the user is registered in
  - Bind to `PUT /v1/reminders/preferences`
- **Notification row deep-link** (see 3.3)

### US#37 Gym Availability Change Alerts
- **Button on gym page:** "Watch this gym" → `POST /v1/gyms/:id/subscribe`
- **Page:** `pages/settings/gym-subscriptions.vue` — list + unsubscribe
- **Banner on gym detail:** when subscribed, show "You'll be notified of status changes"

### US#39 Round Robin System
- **Tournament create form:** add `format` radio (Single-elimination / Round-robin). If RR selected, relax the max-teams-power-of-2 hint.
- **Tournament detail page (RR):** render `TournamentStandingsTable.vue` (wins/losses/pointDiff) + `RoundRobinScheduleGrid.vue`
- **Org-manager CTA:** after all RR matches completed, show "Seed Bracket from Standings" button → `POST /v1/tournaments/:id/seed-bracket`; on success, switch the detail view to the bracket tab
- **Tests:** seed button disabled until complete; RR standings sort order

### US#42 Announcement Group Chats
- Backend already complete; existing frontend work should already wire `ChatType.ANNOUNCEMENT`. Check that the "post message" input is disabled in the UI when the user's org role is not in `chat.writeRoles`.

### US#44 Inter-team Messaging
- **Enhancement:** existing team chat UI. Add search box to the "Start a conversation with another team" dialog bound to `GET /v1/teams?q=` (debounced 300ms), and a sport filter.
- **Tests:** search debounce; empty-state

### US#45 Block Teams
- Backend & existing frontend already complete. No additional changes.

### US#46 Schedule Meetups
- **Enhancement:** on `pages/teams/[id]/meetups.vue`, add a status tab bar (All / Pending / Accepted / Declined / Cancelled) — maps to `?status=` query param.

### US#49 Engagement Rewards (Team Member)
- Same component as US#34 (`AchievementToast.vue`). No new pages; tiers are just additional achievement definitions seeded server-side.

### US#50 Team Leader Gym Status
- **Component:** `UpdateGymSlotStatusDialog.vue` on gym detail page, visible only to team captains
- Form: status, optional team selector (defaults to user's captained team), note
- On success, show confirmation: "All subscribers will be notified"

### US#54 Team Broadcasts
- **Page:** `pages/teams/[id]/broadcasts.vue` — list existing broadcasts, mark-read on scroll-into-view
- **Component (captain-only):** `ComposeBroadcastForm.vue` — body textarea (max 2000 chars) → `POST /teams/:teamId/broadcasts`
- **Component:** `BroadcastStatsBadge.vue` (captain only) — polls `/v1/broadcasts/:id/stats` every 10s, displays "5/12 read"
- **Recipient UX:** broadcast arrives as notification (`type === 'TEAM_BROADCAST'`); tapping marks read via `POST /v1/broadcasts/:id/read`

### US#56 / US#57 Department Moderation Dashboard
- **Route guard:** only render under `/moderation/*` when `currentUser.role ∈ {DEPT_MANAGER, ADMIN}` (fetch once; server enforces)
- **Page:** `pages/moderation/messages.vue` — table with search (`q`), date-range, team-filter; row actions Flag / Delete (both with reason modal)
- **Confirmations:** deletion dialog with required `reason` field; success toast confirms audit log recorded
- **Empty state:** "No flagged or recent inter-team messages"

### US#58 Suspend / Ban
- **Page:** `pages/moderation/users.vue` — search users, row actions Suspend / Ban / Unsuspend / Unban
- **Dialogs:** 
  - Suspend: duration picker (hours / days / weeks), reason textarea
  - Ban: reason textarea + "This is permanent" confirm checkbox
- **Visual indicator:** list shows active status badge per user

### US#59 Partial Restrictions
- Same page as US#58, separate tab: `pages/moderation/users.vue#restrictions`
- **Dialog:** multi-select restriction actions (Messaging / Team Joining / Tournament Registration) + duration + reason
- **Unrestrict:** select one or more actions to lift

---

## 5. Settings / Navigation Inventory

New settings routes to add to your settings sidebar:

```
Settings
├── Profile
├── Privacy                    (existing — no change)
├── Reminders                  (NEW — US#35)
├── Gym subscriptions          (NEW — US#37)
├── Blocked users              (NEW — US#25)
└── My reports                 (NEW — US#26)

(dept managers + admins only)
Moderation
├── Messages                   (NEW — US#56/57)
└── Users                      (NEW — US#58/59)

(team captains only, per team)
Team
├── Broadcasts                 (NEW — US#54)
├── Blocked teams              (existing — US#45)
├── Members / Invitations      (existing)
└── Meetups                    (existing + status tab — US#46)
```

---

## 6. State Management

### Suggested Pinia stores

```
stores/
├── auth.ts                    (existing)
├── notifications.ts           (existing — extend with metadata/readAt)
├── blocks.ts                  (NEW — US#25)
├── reminders.ts               (NEW — US#35)
├── gymSubscriptions.ts        (NEW — US#37)
├── videoProgress.ts           (NEW — US#21)
├── broadcasts.ts              (NEW — US#54; scoped per teamId)
└── moderation.ts              (NEW — US#56-59; dept mgrs only)
```

Pattern: every store exposes `{ state, load(), optimistic mutators, reset() }`. Avoid caching moderation data beyond session boundaries.

---

## 7. Testing Strategy

- **Unit (component):** Vitest + @vue/test-utils. Mock the API layer, assert rendering + emit contracts.
- **Store:** Vitest + Pinia's `createTestingPinia`. Assert actions invoke the right API paths.
- **E2E:** Playwright — recommended flows:
  - Student reports a message → sees it in "My reports" with PENDING
  - Block a user → verify messaging fails with toast
  - Captain broadcasts → teammate sees notification + marks read → captain sees 1/N in stats
  - RR tournament → org mgr seeds bracket → matches rendered
  - Dept mgr suspends user → that user's next request 401s → redirected to login

---

## 8. Rollout Order

Recommended sequencing, mirroring backend commit order:

1. **Foundation:** regenerate API client; wire global 401/403 interceptor; update notification DTO + metadata routing
2. **US#20/21/22:** profile privacy UI, profile compare, video progress, tournament recaps
3. **US#24/37/50:** gym calendar, subscriptions, captain status updates
4. **US#25/26:** user blocks + message reports
5. **US#34/49:** achievement toast (server work only — UI is minimal)
6. **US#35/39:** reminder preferences UI + tournament RR seed button
7. **US#44/46/54:** team search filter, meetup status tabs, broadcasts page
8. **US#56/57/58/59:** moderation dashboard (gate on role)

Ship each bundle behind a feature flag if you have one — each depends only on its own migration already being applied.

---

## 9. Known Edge Cases

- **Privacy + comparison:** if viewer is blocked by *either* user in `/users/compare`, the server returns 403. Handle by redirecting back to the compare selector with a message.
- **Reminder defaults:** if the user never set preferences, the server uses `[1440, 60]` (24h + 1h). Surface this default in the UI so users know why reminders are arriving.
- **Broadcast receipts:** only accurate for current team members. If someone leaves the team after a broadcast is sent, their receipt remains — `delivered` count won't decrease.
- **Gym status fan-out:** only fires for *subscribers*, not all students. Make sure the "Watch this gym" CTA is prominent or users won't know to subscribe.
- **Restriction UX:** a user with `MESSAGING` restricted should *still* be able to load chat history and receive new messages — only the send-input is disabled. Don't blanket-hide the chat.
- **Audit transparency:** when a message is deleted by dept moderation, the sender gets a notification with the reason. Consider showing a "deleted by moderator" placeholder to other participants instead of silent removal.

---

## 10. Open Questions for Product

- Do suspended users get a specific landing page explaining the suspension + expiry time?
- Should broadcast read receipts be private to captain, or visible team-wide?
- Should profile comparison be linked prominently (e.g., "Compare with me" on other profiles) or only discoverable from a separate search page?
- For reminders: is one universal interval per tournament acceptable, or should we allow distinct 24h/1h settings per reminder (vs per user)?

---

_Backend reference: [README.md](../README.md) • [DTO guide](DTO.md) • [OpenAPI guide](OPENAPI.md)_
