-- CreateTable
CREATE TABLE "money_talks" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "held_by_id" TEXT,
    "held_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_talks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "money_decisions" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "topic" TEXT,
    "text" TEXT NOT NULL,
    "owner_id" TEXT,
    "due_on" DATE,
    "done_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "money_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "money_talks_household_id_month_key" ON "money_talks"("household_id", "month");

-- CreateIndex
CREATE INDEX "money_decisions_household_id_month_idx" ON "money_decisions"("household_id", "month");

-- AddForeignKey
ALTER TABLE "money_talks" ADD CONSTRAINT "money_talks_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_talks" ADD CONSTRAINT "money_talks_held_by_id_fkey" FOREIGN KEY ("held_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_decisions" ADD CONSTRAINT "money_decisions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_decisions" ADD CONSTRAINT "money_decisions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_decisions" ADD CONSTRAINT "money_decisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

