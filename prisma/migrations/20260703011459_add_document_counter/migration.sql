-- CreateTable
CREATE TABLE "document_counters" (
    "prefix" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("prefix")
);

-- Backfill: khởi tạo bộ đếm từ mã lớn nhất hiện có của mỗi bảng
-- (regex ^XX[0-9]+$ để bỏ qua mã không đúng định dạng, tránh lỗi CAST)
INSERT INTO "document_counters" ("prefix", "lastNumber") VALUES
  ('HD',  COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INT)) FROM "invoices"   WHERE "code" ~ '^HD[0-9]+$'), 0)),
  ('BG',  COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INT)) FROM "quotations" WHERE "code" ~ '^BG[0-9]+$'), 0)),
  ('PT',  COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INT)) FROM "receipts"   WHERE "code" ~ '^PT[0-9]+$'), 0)),
  ('PC',  COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INT)) FROM "payments"   WHERE "code" ~ '^PC[0-9]+$'), 0)),
  ('SP',  COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INT)) FROM "products"   WHERE "code" ~ '^SP[0-9]+$'), 0)),
  ('KH',  COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INT)) FROM "customers"  WHERE "code" ~ '^KH[0-9]+$'), 0)),
  ('CP',  COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INT)) FROM "expenses"   WHERE "code" ~ '^CP[0-9]+$'), 0)),
  ('NCC', COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 4) AS INT)) FROM "suppliers"  WHERE "code" ~ '^NCC[0-9]+$'), 0)),
  ('KHO', COALESCE((SELECT MAX(CAST(SUBSTRING("code" FROM 4) AS INT)) FROM "warehouses" WHERE "code" ~ '^KHO[0-9]+$'), 0));
