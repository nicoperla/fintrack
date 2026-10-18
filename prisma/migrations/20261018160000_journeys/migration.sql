-- "Percorsi": a person following a life event step by step.
CREATE TABLE "user_journeys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "done" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_journeys_pkey" PRIMARY KEY ("id")
);

-- "Scadenze dei documenti": kind, name and expiry date of a person's documents.
CREATE TABLE "personal_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expires_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_journeys_user_id_key_key" ON "user_journeys"("user_id", "key");

CREATE INDEX "personal_documents_user_id_idx" ON "personal_documents"("user_id");

ALTER TABLE "user_journeys" ADD CONSTRAINT "user_journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_documents" ADD CONSTRAINT "personal_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
