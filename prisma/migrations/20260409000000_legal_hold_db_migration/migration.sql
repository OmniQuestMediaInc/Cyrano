-- CreateTable
CREATE TABLE "legal_holds" (
    "id" TEXT NOT NULL,
    "hold_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "applied_by" TEXT NOT NULL,
    "applied_at_utc" TIMESTAMP(3) NOT NULL,
    "lifted_by" TEXT,
    "lifted_at_utc" TIMESTAMP(3),
    "reason_code" TEXT NOT NULL,
    "rule_applied_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_holds_hold_id_key" ON "legal_holds"("hold_id");
