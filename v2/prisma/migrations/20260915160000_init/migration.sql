-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MASTER_ADMIN', 'ORGANIZER', 'OWNER');
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER');
CREATE TYPE "BillType" AS ENUM ('INVOICE', 'RECEIPT', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

CREATE TABLE "Society" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "pincode" TEXT,
  "logoUrl" TEXT,
  "contact" TEXT,
  "authorizedSignatory" TEXT,
  "reportFooter" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Society_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Flat" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "flatNumber" TEXT NOT NULL,
  "ownerName" TEXT,
  "mobile" TEXT,
  "email" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Flat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Flat_societyId_flatNumber_key" ON "Flat"("societyId", "flatNumber");
CREATE INDEX "Flat_societyId_status_idx" ON "Flat"("societyId", "status");

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mobile" TEXT,
  "role" "Role" NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "societyId" TEXT NOT NULL,
  "flatId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_societyId_role_idx" ON "User"("societyId", "role");

CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "gujaratiTitle" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "time" TEXT,
  "location" TEXT,
  "type" TEXT,
  "description" TEXT,
  "imageUrl" TEXT,
  "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
  "visibility" TEXT NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Event_societyId_date_idx" ON "Event"("societyId", "date");

CREATE TABLE "Income" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "eventId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "receivedFrom" TEXT,
  "amountPaise" BIGINT NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "referenceNumber" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Income_societyId_date_idx" ON "Income"("societyId", "date");
CREATE INDEX "Income_societyId_category_idx" ON "Income"("societyId", "category");

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "eventId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "paidTo" TEXT,
  "amountPaise" BIGINT NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "billNumber" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Expense_societyId_date_idx" ON "Expense"("societyId", "date");
CREATE INDEX "Expense_societyId_category_idx" ON "Expense"("societyId", "category");

CREATE TABLE "Bill" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "eventId" TEXT,
  "type" "BillType" NOT NULL,
  "fileUrl" TEXT,
  "amountPaise" BIGINT NOT NULL,
  "vendor" TEXT,
  "category" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "paymentMethod" "PaymentMethod",
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Bill_societyId_date_idx" ON "Bill"("societyId", "date");

CREATE TABLE "Notice" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "gujaratiTitle" TEXT,
  "content" TEXT NOT NULL,
  "gujaratiContent" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "important" BOOLEAN NOT NULL DEFAULT false,
  "imageUrl" TEXT,
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notice_societyId_status_date_idx" ON "Notice"("societyId", "status", "date");

CREATE TABLE "Photo" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "eventId" TEXT,
  "title" TEXT,
  "fileUrl" TEXT NOT NULL,
  "altText" TEXT,
  "albumName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Photo_societyId_eventId_idx" ON "Photo"("societyId", "eventId");

CREATE TABLE "PaymentAccount" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "displayName" TEXT NOT NULL,
  "upiId" TEXT,
  "qrImageUrl" TEXT,
  "purpose" TEXT NOT NULL,
  "instructions" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentAccount_societyId_status_idx" ON "PaymentAccount"("societyId", "status");

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "eventId" TEXT,
  "paymentAccountId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "amountPaise" BIGINT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "transactionId" TEXT,
  "screenshotUrl" TEXT,
  "notes" TEXT,
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payment_societyId_status_initiatedAt_idx" ON "Payment"("societyId", "status", "initiatedAt");
CREATE INDEX "Payment_ownerUserId_createdAt_idx" ON "Payment"("ownerUserId", "createdAt");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "recordId" TEXT,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

ALTER TABLE "Flat" ADD CONSTRAINT "Flat_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
