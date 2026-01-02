import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { prisma } from '@/lib/db';

export function registerShoppingTools(server: McpServer) {
  // Manage purchase categories
  server.tool(
    'shopping_manage_category',
    'Create, update, or delete purchase categories',
    {
      action: z.enum(['add', 'update', 'delete']).describe('Action to perform'),
      name: z.string().min(1).optional().describe('Category name'),
      newName: z.string().min(1).optional().describe('New category name (for update)'),
      parentName: z.string().optional().describe('Parent category name for hierarchy'),
      id: z.string().uuid().optional().describe('Category ID (for update/delete)'),
    },
    async (params) => {
      try {
        const { action, name, newName, parentName, id } = params;

        if (action === 'add') {
          if (!name) throw new Error('Category name is required');

          let parentId = undefined;
          if (parentName) {
            const parent = await prisma.purchaseCategory.findUnique({
              where: { name: parentName }
            });
            if (!parent) throw new Error(`Parent category "${parentName}" not found`);
            parentId = parent.id;
          }

          const category = await prisma.purchaseCategory.create({
            data: { name, parentId }
          });

          return {
            content: [{
              type: 'text',
              text: `✅ Category "${category.name}" created` + (parentName ? ` under "${parentName}"` : '')
            }]
          };
        }

        if (action === 'update') {
          if (!id && !name) throw new Error('Category ID or name is required');
          if (!newName) throw new Error('New name is required for update');

          const category = await prisma.purchaseCategory.update({
            where: id ? { id } : { name: name! },
            data: { name: newName }
          });

          return {
            content: [{ type: 'text', text: `✅ Category updated to "${category.name}"` }]
          };
        }

        if (action === 'delete') {
          if (!id && !name) throw new Error('Category ID or name is required');

          await prisma.purchaseCategory.delete({
            where: id ? { id } : { name: name! }
          });

          return {
            content: [{ type: 'text', text: `✅ Category deleted` }]
          };
        }

        throw new Error('Invalid action');
      } catch (error) {
        console.error('Error in shopping_manage_category:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // List purchase categories
  server.tool(
    'shopping_get_categories',
    'List all purchase categories with hierarchy',
    {},
    async () => {
      try {
        const categories = await prisma.purchaseCategory.findMany({
          include: {
            parent: true,
            _count: {
              select: { purchases: true, wishlist: true }
            }
          },
          orderBy: { name: 'asc' }
        });

        const categoryList = categories.map(cat =>
          `• ${cat.name}${cat.parent ? ` (under ${cat.parent.name})` : ''}\n` +
          `  Purchases: ${cat._count.purchases}, Wishlist: ${cat._count.wishlist}`
        ).join('\n');

        return {
          content: [{ type: 'text', text: `📂 Purchase Categories (${categories.length}):\n\n${categoryList}` }]
        };
      } catch (error) {
        console.error('Error in shopping_get_categories:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Add purchase history
  server.tool(
    'shopping_add_purchase',
    'Record a past purchase to build your purchase history',
    {
      itemName: z.string().min(1).describe('Name/description of the item purchased'),
      categoryName: z.string().min(1).describe('Purchase category name'),
      price: z.number().positive().describe('Purchase price'),
      purchaseDate: z.string().describe('Purchase date (YYYY-MM-DD)'),
      quantity: z.number().int().positive().default(1).optional().describe('Quantity purchased'),
      merchant: z.string().optional().describe('Store or merchant name'),
      brand: z.string().optional().describe('Product brand'),
      productUrl: z.string().url().optional().describe('Product URL'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (params) => {
      try {
        const category = await prisma.purchaseCategory.findUnique({
          where: { name: params.categoryName }
        });

        if (!category) {
          throw new Error(`Category "${params.categoryName}" not found. Create it first with shopping_manage_category.`);
        }

        const purchase = await prisma.purchaseHistory.create({
          data: {
            itemName: params.itemName,
            categoryId: category.id,
            price: params.price,
            purchaseDate: new Date(params.purchaseDate),
            quantity: params.quantity || 1,
            merchant: params.merchant,
            brand: params.brand,
            productUrl: params.productUrl,
            notes: params.notes,
          },
          include: { category: true }
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Purchase recorded:\n\n` +
                  `• ${purchase.itemName} (${purchase.quantity}x)\n` +
                  `• $${purchase.price}\n` +
                  `• Category: ${purchase.category.name}\n` +
                  `• Date: ${purchase.purchaseDate.toISOString().split('T')[0]}` +
                  (purchase.merchant ? `\n• Merchant: ${purchase.merchant}` : '') +
                  (purchase.brand ? `\n• Brand: ${purchase.brand}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in shopping_add_purchase:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Import purchases from CSV
  server.tool(
    'shopping_import_purchases',
    'Bulk import purchase history from CSV data. Handles quoted fields with commas, skips duplicates.',
    {
      csvData: z.string().min(1).describe('CSV data with headers'),
      dateColumn: z.string().describe('Column name for purchase date'),
      itemColumn: z.string().describe('Column name for item name'),
      priceColumn: z.string().describe('Column name for price'),
      categoryColumn: z.string().optional().describe('Column name for category'),
      merchantColumn: z.string().optional().describe('Column name for merchant'),
      brandColumn: z.string().optional().describe('Column name for brand'),
      defaultCategory: z.string().optional().describe('Default category if not in CSV'),
    },
    async (params) => {
      try {
        // Parse CSV properly handling quoted fields with commas
        function parseCSVLine(line: string): string[] {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"' && inQuotes && nextChar === '"') {
              // Escaped quote inside quoted field
              current += '"';
              i++; // Skip next quote
            } else if (char === '"') {
              // Toggle quote mode
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              // Field separator
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        }

        const lines = params.csvData.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV must have headers and at least one data row');

        const headers = parseCSVLine(lines[0]);
        const dateIdx = headers.indexOf(params.dateColumn);
        const itemIdx = headers.indexOf(params.itemColumn);
        const priceIdx = headers.indexOf(params.priceColumn);
        const categoryIdx = params.categoryColumn ? headers.indexOf(params.categoryColumn) : -1;
        const merchantIdx = params.merchantColumn ? headers.indexOf(params.merchantColumn) : -1;
        const brandIdx = params.brandColumn ? headers.indexOf(params.brandColumn) : -1;

        if (dateIdx === -1 || itemIdx === -1 || priceIdx === -1) {
          throw new Error(`Required columns not found. Headers: ${headers.join(', ')}`);
        }

        // Parse all rows first
        const parsedRows: Array<{
          date: Date;
          itemName: string;
          price: number;
          categoryName: string;
          merchant?: string;
          brand?: string;
          rowNum: number;
        }> = [];
        const parseErrors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue; // Skip empty lines

          try {
            const cols = parseCSVLine(lines[i]);
            const categoryName = (categoryIdx >= 0 ? cols[categoryIdx] : params.defaultCategory) || '';
            if (!categoryName) throw new Error('Category required');

            const dateStr = cols[dateIdx];
            const parsedDate = new Date(dateStr);
            if (isNaN(parsedDate.getTime())) throw new Error(`Invalid date: ${dateStr}`);

            const priceStr = cols[priceIdx];
            const price = parseFloat(priceStr.replace(/[^0-9.-]/g, ''));
            if (isNaN(price)) throw new Error(`Invalid price: ${priceStr}`);

            parsedRows.push({
              date: parsedDate,
              itemName: cols[itemIdx],
              price,
              categoryName,
              merchant: merchantIdx >= 0 && cols[merchantIdx] ? cols[merchantIdx] : undefined,
              brand: brandIdx >= 0 && cols[brandIdx] ? cols[brandIdx] : undefined,
              rowNum: i + 1,
            });
          } catch (err) {
            parseErrors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
          }
        }

        if (parsedRows.length === 0) {
          throw new Error('No valid rows to import');
        }

        // Get unique category names and ensure they exist
        const uniqueCategories = [...new Set(parsedRows.map(r => r.categoryName))];
        const categoryMap = new Map<string, string>();

        for (const catName of uniqueCategories) {
          let category = await prisma.purchaseCategory.findUnique({
            where: { name: catName }
          });
          if (!category) {
            category = await prisma.purchaseCategory.create({
              data: { name: catName }
            });
          }
          categoryMap.set(catName, category.id);
        }

        // Check for duplicates (same date, item, price)
        const existingPurchases = await prisma.purchaseHistory.findMany({
          where: {
            OR: parsedRows.map(r => ({
              purchaseDate: r.date,
              itemName: r.itemName,
              price: r.price,
            }))
          },
          select: { purchaseDate: true, itemName: true, price: true }
        });

        const existingSet = new Set(
          existingPurchases.map(p =>
            `${p.purchaseDate.toISOString()}|${p.itemName}|${p.price}`
          )
        );

        // Filter out duplicates
        const newRows = parsedRows.filter(r => {
          const key = `${r.date.toISOString()}|${r.itemName}|${r.price}`;
          return !existingSet.has(key);
        });
        const skippedCount = parsedRows.length - newRows.length;

        // Batch insert new records
        let importedCount = 0;
        if (newRows.length > 0) {
          const result = await prisma.purchaseHistory.createMany({
            data: newRows.map(r => ({
              purchaseDate: r.date,
              itemName: r.itemName,
              price: r.price,
              categoryId: categoryMap.get(r.categoryName)!,
              merchant: r.merchant,
              brand: r.brand,
            })),
            skipDuplicates: true,
          });
          importedCount = result.count;
        }

        const summary = [
          `✅ Import complete!`,
          ``,
          `• Imported: ${importedCount} purchases`,
          skippedCount > 0 ? `• Skipped (duplicates): ${skippedCount}` : null,
          parseErrors.length > 0 ? `• Parse errors: ${parseErrors.length}` : null,
        ].filter(Boolean).join('\n');

        const errorDetails = parseErrors.length > 0
          ? `\n\nParse errors:\n${parseErrors.slice(0, 10).join('\n')}${parseErrors.length > 10 ? `\n...and ${parseErrors.length - 10} more` : ''}`
          : '';

        return {
          content: [{ type: 'text', text: summary + errorDetails }]
        };
      } catch (error) {
        console.error('Error in shopping_import_purchases:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get purchase history
  server.tool(
    'shopping_get_purchases',
    'Query purchase history with flexible filters',
    {
      categoryName: z.string().optional().describe('Filter by category name'),
      merchant: z.string().optional().describe('Filter by merchant'),
      brand: z.string().optional().describe('Filter by brand'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
      minPrice: z.number().optional().describe('Minimum price'),
      maxPrice: z.number().optional().describe('Maximum price'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results to return'),
    },
    async (params) => {
      try {
        const where: any = {};

        if (params.categoryName) {
          const category = await prisma.purchaseCategory.findUnique({
            where: { name: params.categoryName }
          });
          if (category) where.categoryId = category.id;
        }

        if (params.merchant) where.merchant = { contains: params.merchant, mode: 'insensitive' };
        if (params.brand) where.brand = { contains: params.brand, mode: 'insensitive' };

        if (params.startDate || params.endDate) {
          where.purchaseDate = {};
          if (params.startDate) where.purchaseDate.gte = new Date(params.startDate);
          if (params.endDate) where.purchaseDate.lte = new Date(params.endDate);
        }

        if (params.minPrice || params.maxPrice) {
          where.price = {};
          if (params.minPrice) where.price.gte = params.minPrice;
          if (params.maxPrice) where.price.lte = params.maxPrice;
        }

        const purchases = await prisma.purchaseHistory.findMany({
          where,
          include: { category: true },
          orderBy: { purchaseDate: 'desc' },
          take: params.limit,
        });

        if (purchases.length === 0) {
          return {
            content: [{ type: 'text', text: '📦 No purchases found matching the filters.' }]
          };
        }

        const purchaseList = purchases.map(p =>
          `• ${p.itemName} - $${p.price} (${p.quantity}x)\n` +
          `  ${p.purchaseDate.toISOString().split('T')[0]} | ${p.category.name}` +
          (p.merchant ? ` | ${p.merchant}` : '') +
          (p.brand ? ` | ${p.brand}` : '')
        ).join('\n\n');

        const total = purchases.reduce((sum, p) => sum + Number(p.price) * p.quantity, 0);

        return {
          content: [{
            type: 'text',
            text: `🛍️ Purchase History (${purchases.length}):\n\n${purchaseList}\n\n` +
                  `💰 Total: $${total.toFixed(2)}`
          }]
        };
      } catch (error) {
        console.error('Error in shopping_get_purchases:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Update single purchase
  server.tool(
    'shopping_update_purchase',
    'Update a single purchase record by ID',
    {
      id: z.string().uuid().describe('Purchase ID to update'),
      itemName: z.string().min(1).optional().describe('New item name'),
      categoryName: z.string().min(1).optional().describe('New category name'),
      price: z.number().positive().optional().describe('New price'),
      purchaseDate: z.string().optional().describe('New purchase date (YYYY-MM-DD)'),
      quantity: z.number().int().positive().optional().describe('New quantity'),
      merchant: z.string().optional().describe('New merchant (empty string to clear)'),
      brand: z.string().optional().describe('New brand (empty string to clear)'),
      notes: z.string().optional().describe('New notes (empty string to clear)'),
    },
    async (params) => {
      try {
        // Verify purchase exists
        const existing = await prisma.purchaseHistory.findUnique({
          where: { id: params.id },
          include: { category: true }
        });

        if (!existing) {
          return {
            content: [{ type: 'text', text: `❌ Purchase with ID "${params.id}" not found.` }]
          };
        }

        const updateData: any = {};

        if (params.itemName !== undefined) updateData.itemName = params.itemName;
        if (params.price !== undefined) updateData.price = params.price;
        if (params.purchaseDate !== undefined) updateData.purchaseDate = new Date(params.purchaseDate);
        if (params.quantity !== undefined) updateData.quantity = params.quantity;
        if (params.merchant !== undefined) updateData.merchant = params.merchant || null;
        if (params.brand !== undefined) updateData.brand = params.brand || null;
        if (params.notes !== undefined) updateData.notes = params.notes || null;

        if (params.categoryName !== undefined) {
          const category = await prisma.purchaseCategory.findUnique({
            where: { name: params.categoryName }
          });
          if (!category) {
            return {
              content: [{ type: 'text', text: `❌ Category "${params.categoryName}" not found. Create it first with shopping_manage_category.` }]
            };
          }
          updateData.categoryId = category.id;
        }

        if (Object.keys(updateData).length === 0) {
          return {
            content: [{ type: 'text', text: '⚠️ No fields provided to update.' }]
          };
        }

        const updated = await prisma.purchaseHistory.update({
          where: { id: params.id },
          data: updateData,
          include: { category: true }
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Purchase updated:\n\n` +
                  `• ${updated.itemName} (${updated.quantity}x)\n` +
                  `• $${updated.price}\n` +
                  `• Category: ${updated.category.name}\n` +
                  `• Date: ${updated.purchaseDate.toISOString().split('T')[0]}` +
                  (updated.merchant ? `\n• Merchant: ${updated.merchant}` : '') +
                  (updated.brand ? `\n• Brand: ${updated.brand}` : '') +
                  (updated.notes ? `\n• Notes: ${updated.notes}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in shopping_update_purchase:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Bulk update purchases
  server.tool(
    'shopping_bulk_update_purchases',
    'Update multiple purchase records matching filter criteria. Use to recategorize, update merchant/brand, or correct data in bulk.',
    {
      // Filter criteria (at least one required)
      filterCategoryName: z.string().optional().describe('Filter: match purchases in this category'),
      filterMerchant: z.string().optional().describe('Filter: match purchases from this merchant (partial match)'),
      filterBrand: z.string().optional().describe('Filter: match purchases of this brand (partial match)'),
      filterStartDate: z.string().optional().describe('Filter: purchases on or after this date (YYYY-MM-DD)'),
      filterEndDate: z.string().optional().describe('Filter: purchases on or before this date (YYYY-MM-DD)'),
      filterMinPrice: z.number().optional().describe('Filter: minimum price'),
      filterMaxPrice: z.number().optional().describe('Filter: maximum price'),
      filterItemNameContains: z.string().optional().describe('Filter: item name contains this text (partial match)'),
      // Update fields
      newCategoryName: z.string().optional().describe('Update: set category to this'),
      newMerchant: z.string().optional().describe('Update: set merchant (empty string to clear)'),
      newBrand: z.string().optional().describe('Update: set brand (empty string to clear)'),
      // Safety
      dryRun: z.boolean().default(true).describe('Preview changes without applying (default: true)'),
    },
    async (params) => {
      try {
        // Build filter
        const where: any = {};

        if (params.filterCategoryName) {
          const category = await prisma.purchaseCategory.findUnique({
            where: { name: params.filterCategoryName }
          });
          if (category) where.categoryId = category.id;
          else {
            return {
              content: [{ type: 'text', text: `❌ Filter category "${params.filterCategoryName}" not found.` }]
            };
          }
        }

        if (params.filterMerchant) where.merchant = { contains: params.filterMerchant, mode: 'insensitive' };
        if (params.filterBrand) where.brand = { contains: params.filterBrand, mode: 'insensitive' };
        if (params.filterItemNameContains) where.itemName = { contains: params.filterItemNameContains, mode: 'insensitive' };

        if (params.filterStartDate || params.filterEndDate) {
          where.purchaseDate = {};
          if (params.filterStartDate) where.purchaseDate.gte = new Date(params.filterStartDate);
          if (params.filterEndDate) where.purchaseDate.lte = new Date(params.filterEndDate);
        }

        if (params.filterMinPrice || params.filterMaxPrice) {
          where.price = {};
          if (params.filterMinPrice) where.price.gte = params.filterMinPrice;
          if (params.filterMaxPrice) where.price.lte = params.filterMaxPrice;
        }

        // Ensure at least one filter is set
        if (Object.keys(where).length === 0) {
          return {
            content: [{ type: 'text', text: '❌ At least one filter criteria is required to prevent accidental bulk updates.' }]
          };
        }

        // Build update data
        const updateData: any = {};

        if (params.newCategoryName !== undefined) {
          const category = await prisma.purchaseCategory.findUnique({
            where: { name: params.newCategoryName }
          });
          if (!category) {
            return {
              content: [{ type: 'text', text: `❌ Target category "${params.newCategoryName}" not found. Create it first with shopping_manage_category.` }]
            };
          }
          updateData.categoryId = category.id;
        }

        if (params.newMerchant !== undefined) updateData.merchant = params.newMerchant || null;
        if (params.newBrand !== undefined) updateData.brand = params.newBrand || null;

        if (Object.keys(updateData).length === 0) {
          return {
            content: [{ type: 'text', text: '❌ At least one update field (newCategoryName, newMerchant, newBrand) is required.' }]
          };
        }

        // Find matching records
        const matches = await prisma.purchaseHistory.findMany({
          where,
          include: { category: true },
          orderBy: { purchaseDate: 'desc' },
          take: 100 // Limit preview
        });

        const totalCount = await prisma.purchaseHistory.count({ where });

        if (totalCount === 0) {
          return {
            content: [{ type: 'text', text: '📦 No purchases found matching the filter criteria.' }]
          };
        }

        // Build preview
        const preview = matches.slice(0, 10).map(p =>
          `• ${p.itemName} - $${p.price} | ${p.purchaseDate.toISOString().split('T')[0]} | ${p.category.name}` +
          (p.merchant ? ` | ${p.merchant}` : '') +
          (p.brand ? ` | ${p.brand}` : '')
        ).join('\n');

        const updateSummary = Object.entries(updateData)
          .map(([key, value]) => {
            if (key === 'categoryId' && params.newCategoryName) return `Category → ${params.newCategoryName}`;
            if (key === 'merchant') return `Merchant → ${value || '(clear)'}`;
            if (key === 'brand') return `Brand → ${value || '(clear)'}`;
            return `${key} → ${value}`;
          })
          .join(', ');

        if (params.dryRun) {
          return {
            content: [{
              type: 'text',
              text: `🔍 DRY RUN - Preview of bulk update:\n\n` +
                    `📊 Matching records: ${totalCount}\n` +
                    `✏️ Changes: ${updateSummary}\n\n` +
                    `Sample of affected records${totalCount > 10 ? ` (showing 10 of ${totalCount})` : ''}:\n${preview}\n\n` +
                    `⚠️ To apply these changes, run again with dryRun: false`
            }]
          };
        }

        // Apply update
        const result = await prisma.purchaseHistory.updateMany({
          where,
          data: updateData
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Bulk update complete!\n\n` +
                  `📊 Records updated: ${result.count}\n` +
                  `✏️ Changes applied: ${updateSummary}`
          }]
        };
      } catch (error) {
        console.error('Error in shopping_bulk_update_purchases:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Add wishlist item
  server.tool(
    'shopping_add_wishlist',
    'Add an item to your wishlist for deal tracking',
    {
      itemName: z.string().min(1).describe('Item name or description'),
      categoryName: z.string().min(1).describe('Purchase category name'),
      targetPrice: z.number().positive().optional().describe('Target/desired price'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM').describe('Purchase priority'),
      brand: z.string().optional().describe('Preferred brand'),
      specifications: z.string().optional().describe('Specific requirements or specs'),
      productUrl: z.string().url().optional().describe('Reference product URL'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (params) => {
      try {
        const category = await prisma.purchaseCategory.findUnique({
          where: { name: params.categoryName }
        });

        if (!category) {
          throw new Error(`Category "${params.categoryName}" not found. Create it first with shopping_manage_category.`);
        }

        const wishlist = await prisma.wishlistItem.create({
          data: {
            itemName: params.itemName,
            categoryId: category.id,
            targetPrice: params.targetPrice,
            priority: params.priority as any,
            brand: params.brand,
            specifications: params.specifications,
            productUrl: params.productUrl,
            notes: params.notes,
          },
          include: { category: true }
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Added to wishlist:\n\n` +
                  `• ${wishlist.itemName}\n` +
                  `• Category: ${wishlist.category.name}\n` +
                  `• Priority: ${wishlist.priority}` +
                  (wishlist.targetPrice ? `\n• Target Price: $${wishlist.targetPrice}` : '') +
                  (wishlist.brand ? `\n• Brand: ${wishlist.brand}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in shopping_add_wishlist:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get wishlist
  server.tool(
    'shopping_get_wishlist',
    'View your wishlist with optional filters',
    {
      categoryName: z.string().optional().describe('Filter by category'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Filter by priority'),
      activeOnly: z.boolean().default(true).describe('Show only active items'),
    },
    async (params) => {
      try {
        const where: any = {};

        if (params.activeOnly) where.isActive = true;
        if (params.priority) where.priority = params.priority;

        if (params.categoryName) {
          const category = await prisma.purchaseCategory.findUnique({
            where: { name: params.categoryName }
          });
          if (category) where.categoryId = category.id;
        }

        const items = await prisma.wishlistItem.findMany({
          where,
          include: { category: true },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
          ]
        });

        if (items.length === 0) {
          return {
            content: [{ type: 'text', text: '📝 No wishlist items found.' }]
          };
        }

        const priorityEmoji = { URGENT: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };

        const wishlistText = items.map(item =>
          `${priorityEmoji[item.priority]} ${item.itemName}\n` +
          `  Category: ${item.category.name}` +
          (item.targetPrice ? ` | Target: $${item.targetPrice}` : '') +
          (item.brand ? ` | Brand: ${item.brand}` : '') +
          (item.notes ? `\n  Notes: ${item.notes}` : '')
        ).join('\n\n');

        return {
          content: [{
            type: 'text',
            text: `🎯 Wishlist (${items.length} items):\n\n${wishlistText}`
          }]
        };
      } catch (error) {
        console.error('Error in shopping_get_wishlist:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Update wishlist item
  server.tool(
    'shopping_update_wishlist',
    'Update or delete a wishlist item',
    {
      itemId: z.string().uuid().describe('Wishlist item ID'),
      action: z.enum(['update', 'mark_inactive', 'delete']).describe('Action to perform'),
      itemName: z.string().optional().describe('New item name'),
      targetPrice: z.number().positive().optional().describe('New target price'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('New priority'),
      notes: z.string().optional().describe('New notes'),
    },
    async (params) => {
      try {
        if (params.action === 'delete') {
          await prisma.wishlistItem.delete({
            where: { id: params.itemId }
          });
          return {
            content: [{ type: 'text', text: '✅ Wishlist item deleted.' }]
          };
        }

        if (params.action === 'mark_inactive') {
          await prisma.wishlistItem.update({
            where: { id: params.itemId },
            data: { isActive: false }
          });
          return {
            content: [{ type: 'text', text: '✅ Wishlist item marked as inactive.' }]
          };
        }

        const updateData: any = {};
        if (params.itemName) updateData.itemName = params.itemName;
        if (params.targetPrice) updateData.targetPrice = params.targetPrice;
        if (params.priority) updateData.priority = params.priority;
        if (params.notes !== undefined) updateData.notes = params.notes;

        const item = await prisma.wishlistItem.update({
          where: { id: params.itemId },
          data: updateData,
          include: { category: true }
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Wishlist item updated:\n\n` +
                  `• ${item.itemName}\n` +
                  `• Priority: ${item.priority}` +
                  (item.targetPrice ? `\n• Target: $${item.targetPrice}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in shopping_update_wishlist:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Get or create shopping profile
  server.tool(
    'shopping_get_profile',
    'Get your shopping profile with purchase insights and preferences',
    {},
    async () => {
      try {
        // Get or create default profile
        let profile = await prisma.shoppingProfile.findUnique({
          where: { profileName: 'default' }
        });

        if (!profile) {
          profile = await prisma.shoppingProfile.create({
            data: { profileName: 'default' }
          });
        }

        // Generate insights from purchase history
        const purchases = await prisma.purchaseHistory.findMany({
          include: { category: true },
          orderBy: { purchaseDate: 'desc' },
          take: 500 // Last 500 purchases for analysis
        });

        const categorySpending: Record<string, { count: number; total: number }> = {};
        const merchantFrequency: Record<string, number> = {};
        const brandPreference: Record<string, number> = {};

        purchases.forEach(p => {
          // Category analysis
          if (!categorySpending[p.category.name]) {
            categorySpending[p.category.name] = { count: 0, total: 0 };
          }
          categorySpending[p.category.name].count++;
          categorySpending[p.category.name].total += Number(p.price) * p.quantity;

          // Merchant frequency
          if (p.merchant) {
            merchantFrequency[p.merchant] = (merchantFrequency[p.merchant] || 0) + 1;
          }

          // Brand preference
          if (p.brand) {
            brandPreference[p.brand] = (brandPreference[p.brand] || 0) + 1;
          }
        });

        // Top categories by spending
        const topCategories = Object.entries(categorySpending)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 5)
          .map(([name, data]) => `  • ${name}: $${data.total.toFixed(2)} (${data.count} purchases)`)
          .join('\n');

        // Top merchants
        const topMerchants = Object.entries(merchantFrequency)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => `  • ${name}: ${count} purchases`)
          .join('\n');

        // Top brands
        const topBrands = Object.entries(brandPreference)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => `  • ${name}: ${count} purchases`)
          .join('\n');

        const totalSpent = Object.values(categorySpending).reduce((sum, data) => sum + data.total, 0);
        const avgPurchase = purchases.length > 0 ? totalSpent / purchases.length : 0;

        return {
          content: [{
            type: 'text',
            text: `📊 Shopping Profile Insights:\n\n` +
                  `📈 Purchase Statistics:\n` +
                  `  • Total Purchases: ${purchases.length}\n` +
                  `  • Total Spent: $${totalSpent.toFixed(2)}\n` +
                  `  • Average Purchase: $${avgPurchase.toFixed(2)}\n\n` +
                  `🏆 Top Categories by Spending:\n${topCategories || '  None yet'}\n\n` +
                  `🏪 Most Frequent Merchants:\n${topMerchants || '  None yet'}\n\n` +
                  `🏷️ Preferred Brands:\n${topBrands || '  None yet'}\n\n` +
                  `⚙️ Profile Settings:\n` +
                  `  • Deal Vote Minimum: ${profile.dealVoteMinimum}\n` +
                  `  • Last Analyzed: ${profile.lastAnalyzed.toISOString()}`
          }]
        };
      } catch (error) {
        console.error('Error in shopping_get_profile:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );

  // Update shopping profile settings
  server.tool(
    'shopping_update_profile',
    'Update shopping profile preferences',
    {
      dealVoteMinimum: z.number().int().min(0).optional().describe('Minimum votes for deals to consider'),
      preferredMerchants: z.array(z.string()).optional().describe('List of preferred merchants'),
      avoidedMerchants: z.array(z.string()).optional().describe('List of merchants to avoid'),
      preferredBrands: z.array(z.string()).optional().describe('List of preferred brands'),
    },
    async (params) => {
      try {
        const updateData: any = {};

        if (params.dealVoteMinimum !== undefined) {
          updateData.dealVoteMinimum = params.dealVoteMinimum;
        }
        if (params.preferredMerchants) {
          updateData.preferredMerchants = JSON.stringify(params.preferredMerchants);
        }
        if (params.avoidedMerchants) {
          updateData.avoidedMerchants = JSON.stringify(params.avoidedMerchants);
        }
        if (params.preferredBrands) {
          updateData.preferredBrands = JSON.stringify(params.preferredBrands);
        }

        const profile = await prisma.shoppingProfile.upsert({
          where: { profileName: 'default' },
          update: updateData,
          create: {
            profileName: 'default',
            ...updateData
          }
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Shopping profile updated!\n\n` +
                  `Settings:\n` +
                  `  • Deal Vote Minimum: ${profile.dealVoteMinimum}` +
                  (profile.preferredMerchants ? `\n  • Preferred Merchants: ${JSON.parse(profile.preferredMerchants).join(', ')}` : '') +
                  (profile.avoidedMerchants ? `\n  • Avoided Merchants: ${JSON.parse(profile.avoidedMerchants).join(', ')}` : '') +
                  (profile.preferredBrands ? `\n  • Preferred Brands: ${JSON.parse(profile.preferredBrands).join(', ')}` : '')
          }]
        };
      } catch (error) {
        console.error('Error in shopping_update_profile:', error);
        return {
          content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );
}
