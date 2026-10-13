-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "website" VARCHAR(2048),
    "location" VARCHAR(150),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_user_id_idx" ON "companies"("user_id");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Company names are unique per user, ignoring case (TECHNICAL_SPEC.md, section 14).
-- Prisma cannot express this index, so it is written here and kept out of schema.prisma.
CREATE UNIQUE INDEX "companies_user_id_lower_name_key" ON "companies" ("user_id", lower("name"));

-- Defense in depth (TECHNICAL_SPEC.md, section 18.1): deny the Data API roles by default.
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;