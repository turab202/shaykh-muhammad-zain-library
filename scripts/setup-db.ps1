# setup-db.ps1 — One-command database setup for development
# Usage: ./scripts/setup-db.ps1

Write-Host "🐳 Starting PostgreSQL..."
docker-compose up -d

Write-Host "⏳ Waiting for database to be ready..."
$retries = 0
do {
    Start-Sleep -Seconds 2
    $status = docker exec zain_library_db pg_isready -U postgres -d zain_library 2>&1
    $retries++
    if ($retries -gt 15) {
        Write-Host "❌ Database did not become ready in time. Check Docker."
        exit 1
    }
} while ($status -notmatch "accepting connections")

Write-Host "🔄 Running migrations..."
npx prisma migrate dev --name init

Write-Host "🌱 Seeding database..."
npm run db:seed

Write-Host ""
Write-Host "✅ Database setup complete."
Write-Host "   Run: npm run dev"
