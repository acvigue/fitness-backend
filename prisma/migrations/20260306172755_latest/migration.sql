/*
  Warnings:

  - The values [OPEN,REVIEWING,CLOSED] on the enum `StatusOnReport` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StatusOnReport_new" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED');
ALTER TABLE "public"."Report" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Report" ALTER COLUMN "status" TYPE "StatusOnReport_new" USING ("status"::text::"StatusOnReport_new");
ALTER TYPE "StatusOnReport" RENAME TO "StatusOnReport_old";
ALTER TYPE "StatusOnReport_new" RENAME TO "StatusOnReport";
DROP TYPE "public"."StatusOnReport_old";
ALTER TABLE "Report" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "status" SET DEFAULT 'PENDING';
