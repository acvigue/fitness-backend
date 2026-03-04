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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
