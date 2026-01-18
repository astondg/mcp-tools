/**
 * Example Budget Tests
 *
 * This is an example test file showing how to test budget functions
 * Add actual implementations after refactoring the query files
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/shared/db';

describe('Budget System (Example Tests)', () => {
  describe('Budget Categories', () => {
    it('should create a budget category', async () => {
      const category = await prisma.budgetCategory.create({
        data: {
          name: 'Groceries',
          budgetAmount: 500,
          period: 'MONTHLY',
        },
      });

      expect(category).toBeDefined();
      expect(category.name).toBe('Groceries');
      expect(category.budgetAmount.toNumber()).toBe(500);
      expect(category.period).toBe('MONTHLY');
    });

    it('should not allow duplicate category names', async () => {
      await prisma.budgetCategory.create({
        data: {
          name: 'Transport',
          budgetAmount: 200,
          period: 'WEEKLY',
        },
      });

      await expect(
        prisma.budgetCategory.create({
          data: {
            name: 'Transport',
            budgetAmount: 300,
            period: 'MONTHLY',
          },
        })
      ).rejects.toThrow();
    });

    it('should support parent-child categories', async () => {
      const parent = await prisma.budgetCategory.create({
        data: {
          name: 'Food',
          budgetAmount: 1000,
          period: 'MONTHLY',
        },
      });

      const child = await prisma.budgetCategory.create({
        data: {
          name: 'Dining Out',
          budgetAmount: 300,
          period: 'MONTHLY',
          parentId: parent.id,
        },
      });

      expect(child.parentId).toBe(parent.id);

      const parentWithChildren = await prisma.budgetCategory.findUnique({
        where: { id: parent.id },
        include: { children: true },
      });

      expect(parentWithChildren?.children).toHaveLength(1);
      expect(parentWithChildren?.children[0].name).toBe('Dining Out');
    });
  });

  describe('Expenses', () => {
    let groceriesCategory: any;

    beforeEach(async () => {
      groceriesCategory = await prisma.budgetCategory.create({
        data: {
          name: 'Groceries',
          budgetAmount: 500,
          period: 'MONTHLY',
        },
      });
    });

    it('should create an expense', async () => {
      const expense = await prisma.expense.create({
        data: {
          amount: 45.50,
          description: 'Woolworths shopping',
          date: new Date('2026-01-18'),
          categoryId: groceriesCategory.id,
          merchantName: 'Woolworths',
        },
      });

      expect(expense).toBeDefined();
      expect(expense.amount.toNumber()).toBe(45.50);
      expect(expense.categoryId).toBe(groceriesCategory.id);
    });

    it('should calculate total expenses for a category', async () => {
      await prisma.expense.createMany({
        data: [
          {
            amount: 45.50,
            description: 'Shop 1',
            date: new Date('2026-01-10'),
            categoryId: groceriesCategory.id,
          },
          {
            amount: 67.80,
            description: 'Shop 2',
            date: new Date('2026-01-15'),
            categoryId: groceriesCategory.id,
          },
          {
            amount: 32.20,
            description: 'Shop 3',
            date: new Date('2026-01-18'),
            categoryId: groceriesCategory.id,
          },
        ],
      });

      const expenses = await prisma.expense.findMany({
        where: { categoryId: groceriesCategory.id },
      });

      const total = expenses.reduce(
        (sum, exp) => sum + exp.amount.toNumber(),
        0
      );

      expect(total).toBe(145.50);
    });
  });

  describe('Budget vs Actual Calculations', () => {
    it('should correctly calculate budget status', async () => {
      const category = await prisma.budgetCategory.create({
        data: {
          name: 'Entertainment',
          budgetAmount: 200,
          period: 'MONTHLY',
        },
      });

      await prisma.expense.createMany({
        data: [
          {
            amount: 50,
            description: 'Cinema',
            date: new Date('2026-01-05'),
            categoryId: category.id,
          },
          {
            amount: 80,
            description: 'Concert',
            date: new Date('2026-01-12'),
            categoryId: category.id,
          },
        ],
      });

      const expenses = await prisma.expense.findMany({
        where: { categoryId: category.id },
      });

      const spent = expenses.reduce((sum, exp) => sum + exp.amount.toNumber(), 0);
      const budget = category.budgetAmount.toNumber();
      const remaining = budget - spent;
      const percentage = (spent / budget) * 100;

      expect(spent).toBe(130);
      expect(remaining).toBe(70);
      expect(percentage).toBe(65);
      expect(spent).toBeLessThan(budget); // On track
    });

    it('should detect over-budget status', async () => {
      const category = await prisma.budgetCategory.create({
        data: {
          name: 'Coffee',
          budgetAmount: 50,
          period: 'WEEKLY',
        },
      });

      await prisma.expense.create({
        data: {
          amount: 75,
          description: 'Too much coffee',
          date: new Date('2026-01-18'),
          categoryId: category.id,
        },
      });

      const expenses = await prisma.expense.findMany({
        where: { categoryId: category.id },
      });

      const spent = expenses.reduce((sum, exp) => sum + exp.amount.toNumber(), 0);
      const budget = category.budgetAmount.toNumber();

      expect(spent).toBeGreaterThan(budget);
      expect(spent - budget).toBe(25); // Over by $25
    });
  });
});
