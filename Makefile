.PHONY: install dev build start db-up db-down db-setup db-deploy db-baseline db-migrate db-studio db-reset prisma-generate clean kill-port

# Install all dependencies
install:
	npm install

# Run development server (ensures deps, DB, and Prisma client are ready)
# Kills any stale process on port 3000 first, then starts Next.js dev server.
# Ctrl+C will cleanly stop the server.
dev: install prisma-generate db-deploy kill-port
	@trap 'echo "\nShutting down dev server..."; kill %1 2>/dev/null; lsof -ti :3000 | xargs kill 2>/dev/null; echo "Dev server stopped."' INT TERM; \
	npm run dev & \
	bash scripts/warmup.sh & \
	wait

# Kill any process on port 3000
kill-port:
	@lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# Build for production
build:
	npm run build

# Start production server
start:
	npm run start

# Start PostgreSQL in Docker
db-up:
	docker compose up -d

# Stop PostgreSQL container
db-down:
	docker compose down

# Full database setup (start Docker, generate client, apply migrations)
db-setup: db-up prisma-generate db-deploy

# Apply committed migrations (never `db push`: it can drop columns)
db-deploy:
	npx prisma migrate deploy

# Mark existing migrations as applied, for a dev database that predates the
# migration workflow (was created with `db push`). Run once, then `db-deploy`.
db-baseline:
	@for m in $$(ls prisma/migrations | grep -v migration_lock.toml); do \
		npx prisma migrate resolve --applied $$m; \
	done

# Create a new migration from schema changes
db-migrate:
	npx prisma migrate dev

# Open Prisma Studio (database GUI)
db-studio:
	npx prisma studio

# Reset database (WARNING: destroys all data)
db-reset:
	npx prisma migrate reset

# Regenerate Prisma client
prisma-generate:
	npx prisma generate

# Remove build artifacts
clean:
	rm -rf .next node_modules

# First-time setup: install deps, start DB, generate prisma, sync schema, start dev
setup: install db-up prisma-generate db-push dev
