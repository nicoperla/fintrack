-- CreateTable
CREATE TABLE "family_files" (
    "household_id" TEXT NOT NULL,
    "notes" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_files_pkey" PRIMARY KEY ("household_id")
);

-- CreateTable
CREATE TABLE "family_file_shares" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "show_amounts" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_file_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_file_shares_token_hash_key" ON "family_file_shares"("token_hash");

-- CreateIndex
CREATE INDEX "family_file_shares_household_id_idx" ON "family_file_shares"("household_id");

-- AddForeignKey
ALTER TABLE "family_files" ADD CONSTRAINT "family_files_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_file_shares" ADD CONSTRAINT "family_file_shares_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

