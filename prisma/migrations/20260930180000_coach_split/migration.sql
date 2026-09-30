-- CreateEnum
CREATE TYPE "SplitMode" AS ENUM ('EQUAL', 'INCOME');

-- AlterTable
ALTER TABLE "households" ADD COLUMN     "split_mode" "SplitMode" NOT NULL DEFAULT 'EQUAL',
ADD COLUMN     "split_since" DATE;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "coach_profile" JSONB;

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settlements_household_id_date_idx" ON "settlements"("household_id", "date");

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

