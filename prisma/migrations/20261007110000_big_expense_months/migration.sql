-- AlterTable
ALTER TABLE "big_expenses" DROP COLUMN "installments",
DROP COLUMN "month",
ADD COLUMN     "months" INTEGER[];

