/*
  Warnings:

  - A unique constraint covering the columns `[user_id,book_id]` on the table `ReadingProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[anonymous_uuid,book_id]` on the table `ReadingProgress` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_user_id_book_id_key" ON "ReadingProgress"("user_id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_anonymous_uuid_book_id_key" ON "ReadingProgress"("anonymous_uuid", "book_id");
