-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "audienceRoles" "Role"[];

-- AlterTable
ALTER TABLE "ScheduledEmail" ADD COLUMN "audienceRoles" "Role"[];
