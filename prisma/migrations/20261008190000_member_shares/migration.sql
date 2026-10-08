-- AlterTable
ALTER TABLE "household_members" ADD COLUMN     "shares" TEXT[] DEFAULT ARRAY[]::TEXT[];

