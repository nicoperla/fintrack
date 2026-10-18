-- "Il mio 730": the folder status of each deductible expense.
ALTER TABLE "transactions" ADD COLUMN     "deduction_doc" TEXT;

-- "Il mio 730": one person's journey through the 730 of an income year.
CREATE TABLE "tax_years" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "answers" JSONB,
    "cu" JSONB,
    "documents" JSONB,
    "decision" TEXT,
    "channel" TEXT,
    "sent_at" DATE,
    "result" DECIMAL(14,2),
    "second_advance" DECIMAL(14,2),
    "refund_received_at" DATE,
    "share_capacity" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_years_user_id_year_key" ON "tax_years"("user_id", "year");

ALTER TABLE "tax_years" ADD CONSTRAINT "tax_years_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
