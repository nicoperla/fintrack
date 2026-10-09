-- AlterTable
ALTER TABLE "users" ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totp_last_step" INTEGER,
ADD COLUMN     "totp_secret" TEXT,
ADD COLUMN     "two_factor_enabled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "login_tickets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_hash" TEXT NOT NULL,
    "device_label" TEXT NOT NULL,
    "place" TEXT,
    "second_factor_done" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "known_devices" (
    "user_id" TEXT NOT NULL,
    "device_hash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "place" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "known_devices_pkey" PRIMARY KEY ("user_id","device_hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_tickets_token_hash_key" ON "login_tickets"("token_hash");

-- CreateIndex
CREATE INDEX "login_tickets_user_id_idx" ON "login_tickets"("user_id");

-- CreateIndex
CREATE INDEX "login_tickets_expires_at_idx" ON "login_tickets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_codes_user_id_code_hash_key" ON "recovery_codes"("user_id", "code_hash");

-- AddForeignKey
ALTER TABLE "login_tickets" ADD CONSTRAINT "login_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

