-- AlterTable
ALTER TABLE "users" ADD COLUMN     "monthly_net_income" DECIMAL(14,2),
ADD COLUMN     "show_work_time" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "work_hours_per_week" INTEGER NOT NULL DEFAULT 40;
