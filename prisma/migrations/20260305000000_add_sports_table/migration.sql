-- AlterTable
ALTER TABLE "user_profiles" DROP COLUMN "favoriteSports";

-- CreateTable
CREATE TABLE "sports" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserFavoriteSports" (
    "A" UUID NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserFavoriteSports_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");

-- CreateIndex
CREATE INDEX "_UserFavoriteSports_B_index" ON "_UserFavoriteSports"("B");

-- AddForeignKey
ALTER TABLE "_UserFavoriteSports" ADD CONSTRAINT "_UserFavoriteSports_A_fkey" FOREIGN KEY ("A") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserFavoriteSports" ADD CONSTRAINT "_UserFavoriteSports_B_fkey" FOREIGN KEY ("B") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed sports
INSERT INTO "sports" ("id", "name", "icon") VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Running', '🏃'),
  ('a1b2c3d4-0001-4000-8000-000000000002', 'Swimming', '🏊'),
  ('a1b2c3d4-0001-4000-8000-000000000003', 'Cycling', '🚴'),
  ('a1b2c3d4-0001-4000-8000-000000000004', 'Weightlifting', '🏋️'),
  ('a1b2c3d4-0001-4000-8000-000000000005', 'Yoga', '🧘'),
  ('a1b2c3d4-0001-4000-8000-000000000006', 'Basketball', '🏀'),
  ('a1b2c3d4-0001-4000-8000-000000000007', 'Soccer', '⚽'),
  ('a1b2c3d4-0001-4000-8000-000000000008', 'Tennis', '🎾'),
  ('a1b2c3d4-0001-4000-8000-000000000009', 'Boxing', '🥊'),
  ('a1b2c3d4-0001-4000-8000-000000000010', 'CrossFit', '💪'),
  ('a1b2c3d4-0001-4000-8000-000000000011', 'Hiking', '🥾'),
  ('a1b2c3d4-0001-4000-8000-000000000012', 'Rock Climbing', '🧗'),
  ('a1b2c3d4-0001-4000-8000-000000000013', 'Martial Arts', '🥋'),
  ('a1b2c3d4-0001-4000-8000-000000000014', 'Rowing', '🚣'),
  ('a1b2c3d4-0001-4000-8000-000000000015', 'Volleyball', '🏐'),
  ('a1b2c3d4-0001-4000-8000-000000000016', 'Baseball', '⚾'),
  ('a1b2c3d4-0001-4000-8000-000000000017', 'Golf', '⛳'),
  ('a1b2c3d4-0001-4000-8000-000000000018', 'Skiing', '⛷️'),
  ('a1b2c3d4-0001-4000-8000-000000000019', 'Surfing', '🏄'),
  ('a1b2c3d4-0001-4000-8000-000000000020', 'Gymnastics', '🤸'),
  ('a1b2c3d4-0001-4000-8000-000000000021', 'Pilates', '🧎'),
  ('a1b2c3d4-0001-4000-8000-000000000022', 'Dance', '💃'),
  ('a1b2c3d4-0001-4000-8000-000000000023', 'Badminton', '🏸'),
  ('a1b2c3d4-0001-4000-8000-000000000024', 'Table Tennis', '🏓'),
  ('a1b2c3d4-0001-4000-8000-000000000025', 'Football', '🏈'),
  ('a1b2c3d4-0001-4000-8000-000000000026', 'Hockey', '🏒'),
  ('a1b2c3d4-0001-4000-8000-000000000027', 'Skateboarding', '🛹'),
  ('a1b2c3d4-0001-4000-8000-000000000028', 'Snowboarding', '🏂'),
  ('a1b2c3d4-0001-4000-8000-000000000029', 'Wrestling', '🤼'),
  ('a1b2c3d4-0001-4000-8000-000000000030', 'Fencing', '🤺')
ON CONFLICT ("name") DO NOTHING;
