-- CreateTable
CREATE TABLE "pacts" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "limit" DECIMAL(14,2) NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "only_mine" BOOLEAN NOT NULL DEFAULT true,
    "referee_name" TEXT,
    "referee_token_hash" TEXT,
    "referee_views" INTEGER NOT NULL DEFAULT 0,
    "referee_last_viewed_at" TIMESTAMP(3),
    "promise" TEXT,
    "fine_amount" DECIMAL(14,2),
    "goal_id" TEXT,
    "fine_paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pacts_referee_token_hash_key" ON "pacts"("referee_token_hash");

-- CreateIndex
CREATE INDEX "pacts_household_id_period_to_idx" ON "pacts"("household_id", "period_to");

-- AddForeignKey
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

