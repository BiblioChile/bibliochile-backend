-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "gutendex_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Book_gutendex_id_key" ON "Book"("gutendex_id");
