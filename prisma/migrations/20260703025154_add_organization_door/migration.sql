-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
