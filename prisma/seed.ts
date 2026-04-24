import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const dummyUsers = [
  { id: 'dummy-user-001', username: 'jane.smith', name: 'Jane Smith', email: 'jane.smith@example.com' },
  { id: 'dummy-user-002', username: 'mike.jones', name: 'Mike Jones', email: 'mike.jones@example.com' },
  { id: 'dummy-user-003', username: 'sarah.connor', name: 'Sarah Connor', email: 'sarah.connor@example.com' },
  { id: 'dummy-user-004', username: 'alex.kim', name: 'Alex Kim', email: 'alex.kim@example.com' },
  { id: 'dummy-user-005', username: 'chris.lee', name: 'Chris Lee', email: 'chris.lee@example.com' },
  { id: 'dummy-user-006', username: 'taylor.swift', name: 'Taylor Swift', email: 'taylor.swift@example.com' },
  { id: 'dummy-user-007', username: 'jordan.patel', name: 'Jordan Patel', email: 'jordan.patel@example.com' },
  { id: 'dummy-user-008', username: 'morgan.chen', name: 'Morgan Chen', email: 'morgan.chen@example.com' },
  { id: 'dummy-user-009', username: 'riley.garcia', name: 'Riley Garcia', email: 'riley.garcia@example.com' },
  { id: 'dummy-user-010', username: 'sam.wilson', name: 'Sam Wilson', email: 'sam.wilson@example.com' },
];

async function main() {
  console.log('Seeding dummy users...');

  for (const user of dummyUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { username: user.username, name: user.name, email: user.email },
      create: user,
    });
    console.log(`  Upserted: ${user.name} (${user.username})`);
  }

  console.log(`Done — ${dummyUsers.length} dummy users seeded.`);

  console.log('Seeding achievement definitions...');

  const achievements = [
    // Tournament participation
    { name: 'First Steps', description: 'Participate in your first tournament', criteriaType: 'TOURNAMENT_PARTICIPATION', threshold: 1, icon: null },
    { name: 'Regular Competitor', description: 'Participate in 5 tournaments', criteriaType: 'TOURNAMENT_PARTICIPATION', threshold: 5, icon: null },
    { name: 'Tournament Veteran', description: 'Participate in 20 tournaments', criteriaType: 'TOURNAMENT_PARTICIPATION', threshold: 20, icon: null },
    // Tournament match wins
    { name: 'First Victory', description: 'Win your first tournament match', criteriaType: 'TOURNAMENT_MATCH_WIN', threshold: 1, icon: null },
    { name: 'On a Roll', description: 'Win 10 tournament matches', criteriaType: 'TOURNAMENT_MATCH_WIN', threshold: 10, icon: null },
    { name: 'Match Master', description: 'Win 50 tournament matches', criteriaType: 'TOURNAMENT_MATCH_WIN', threshold: 50, icon: null },
    // Tournament wins
    { name: 'Champion', description: 'Win your first tournament', criteriaType: 'TOURNAMENT_WIN', threshold: 1, icon: null },
    { name: 'Dynasty', description: 'Win 5 tournaments', criteriaType: 'TOURNAMENT_WIN', threshold: 5, icon: null },
    { name: 'Legendary', description: 'Win 10 tournaments', criteriaType: 'TOURNAMENT_WIN', threshold: 10, icon: null },
    // Team creation
    { name: 'Team Founder', description: 'Create your first team', criteriaType: 'TEAM_CREATE', threshold: 1, icon: null },
    { name: 'Serial Founder', description: 'Create 3 teams', criteriaType: 'TEAM_CREATE', threshold: 3, icon: null },
    { name: 'Empire Builder', description: 'Create 10 teams', criteriaType: 'TEAM_CREATE', threshold: 10, icon: null },
    // Team joining
    { name: 'Team Player', description: 'Join your first team', criteriaType: 'TEAM_JOIN', threshold: 1, icon: null },
    { name: 'Social Butterfly', description: 'Join 5 teams', criteriaType: 'TEAM_JOIN', threshold: 5, icon: null },
    { name: 'Networking Pro', description: 'Join 10 teams', criteriaType: 'TEAM_JOIN', threshold: 10, icon: null },
    // Organization creation
    { name: 'Organizer', description: 'Create your first organization', criteriaType: 'ORGANIZATION_CREATE', threshold: 1, icon: null },
    { name: 'Serial Organizer', description: 'Create 3 organizations', criteriaType: 'ORGANIZATION_CREATE', threshold: 3, icon: null },
    // Organization joining
    { name: 'New Member', description: 'Join your first organization', criteriaType: 'ORGANIZATION_JOIN', threshold: 1, icon: null },
    { name: 'Community Member', description: 'Join 3 organizations', criteriaType: 'ORGANIZATION_JOIN', threshold: 3, icon: null },
    { name: 'Community Leader', description: 'Join 10 organizations', criteriaType: 'ORGANIZATION_JOIN', threshold: 10, icon: null },
    // Student engagement (US#34)
    { name: 'First Message', description: 'Send your first message', criteriaType: 'MESSAGE_SENT', threshold: 1, icon: null },
    { name: 'Chatty', description: 'Send 50 messages', criteriaType: 'MESSAGE_SENT', threshold: 50, icon: null },
    { name: 'Conversationalist', description: 'Send 500 messages', criteriaType: 'MESSAGE_SENT', threshold: 500, icon: null },
    { name: 'First Group Chat', description: 'Create your first group chat', criteriaType: 'CHAT_CREATED', threshold: 1, icon: null },
    { name: 'First Profile Peek', description: 'View another student’s profile', criteriaType: 'PROFILE_VIEW', threshold: 1, icon: null },
    { name: 'Curious', description: 'View 25 profiles', criteriaType: 'PROFILE_VIEW', threshold: 25, icon: null },
    // Team engagement (US#49)
    { name: 'First Team Chat', description: 'Post your first team-chat message', criteriaType: 'TEAM_CHAT_MESSAGE', threshold: 1, icon: null },
    { name: 'Team Chatter', description: 'Post 50 team-chat messages', criteriaType: 'TEAM_CHAT_MESSAGE', threshold: 50, icon: null },
    { name: 'First Meetup', description: 'Attend your first meetup', criteriaType: 'MEETUP_ATTENDED', threshold: 1, icon: null },
    { name: 'Meetup Regular', description: 'Attend 10 meetups', criteriaType: 'MEETUP_ATTENDED', threshold: 10, icon: null },
    { name: 'Inter-Team Ambassador', description: 'Interact with 5 other teams', criteriaType: 'INTER_TEAM_INTERACTION', threshold: 5, icon: null },
  ];

  for (const achievement of achievements) {
    await prisma.achievementDefinition.upsert({
      where: { name: achievement.name },
      update: { description: achievement.description, criteriaType: achievement.criteriaType, threshold: achievement.threshold },
      create: achievement,
    });
    console.log(`  Upserted: ${achievement.name} (${achievement.criteriaType} × ${achievement.threshold})`);
  }

  console.log(`Done — ${achievements.length} achievement definitions seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
