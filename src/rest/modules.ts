import { AuditModule } from '@/rest/audit/audit.module';
import { ChatModule } from '@/rest/chat/chat.module';
import { EngagementModule } from '@/rest/engagement/engagement.module';
import { GymModule } from '@/rest/gym/gym.module';
import { HealthModule } from '@/rest/health/health.module';
import { NotificationModule } from '@/rest/notification/notification.module';
import { OrganizationModule } from '@/rest/organization/organization.module';
import { ReportModule } from '@/rest/report/report.module';
import { SportModule } from '@/rest/sport/sport.module';
import { MeetupModule } from '@/rest/meetup/meetup.module';
import { TeamModule } from '@/rest/team/team.module';
import { TeamBlockModule } from '@/rest/team-block/team-block.module';
import { TeamChatModule } from '@/rest/team-chat/team-chat.module';
import { UserModule } from '@/rest/user/user.module';
import { TournamentModule } from '@/rest/tournament/tournament.module';
import { UtilsModule } from '@/rest/utils/utils.module';
import { AchievementModule } from '~/rest/achievement/achievement.module';
import { VideoModule } from './video/video.module';

export const restFeatureModules = [
  AchievementModule,
  AuditModule,
  ChatModule,
  EngagementModule,
  GymModule,
  HealthModule,
  MeetupModule,
  NotificationModule,
  OrganizationModule,
  ReportModule,
  SportModule,
  TeamModule,
  TeamBlockModule,
  TeamChatModule,
  TournamentModule,
  UserModule,
  UtilsModule,
  VideoModule,
] as const;
