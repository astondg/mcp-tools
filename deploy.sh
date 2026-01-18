#!/bin/bash
set -e

echo "🧹 Cleaning up broken migrations..."
rm -rf prisma/migrations/20251214000000_baseline 2>/dev/null || true
rm -rf prisma/migrations/20251214000001_add_shopping_system 2>/dev/null || true

echo ""
echo "🚀 Deploying schema to database..."
npx prisma db push --accept-data-loss

echo ""
echo "📦 Generating Prisma Client..."
npx prisma generate

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your trip planning system is ready to use with all 48 tools!"
