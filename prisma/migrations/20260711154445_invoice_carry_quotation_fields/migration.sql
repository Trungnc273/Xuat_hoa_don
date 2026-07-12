-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';
