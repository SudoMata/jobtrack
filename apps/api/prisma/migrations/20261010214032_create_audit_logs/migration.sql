-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('ROLE_CHANGED', 'USER_SUSPENDED', 'USER_REACTIVATED');

-- CreateEnum
CREATE TYPE "audit_resource_type" AS ENUM ('USER');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID NOT NULL,
    "action" "audit_action" NOT NULL,
    "resource_type" "audit_resource_type" NOT NULL,
    "resource_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth (TECHNICAL_SPEC.md, section 18.1): deny the Data API roles by default.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;