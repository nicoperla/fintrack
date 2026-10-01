-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "deduction" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dependent_children" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "found_money_dismissals" (
    "household_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "found_money_dismissals_pkey" PRIMARY KEY ("household_id","key")
);

-- AddForeignKey
ALTER TABLE "found_money_dismissals" ADD CONSTRAINT "found_money_dismissals_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

