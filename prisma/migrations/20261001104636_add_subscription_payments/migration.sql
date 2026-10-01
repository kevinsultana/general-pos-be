-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SETTLEMENT', 'EXPIRE', 'CANCEL', 'FAILURE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "subscriptionExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "snapToken" TEXT,
    "snapRedirectUrl" TEXT,
    "paymentType" TEXT,
    "rawResponse" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_orderId_key" ON "SubscriptionPayment"("orderId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_orderId_idx" ON "SubscriptionPayment"("orderId");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
