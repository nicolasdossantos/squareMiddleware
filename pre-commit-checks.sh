#!/bin/bash
# Pre-commit Quality Checks
# Ensures code quality before committing

set -e  # Exit on any error

echo "🔍 Running pre-commit checks..."
echo ""

# 1. Format code
echo "📝 Formatting code with Prettier..."
npm run format
if [ $? -ne 0 ]; then
  echo "❌ Formatting failed"
  exit 1
fi
echo "✅ Formatting passed"
echo ""

# 2. Lint code
echo "🔎 Linting code with ESLint..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed"
  exit 1
fi
echo "✅ Linting passed"
echo ""

# 3. Run tests
echo "🧪 Running tests..."
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi
echo "✅ Tests passed"
echo ""

echo "✨ All pre-commit checks passed!"
echo ""
echo "Safe to commit and push to production."
