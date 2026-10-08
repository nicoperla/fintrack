-- DropForeignKey
ALTER TABLE "money_decisions" DROP CONSTRAINT "money_decisions_created_by_id_fkey";

-- AlterTable
ALTER TABLE "money_decisions" DROP COLUMN "created_by_id";

