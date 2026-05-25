-- CreateEnum
CREATE TYPE "CompanyPlan" AS ENUM ('BASIC', 'PRO');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "plan" "CompanyPlan" NOT NULL DEFAULT 'BASIC';
