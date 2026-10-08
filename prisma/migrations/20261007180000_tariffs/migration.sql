-- CreateEnum
CREATE TYPE "TariffKind" AS ENUM ('CAR_INSURANCE', 'BANK_ACCOUNT', 'ELECTRICITY');

-- AlterTable
ALTER TABLE "households" ADD COLUMN     "household_size" INTEGER,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "tariff_pool_since" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tariff_checks" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "kind" "TariffKind" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "previous_amount" DECIMAL(14,2),
    "renews_on" DATE,
    "bonus_malus" INTEGER,
    "age_band" TEXT,
    "account_id" TEXT,
    "account_kind" TEXT,
    "period_from" DATE,
    "period_to" DATE,
    "kwh" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tariff_checks_household_id_kind_idx" ON "tariff_checks"("household_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_checks_household_id_account_id_key" ON "tariff_checks"("household_id", "account_id");

-- AddForeignKey
ALTER TABLE "tariff_checks" ADD CONSTRAINT "tariff_checks_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_checks" ADD CONSTRAINT "tariff_checks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

