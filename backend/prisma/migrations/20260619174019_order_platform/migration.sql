-- CreateEnum
CREATE TYPE "OrderPlatform" AS ENUM ('OTHER', 'FOODPANDA', 'PATHAO', 'FOODI', 'SHOHOZ');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "platform" "OrderPlatform" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "platformOrderId" TEXT;
