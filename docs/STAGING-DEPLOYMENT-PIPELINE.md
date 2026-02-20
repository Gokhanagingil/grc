# GRC Platform - Staging Deployment Pipeline

Bu dokuman, GRC platformunun staging ortamina deploy edilmesi icin gerekli adimlari ve GitHub Actions workflow'unu aciklar.

## Staging Ortami Bilgileri

**Sunucu:**
- IP: 46.224.99.150
- OS: Ubuntu 22.04
- Deploy kullanicisi: grcdeploy

**Servisler:**

| Servis | Container Adi | Port | Aciklama |
|--------|---------------|------|----------|
| db | grc-staging-db | 5432 (internal) | PostgreSQL 15 veritabani |
| backend | grc-staging-backend | 3002 | NestJS API |
| frontend | grc-staging-frontend | 80 | React SPA (Nginx) |

## Environment Dosyalari

### Backend (.env.staging)

Dosya yolu: `backend-nest/.env.staging`

Gerekli degiskenler:
- `DB_USER`: PostgreSQL kullanici adi
- `DB_PASSWORD`: PostgreSQL sifresi (guclu, random)
- `DB_NAME`: Veritabani adi
- `JWT_SECRET`: JWT imzalama anahtari (minimum 64 karakter)
- `DEMO_ADMIN_PASSWORD`: Demo admin sifresi

Ornek dosya: `backend-nest/.env.staging.example`

### Frontend

Frontend icin environment degiskenleri build time'da set edilir:
- `REACT_APP_API_URL`: Backend API URL'i

docker-compose.staging.yml icinde `build.args` olarak tanimlanir.

## Docker Compose Kullanimi

### Servisleri Baslatma

```bash
cd /opt/grc-platform
docker compose -f docker-compose.staging.yml up -d --build
```

### Servisleri Durdurma

```bash
docker compose -f docker-compose.staging.yml down
```

### Loglari Izleme

```bash
# Tum servisler
docker compose -f docker-compose.staging.yml logs -f

# Sadece backend
docker compose -f docker-compose.staging.yml logs -f backend

# Sadece frontend
docker compose -f docker-compose.staging.yml logs -f frontend
```

### Servisleri Yeniden Olusturma

```bash
docker compose -f docker-compose.staging.yml up -d --build --force-recreate
```

## GitHub Actions Workflow

### Workflow Dosyasi

Dosya: `.github/workflows/deploy-staging.yml`

### Trigger Kosullari

1. **Manuel tetikleme:** `workflow_dispatch` ile GitHub Actions UI'dan
2. **Otomatik tetikleme:** `main` branch'e push (opsiyonel)

### Gerekli GitHub Secrets

| Secret Adi | Aciklama |
|------------|----------|
| `STAGING_SSH_HOST` | Staging sunucu IP'si (46.224.99.150) |
| `STAGING_SSH_USER` | SSH kullanici adi (grcdeploy) |
| `STAGING_SSH_KEY` | SSH private key icerigi |

### Workflow Adimlari

1. Checkout: Kodu al
2. SSH ile sunucuya baglan
3. Git pull ile son degisiklikleri cek
4. Docker compose ile servisleri yeniden olustur

### Workflow Ornegi

```yaml
name: Deploy to Staging

on:
  workflow_dispatch:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.STAGING_SSH_HOST }}
          username: ${{ secrets.STAGING_SSH_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/grc-platform
            git fetch --all
            git checkout main
            git pull origin main
            docker compose -f docker-compose.staging.yml up -d --build
```

## Staging Sunucu Kurulumu

### 1. Sistem Guncelleme

```bash
apt update && apt upgrade -y
```

### 2. Docker Kurulumu

```bash
# Docker GPG key ekle
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Docker repository ekle
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker kur
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 3. Deploy Kullanicisi Olusturma

```bash
# Kullanici olustur
adduser --disabled-password --gecos "" grcdeploy

# Docker grubuna ekle
usermod -aG docker grcdeploy

# Sudo yetkisi ver
usermod -aG sudo grcdeploy

# SSH key ekle
mkdir -p /home/grcdeploy/.ssh
cp /root/.ssh/authorized_keys /home/grcdeploy/.ssh/
chown -R grcdeploy:grcdeploy /home/grcdeploy/.ssh
chmod 700 /home/grcdeploy/.ssh
chmod 600 /home/grcdeploy/.ssh/authorized_keys
```

### 4. Repo Clone

```bash
mkdir -p /opt/grc-platform
cd /opt/grc-platform
git clone https://github.com/Gokhanagingil/grc.git .
chown -R grcdeploy:grcdeploy /opt/grc-platform
```

### 5. Environment Dosyalari

```bash
# Backend env
cp backend-nest/.env.staging.example backend-nest/.env.staging
# Degerleri duzenle

# Root level env (docker-compose icin)
cat > .env.staging << EOF
DB_USER=grc_staging
DB_PASSWORD=$(openssl rand -base64 32)
DB_NAME=grc_staging
JWT_SECRET=$(openssl rand -base64 64)
DEMO_ADMIN_PASSWORD=$(openssl rand -base64 16)
REACT_APP_API_URL=http://46.224.99.150:3002
EOF
```

### 6. Servisleri Baslat

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

## Health Check Endpointleri

| Endpoint | Aciklama |
|----------|----------|
| `http://46.224.99.150/health` | Frontend Nginx health |
| `http://46.224.99.150:3002/health/live` | Backend liveness |
| `http://46.224.99.150:3002/health/ready` | Backend readiness |

## Troubleshooting

### Container Durumunu Kontrol Et

```bash
docker ps -a
docker compose -f docker-compose.staging.yml ps
```

### Container Loglarini Incele

```bash
docker logs grc-staging-backend
docker logs grc-staging-frontend
docker logs grc-staging-db
```

### Veritabani Baglantisini Test Et

```bash
docker exec -it grc-staging-db psql -U grc_staging -d grc_staging -c "SELECT 1"
```

### Backend Health Check

```bash
curl http://46.224.99.150:3002/health/live
curl http://46.224.99.150:3002/health/ready
```

## Guvenlik Notlari

1. **SSH Key:** Deploy icin kullanilan SSH key'i sadece GitHub Secrets'ta saklayin
2. **JWT Secret:** Minimum 64 karakter, random generated olmali
3. **DB Password:** Guclu, random generated olmali
4. **Firewall:** Sadece 80 ve 3002 portlarini disindan erisime acin
5. **Root SSH:** Production'da root SSH erisimini kapatin

## Ilgili Dokumanlar

- [STAGING-DOCKER-OVERVIEW.md](./STAGING-DOCKER-OVERVIEW.md) - Docker yapisi detaylari
- [GRC-DEPLOYMENT-AND-ENVIRONMENTS.md](./GRC-DEPLOYMENT-AND-ENVIRONMENTS.md) - Genel deployment rehberi
- [SECURITY-AND-SECRETS-GUIDE.md](./SECURITY-AND-SECRETS-GUIDE.md) - Guvenlik ve secret yonetimi
