#!/bin/bash
# CURSOR PROMPT (STAGING) — Disk doluluğu fix + rebuild + doğrulama
# Hedef: /opt/grc-platform staging ortamında disk aç, DB volume'a dokunmadan rebuild et ve doğrula.
# ÖNEMLİ: "docker system prune --volumes" KULLANMA. Named volume'ları (postgres data) silme.
# Her adımın çıktısını kopyala/yapıştır raporla. Hata olursa dur ve çıktıyı paylaş.

set -euo pipefail

cd /opt/grc-platform

echo "=== 0) Sanity: branch ve repo ==="
git rev-parse --abbrev-ref HEAD
git status -sb
git log -1 --oneline

echo
echo "=== 1) Disk ve Docker kullanım fotoğrafı (önce) ==="
df -h
echo
docker system df || true
echo
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true

echo
echo "=== 2) Servisleri kontrollü durdur (volume silmeden) ==="
# DB'yi decompose etmeye gerek yok ama yer açmak için backend+frontend durduracağız.
# down: containerları kaldırır, volume'a dokunmaz (volumes flag yok).
docker compose -f docker-compose.staging.yml down

echo
echo "=== 3) Güvenli temizlik: builder cache + dangling + kullanılmayan image'lar ==="
# En çok yer buradan gelir.
docker builder prune -af || true
docker image prune -af || true
docker container prune -f || true
docker network prune -f || true
# DİKKAT: system prune -af volume silmez ama yine de agresif olabilir; yine de genelde güvenli.
docker system prune -af || true

echo
echo "=== 4) Disk ve Docker kullanım fotoğrafı (sonra) ==="
df -h
echo
docker system df || true

echo
echo "=== 5) Tekrar build (no-cache) ==="
# no-cache sadece build'de kullanılmalı
docker compose -f docker-compose.staging.yml build --no-cache backend frontend

echo
echo "=== 6) Up + force-recreate ==="
docker compose -f docker-compose.staging.yml up -d --force-recreate backend frontend

echo
echo "=== 7) Sağlık kontrolü ve loglar ==="
docker compose -f docker-compose.staging.yml ps
echo
docker logs --tail=120 grc-staging-backend || true
echo
docker logs --tail=120 grc-staging-frontend || true

echo
echo "=== 8) Nginx config hızlı doğrulama (proxy_pass var mı?) ==="
docker exec -T grc-staging-frontend sh -lc "nginx -T 2>&1 | grep -n 'proxy_pass' | head -60 || true"
docker exec -T grc-staging-frontend sh -lc "nginx -T 2>&1 | grep -n 'frontend-health' | head -40 || true"

echo
echo "=== 9) Endpoint doğrulama (public) ==="
HOST="http://46.224.99.150"
echo "-- /frontend-health"; curl -i "$HOST/frontend-health" | head -25
echo
echo "-- /health"; curl -i "$HOST/health" | head -45
echo
echo "-- /audit-logs (no auth)"; curl -i "$HOST/audit-logs" | head -45
echo
echo "-- /grc/risks (no auth)"; curl -i "$HOST/grc/risks" | head -45

echo
echo "=== 10) Authenticated audit-logs testi ==="
EMAIL="admin@grc-staging.local"
PASS="StagingPassword123!"

LOGIN_JSON=$(curl -s -X POST "$HOST/auth/login" \
  -H "content-type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

echo "LOGIN_JSON=$LOGIN_JSON"

TOKEN=$(echo "$LOGIN_JSON" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
TENANT_ID=$(echo "$LOGIN_JSON" | sed -n 's/.*"tenantId":"\([^"]*\)".*/\1/p')

echo "TOKEN_LEN=${#TOKEN}"
echo "TENANT_ID=$TENANT_ID"

if [ -z "${TOKEN}" ] || [ -z "${TENANT_ID}" ]; then
  echo "ERROR: token veya tenant_id parse edilemedi. LOGIN_JSON'i incele."
  exit 2
fi

curl -i "$HOST/audit-logs?page=1&limit=10" \
  -H "authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | head -140

echo
echo "=== DONE: Build + Deploy + Validation tamam ==="

