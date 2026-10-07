-- CreateEnum
CREATE TYPE "ClaimKind" AS ENUM ('CANCELLATION', 'DIRECT_DEBIT_REFUND', 'BANK_COMPLAINT', 'DUPLICATE_CHARGE');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SENT', 'WON', 'PARTIAL', 'LOST', 'DROPPED');

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" "ClaimKind" NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "finding_key" TEXT,
    "transaction_id" TEXT,
    "counterparty" TEXT NOT NULL,
    "expected_amount" DECIMAL(14,2) NOT NULL,
    "recovered_amount" DECIMAL(14,2),
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT,
    "sent_at" DATE,
    "effective_from" DATE,
    "deadline" DATE,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "claims_household_id_status_idx" ON "claims"("household_id", "status");

-- CreateIndex
CREATE INDEX "claims_transaction_id_idx" ON "claims"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_household_id_finding_key_key" ON "claims"("household_id", "finding_key");

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

