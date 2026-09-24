-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transfer_account_id" TEXT;

-- CreateIndex
CREATE INDEX "transactions_transfer_account_id_idx" ON "transactions"("transfer_account_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_account_id_fkey" FOREIGN KEY ("transfer_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity checks (not expressible in Prisma schema). type::text avoids using the new enum value in this transaction.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_shape" CHECK (
  ("type"::text = 'TRANSFER') = ("transfer_account_id" IS NOT NULL)
  AND ("type"::text <> 'TRANSFER' OR "category_id" IS NULL)
  AND ("transfer_account_id" IS NULL OR "transfer_account_id" <> "account_id")
);
