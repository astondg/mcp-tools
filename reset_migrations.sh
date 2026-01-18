#!/bin/bash

echo "🗑️  Removing broken migration directories..."
rm -rf prisma/migrations/20251214000000_baseline
rm -rf prisma/migrations/20251214000001_add_shopping_system

echo "🔄 Resetting database to match schema..."
npx prisma migrate reset --force --skip-seed

echo "✅ Migration reset complete!"
