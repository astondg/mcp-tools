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
  await prisma.tripReminder.deleteMany();
  await prisma.itineraryItem.deleteMany();
  await prisma.tripItem.deleteMany();
  await prisma.trip.deleteMany();

  await prisma.expense.deleteMany();
  await prisma.budgetCategory.deleteMany();
  await prisma.income.deleteMany();
  await prisma.incomeSource.deleteMany();

  await prisma.fitnessGoalProgress.deleteMany();
  await prisma.fitnessGoal.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.trainingPhase.deleteMany();
  await prisma.trainingProgram.deleteMany();
  await prisma.bodyMeasurement.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.strengthPR.deleteMany();
  await prisma.nutritionDay.deleteMany();

  await prisma.vehicleService.deleteMany();
  await prisma.vehicleServicePart.deleteMany();
  await prisma.maintenanceSchedule.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.vehiclePart.deleteMany();

  await prisma.purchase.deleteMany();
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
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
