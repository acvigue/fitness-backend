-- CreateTable
CREATE TABLE "reminder_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT,
    "intervals_minutes" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_dispatches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "interval_minutes" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_preferences_tournament_id_idx" ON "reminder_preferences"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_preferences_user_id_tournament_id_key" ON "reminder_preferences"("user_id", "tournament_id");

-- CreateIndex
CREATE INDEX "reminder_dispatches_tournament_id_idx" ON "reminder_dispatches"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_dispatches_user_id_tournament_id_interval_minutes_key" ON "reminder_dispatches"("user_id", "tournament_id", "interval_minutes");

-- AddForeignKey
ALTER TABLE "reminder_preferences" ADD CONSTRAINT "reminder_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_preferences" ADD CONSTRAINT "reminder_preferences_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
