-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "minimum_payment" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debts_user_id_idx" ON "debts"("user_id");

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity checks (not expressible in the Prisma schema).
ALTER TABLE "debts" ADD CONSTRAINT "debts_balance_positive" CHECK ("balance" > 0);
ALTER TABLE "debts" ADD CONSTRAINT "debts_rate_range" CHECK ("interest_rate" >= 0 AND "interest_rate" <= 100);
ALTER TABLE "debts" ADD CONSTRAINT "debts_minimum_positive" CHECK ("minimum_payment" > 0);
