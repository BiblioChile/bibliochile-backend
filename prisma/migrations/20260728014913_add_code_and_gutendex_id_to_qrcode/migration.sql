/*
  Warnings:

  - You are about to drop the column `target_book_id` on the `QRCode` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `QRCode` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `QRCode` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `QRCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gutendex_id` to the `QRCode` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "QRCode" DROP CONSTRAINT "QRCode_target_book_id_fkey";

-- AlterTable
ALTER TABLE "QRCode" DROP COLUMN "target_book_id",
DROP COLUMN "url",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "gutendex_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "QRCode_code_key" ON "QRCode"("code");
