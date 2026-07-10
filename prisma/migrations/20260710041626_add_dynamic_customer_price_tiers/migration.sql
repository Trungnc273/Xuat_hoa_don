-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "priceTierId" TEXT;

-- CreateTable
CREATE TABLE "customer_price_tiers" (
    "organizationId" TEXT,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_tier_prices" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_tier_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_price_tiers_name_key" ON "customer_price_tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_tier_prices_productId_tierId_key" ON "product_tier_prices"("productId", "tierId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "customer_price_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tier_prices" ADD CONSTRAINT "product_tier_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tier_prices" ADD CONSTRAINT "product_tier_prices_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "customer_price_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
