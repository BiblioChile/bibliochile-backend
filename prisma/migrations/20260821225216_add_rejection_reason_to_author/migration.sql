-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('problema_sistema', 'otro');

-- AlterTable
ALTER TABLE "Author" ADD COLUMN     "rejection_note" TEXT,
ADD COLUMN     "rejection_reason" "RejectionReason";
