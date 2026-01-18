#!/bin/bash

echo "🚀 Pushing schema changes to database..."
npx prisma db push

echo "📦 Generating Prisma Client..."
npx prisma generate

echo "✅ Schema deployed successfully!"
