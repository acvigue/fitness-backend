#!/command/with-contenv sh
cd /app
echo "[migrations] Running Prisma migrations..."
DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}" ./node_modules/.bin/prisma migrate deploy
exit_code=$?
if [ $exit_code -eq 0 ]; then
  echo "[migrations] Prisma migrations completed successfully"
else
  echo "[migrations] Prisma migrations failed with exit code $exit_code"
  exit $exit_code
fi

echo "[seed] Running database seed..."
DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}" node dist/seed.js
exit_code=$?
if [ $exit_code -eq 0 ]; then
  echo "[seed] Database seed completed successfully"
else
  echo "[seed] Database seed failed with exit code $exit_code"
  exit $exit_code
fi
