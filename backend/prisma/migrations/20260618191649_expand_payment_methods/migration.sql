-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'DUE';
ALTER TYPE "PaymentMethod" ADD VALUE 'COMPLIMENT';
ALTER TYPE "PaymentMethod" ADD VALUE 'VISA';
ALTER TYPE "PaymentMethod" ADD VALUE 'AMEX';
ALTER TYPE "PaymentMethod" ADD VALUE 'MASTERCARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'BKASH';
ALTER TYPE "PaymentMethod" ADD VALUE 'NAGAD';
ALTER TYPE "PaymentMethod" ADD VALUE 'ROCKET';
ALTER TYPE "PaymentMethod" ADD VALUE 'FOODPANDA';
ALTER TYPE "PaymentMethod" ADD VALUE 'FOODI';
ALTER TYPE "PaymentMethod" ADD VALUE 'PATHAO';
ALTER TYPE "PaymentMethod" ADD VALUE 'OTHER';
