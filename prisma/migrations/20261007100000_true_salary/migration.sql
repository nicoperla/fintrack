-- AlterTable
ALTER TABLE "households" ADD COLUMN     "fourteenth_salary" DECIMAL(14,2),
ADD COLUMN     "payday" INTEGER,
ADD COLUMN     "reserve_account_id" TEXT,
ADD COLUMN     "thirteenth_salary" DECIMAL(14,2),
ADD COLUMN     "true_salary_since" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "big_expenses" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "preset" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 1,
    "paid_through" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "big_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "big_expenses_household_id_idx" ON "big_expenses"("household_id");

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_reserve_account_id_fkey" FOREIGN KEY ("reserve_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "big_expenses" ADD CONSTRAINT "big_expenses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

