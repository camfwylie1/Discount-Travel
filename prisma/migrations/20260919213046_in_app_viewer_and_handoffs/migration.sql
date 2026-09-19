-- AlterTable
ALTER TABLE "DealClick" ADD COLUMN     "openedAs" TEXT NOT NULL DEFAULT 'NEW_TAB',
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProviderCompliance" ADD COLUMN     "framingNotes" TEXT,
ADD COLUMN     "framingPermitted" BOOLEAN NOT NULL DEFAULT false;
