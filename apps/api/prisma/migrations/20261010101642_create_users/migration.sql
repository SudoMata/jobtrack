-- CreateEnum
CREATE TYPE "role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "role" NOT NULL DEFAULT 'USER',
    "account_status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "display_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");


-- Defense in depth (TECHNICAL_SPEC.md, section 18.1): deny the Data API roles by default.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;