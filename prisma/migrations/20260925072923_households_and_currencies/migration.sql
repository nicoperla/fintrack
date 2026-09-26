-- Shared spaces (households) and multiple currencies.
--
-- Expand step, compatible with the previous app version: the database is shared with production,
-- which keeps running the old code until the new one is deployed. The triggers at the bottom fill
-- the new columns for rows that the old code inserts; a follow-up migration drops them.

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "household_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("household_id","user_id")
);

-- CreateTable
CREATE TABLE "household_invites" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "date" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("date","currency")
);

-- Every existing user gets a personal space with their own id, and becomes its owner.
INSERT INTO "households" ("id", "name", "currency", "owner_id", "updated_at")
SELECT "id",
       'Spazio di ' || COALESCE(NULLIF(split_part(trim("name"), ' ', 1), ''), split_part("email", '@', 1)),
       'EUR', "id", CURRENT_TIMESTAMP
FROM "users";

INSERT INTO "household_members" ("household_id", "user_id", "role")
SELECT "id", "id", 'OWNER' FROM "users";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "active_household_id" TEXT;

-- Data moves from the user to their space; user_id stays as "created by".
ALTER TABLE "accounts" ADD COLUMN "household_id" TEXT, ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "budgets" ADD COLUMN "household_id" TEXT, ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "categories" ADD COLUMN "household_id" TEXT, ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "debts" ADD COLUMN "household_id" TEXT, ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "goals" ADD COLUMN "household_id" TEXT, ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "transactions" ADD COLUMN "household_id" TEXT,
    ADD COLUMN "base_amount" DECIMAL(14,2),
    ADD COLUMN "transfer_amount" DECIMAL(14,2),
    ALTER COLUMN "user_id" DROP NOT NULL;

UPDATE "accounts" SET "household_id" = "user_id";
UPDATE "budgets" SET "household_id" = "user_id";
UPDATE "categories" SET "household_id" = "user_id";
UPDATE "debts" SET "household_id" = "user_id";
UPDATE "goals" SET "household_id" = "user_id";
-- Everything so far was in euro, the default base currency.
UPDATE "transactions" SET "household_id" = "user_id", "base_amount" = "amount";

ALTER TABLE "accounts" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "budgets" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "debts" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "goals" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "household_id" SET NOT NULL,
    ALTER COLUMN "base_amount" SET NOT NULL;

-- A destination amount only makes sense for transfers.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_amount_check"
    CHECK ("transfer_amount" IS NULL OR ("type" = 'TRANSFER' AND "transfer_amount" > 0));

-- Foreign keys: data now cascades with its space; the author link survives the author.
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_user_id_fkey";
ALTER TABLE "categories" DROP CONSTRAINT "categories_user_id_fkey";
ALTER TABLE "debts" DROP CONSTRAINT "debts_user_id_fkey";
ALTER TABLE "goals" DROP CONSTRAINT "goals_user_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_id_fkey";

DROP INDEX "accounts_user_id_idx";
DROP INDEX "budgets_user_id_idx";
DROP INDEX "categories_user_id_idx";
DROP INDEX "debts_user_id_idx";
DROP INDEX "goals_user_id_idx";
DROP INDEX "transactions_user_id_date_idx";

CREATE INDEX "households_owner_id_idx" ON "households"("owner_id");
CREATE INDEX "household_members_user_id_idx" ON "household_members"("user_id");
CREATE UNIQUE INDEX "household_invites_token_hash_key" ON "household_invites"("token_hash");
CREATE INDEX "household_invites_household_id_idx" ON "household_invites"("household_id");
CREATE INDEX "accounts_household_id_idx" ON "accounts"("household_id");
CREATE INDEX "budgets_household_id_idx" ON "budgets"("household_id");
CREATE INDEX "categories_household_id_idx" ON "categories"("household_id");
CREATE INDEX "debts_household_id_idx" ON "debts"("household_id");
CREATE INDEX "goals_household_id_idx" ON "goals"("household_id");
CREATE INDEX "transactions_household_id_date_idx" ON "transactions"("household_id", "date");
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

ALTER TABLE "users" ADD CONSTRAINT "users_active_household_id_fkey" FOREIGN KEY ("active_household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "households" ADD CONSTRAINT "households_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "debts" ADD CONSTRAINT "debts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Transitional triggers (dropped by the next migration) ----------

-- Users registered by the old code get their personal space.
CREATE FUNCTION "fintrack_personal_household"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "households" ("id", "name", "currency", "owner_id", "updated_at")
  VALUES (NEW."id",
          'Spazio di ' || COALESCE(NULLIF(split_part(trim(NEW."name"), ' ', 1), ''), split_part(NEW."email", '@', 1)),
          'EUR', NEW."id", CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;
  INSERT INTO "household_members" ("household_id", "user_id", "role")
  VALUES (NEW."id", NEW."id", 'OWNER')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_personal_household" AFTER INSERT ON "users"
  FOR EACH ROW EXECUTE FUNCTION "fintrack_personal_household"();

-- Rows inserted by the old code only know the user: put them in that user's personal space.
CREATE FUNCTION "fintrack_default_household"() RETURNS trigger AS $$
BEGIN
  NEW."household_id" := COALESCE(NEW."household_id", NEW."user_id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "accounts_default_household" BEFORE INSERT ON "accounts" FOR EACH ROW EXECUTE FUNCTION "fintrack_default_household"();
CREATE TRIGGER "budgets_default_household" BEFORE INSERT ON "budgets" FOR EACH ROW EXECUTE FUNCTION "fintrack_default_household"();
CREATE TRIGGER "categories_default_household" BEFORE INSERT ON "categories" FOR EACH ROW EXECUTE FUNCTION "fintrack_default_household"();
CREATE TRIGGER "debts_default_household" BEFORE INSERT ON "debts" FOR EACH ROW EXECUTE FUNCTION "fintrack_default_household"();
CREATE TRIGGER "goals_default_household" BEFORE INSERT ON "goals" FOR EACH ROW EXECUTE FUNCTION "fintrack_default_household"();
CREATE TRIGGER "transactions_default_household" BEFORE INSERT ON "transactions" FOR EACH ROW EXECUTE FUNCTION "fintrack_default_household"();

-- The old code only writes euro amounts: the base amount is the amount itself.
CREATE FUNCTION "fintrack_default_base_amount"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."base_amount" := COALESCE(NEW."base_amount", NEW."amount");
  ELSIF NEW."amount" IS DISTINCT FROM OLD."amount" AND NEW."base_amount" IS NOT DISTINCT FROM OLD."base_amount" THEN
    NEW."base_amount" := NEW."amount";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "transactions_default_base_amount" BEFORE INSERT OR UPDATE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION "fintrack_default_base_amount"();
