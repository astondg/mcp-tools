/**
 * Test Setup
 *
 * Global setup for all tests
 * Runs before each test file
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/shared/db';

/**
 * Setup before all tests
 */
beforeAll(async () => {
  // Ensure test database is ready
  console.log('Setting up test environment...');

  // You might want to run migrations here
  // await execSync('npx prisma migrate deploy');
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  console.log('Cleaning up test environment...');

  // Disconnect Prisma
  await prisma.$disconnect();
});

/**
 * Setup before each test
 */
beforeEach(async () => {
  // Clean up database before each test
  // This ensures test isolation

  // Delete in order to respect foreign key constraints
  // Trip-related models
  await prisma.tripItinerarySlot.deleteMany();
  await prisma.tripItineraryDay.deleteMany();
  await prisma.tripItinerary.deleteMany();
  await prisma.tripReminder.deleteMany();
  await prisma.tripNote.deleteMany();
  await prisma.tripDocument.deleteMany();
  await prisma.tripContact.deleteMany();
  await prisma.tripPackingItem.deleteMany();
  await prisma.tripItemOption.deleteMany();
  await prisma.tripItem.deleteMany();
  await prisma.tripLocation.deleteMany();
  await prisma.trip.deleteMany();

  // Budget/expense models
  await prisma.expense.deleteMany();
  await prisma.budgetCategory.deleteMany();
  await prisma.income.deleteMany();
  await prisma.incomeSource.deleteMany();

  // Fitness models
  await prisma.goalProgressLog.deleteMany();
  await prisma.fitnessGoal.deleteMany();
  await prisma.sessionTemplate.deleteMany();
  await prisma.programPhaseBlock.deleteMany();
  await prisma.trainingProgram.deleteMany();
  await prisma.bodyMeasurement.deleteMany();
  await prisma.workoutLog.deleteMany();
  await prisma.strengthPR.deleteMany();
  await prisma.nutritionDay.deleteMany();

  // Vehicle models
  await prisma.servicePart.deleteMany();
  await prisma.serviceRecord.deleteMany();
  await prisma.maintenanceSchedule.deleteMany();
  await prisma.part.deleteMany();
  await prisma.vehicle.deleteMany();

  // Shopping models
  await prisma.purchaseHistory.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.purchaseCategory.deleteMany();
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  // Additional cleanup if needed
});

// Set test environment variables
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
