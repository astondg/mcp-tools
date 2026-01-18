#!/bin/bash

echo "🔧 Fixing migration history..."

# Remove broken migration directories
rm -rf prisma/migrations/20251214000000_baseline
rm -rf prisma/migrations/20251214000001_add_shopping_system

# Create a new baseline migration from current schema
echo "📋 Creating baseline migration from current schema..."
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > temp_migration.sql

# Create migration directory
mkdir -p prisma/migrations/20251214000000_baseline
mv temp_migration.sql prisma/migrations/20251214000000_baseline/migration.sql

# Mark as applied (don't run it)
npx prisma migrate resolve --applied 20251214000000_baseline

echo "✅ Migration history fixed!"
