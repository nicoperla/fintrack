-- CreateTable
CREATE TABLE "investment_costs" (
    "account_id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entry_pct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "exit_pct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "ongoing_pct" DECIMAL(6,3) NOT NULL,
    "transaction_pct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "performance_pct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "monthly" DECIMAL(14,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_costs_pkey" PRIMARY KEY ("account_id")
);

-- CreateIndex
CREATE INDEX "investment_costs_household_id_idx" ON "investment_costs"("household_id");

-- AddForeignKey
ALTER TABLE "investment_costs" ADD CONSTRAINT "investment_costs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_costs" ADD CONSTRAINT "investment_costs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

