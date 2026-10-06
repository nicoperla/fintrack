-- CreateTable
CREATE TABLE "investment_valuations" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_valuations_household_id_idx" ON "investment_valuations"("household_id");

-- CreateIndex
CREATE UNIQUE INDEX "investment_valuations_account_id_date_key" ON "investment_valuations"("account_id", "date");

-- AddForeignKey
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

