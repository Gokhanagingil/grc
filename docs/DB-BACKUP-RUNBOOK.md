# Database Backup Runbook

This document provides operational procedures for backing up and restoring the GRC Platform database.

## Overview

The GRC Platform uses PostgreSQL as its primary database. Regular backups are essential for disaster recovery and data protection. This runbook covers backup procedures, restore procedures, and best practices.

## Prerequisites

Before performing backup or restore operations, ensure you have:

1. PostgreSQL client tools installed (`pg_dump`, `psql`)
2. Database credentials with appropriate permissions
3. Sufficient disk space for backup files
4. Network access to the database server

## Environment Variables

The backup scripts use the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_NAME` | `grc_platform` | Database name |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | (none) | Database password |

## Backup Procedures

### Manual Backup

To create a manual backup:

```bash
# Set environment variables
export DB_PASSWORD="your_password"

# Run backup script
./scripts/db-backup.sh [backup_directory]

# Example with custom backup directory
./scripts/db-backup.sh /var/backups/grc
```

The backup script will:
1. Create a SQL dump of the database
2. Compress the dump using gzip
3. Create a `latest.sql.gz` symlink
4. Clean up backups older than 30 days

### Backup File Naming

Backup files follow this naming convention:
```
grc_backup_YYYYMMDD_HHMMSS.sql.gz
```

Example: `grc_backup_20240115_143022.sql.gz`

### Automated Backups

For production environments, set up automated backups using cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2:00 AM
0 2 * * * DB_PASSWORD="your_password" /path/to/grc/scripts/db-backup.sh /var/backups/grc >> /var/log/grc-backup.log 2>&1

# Add weekly full backup on Sundays at 3:00 AM
0 3 * * 0 DB_PASSWORD="your_password" /path/to/grc/scripts/db-backup.sh /var/backups/grc/weekly >> /var/log/grc-backup.log 2>&1
```

### Backup Verification

After creating a backup, verify its integrity:

```bash
# Check file exists and has content
ls -lh /path/to/backup/grc_backup_*.sql.gz

# Test decompression
gunzip -t /path/to/backup/grc_backup_20240115_143022.sql.gz

# Preview contents (first 50 lines)
zcat /path/to/backup/grc_backup_20240115_143022.sql.gz | head -50
```

## Restore Procedures

### Full Database Restore

To restore from a backup:

```bash
# Set environment variables
export DB_PASSWORD="your_password"

# Run restore script
./scripts/db-restore.sh /path/to/backup/grc_backup_20240115_143022.sql.gz

# Or restore from latest backup
./scripts/db-restore.sh /path/to/backups/latest.sql.gz
```

The restore script will:
1. Terminate existing database connections
2. Drop and recreate the database
3. Restore data from the backup file
4. Display table row counts for verification

### Post-Restore Steps

After restoring a database:

1. Run migrations to ensure schema is up to date:
   ```bash
   cd backend-nest
   npm run migration:run
   ```

2. Verify application connectivity:
   ```bash
   npm run start:dev
   # Check health endpoint: GET /health/db
   ```

3. Verify data integrity:
   ```bash
   # Check entity counts
   psql -h localhost -U postgres -d grc_platform -c "
     SELECT 'risks' as entity, COUNT(*) FROM grc_risks
     UNION ALL
     SELECT 'policies', COUNT(*) FROM grc_policies
     UNION ALL
     SELECT 'requirements', COUNT(*) FROM grc_requirements
     UNION ALL
     SELECT 'users', COUNT(*) FROM nest_users;
   "
   ```

### Point-in-Time Recovery

For point-in-time recovery, you need:
1. A base backup
2. WAL (Write-Ahead Log) archives

Configure WAL archiving in `postgresql.conf`:
```
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

## Disaster Recovery

### Recovery Time Objective (RTO)

Target recovery time: **1 hour**

Steps to achieve RTO:
1. Identify the issue (5 minutes)
2. Locate latest backup (5 minutes)
3. Restore database (30 minutes)
4. Run migrations (10 minutes)
5. Verify and test (10 minutes)

### Recovery Point Objective (RPO)

Target data loss: **24 hours** (with daily backups)

To reduce RPO:
- Increase backup frequency
- Enable WAL archiving for point-in-time recovery
- Use streaming replication for near-zero RPO

### Emergency Contacts

| Role | Contact |
|------|---------|
| Database Administrator | dba@company.com |
| DevOps Team | devops@company.com |
| On-Call Engineer | oncall@company.com |

## Backup Storage

### Local Storage

Default backup location: `./backups/`

Recommended structure:
```
/var/backups/grc/
├── daily/
│   ├── grc_backup_20240115_020000.sql.gz
│   ├── grc_backup_20240116_020000.sql.gz
│   └── latest.sql.gz -> grc_backup_20240116_020000.sql.gz
└── weekly/
    ├── grc_backup_20240107_030000.sql.gz
    └── grc_backup_20240114_030000.sql.gz
```

### Remote Storage

For production environments, copy backups to remote storage:

```bash
# AWS S3
aws s3 cp /var/backups/grc/latest.sql.gz s3://grc-backups/daily/

# Google Cloud Storage
gsutil cp /var/backups/grc/latest.sql.gz gs://grc-backups/daily/

# Azure Blob Storage
az storage blob upload --file /var/backups/grc/latest.sql.gz --container-name grc-backups --name daily/latest.sql.gz
```

### Retention Policy

| Backup Type | Retention Period |
|-------------|------------------|
| Daily | 30 days |
| Weekly | 12 weeks |
| Monthly | 12 months |
| Yearly | 7 years |

## Monitoring

### Backup Monitoring

Monitor backup success with these checks:

1. **File existence**: Verify backup file was created
2. **File size**: Compare with previous backups
3. **Age**: Alert if latest backup is older than expected

Example monitoring script:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/grc"
MAX_AGE_HOURS=25

# Check if latest backup exists
if [ ! -f "$BACKUP_DIR/latest.sql.gz" ]; then
    echo "CRITICAL: No backup found"
    exit 2
fi

# Check backup age
BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$BACKUP_DIR/latest.sql.gz")) / 3600 ))
if [ $BACKUP_AGE -gt $MAX_AGE_HOURS ]; then
    echo "WARNING: Backup is $BACKUP_AGE hours old"
    exit 1
fi

echo "OK: Backup is $BACKUP_AGE hours old"
exit 0
```

### Health Check Integration

The GRC Platform includes a `/health/db` endpoint that reports:
- Database connection status
- Migration status
- Last backup timestamp

## Troubleshooting

### Common Issues

**Issue: pg_dump command not found**
```bash
# Install PostgreSQL client tools
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

**Issue: Connection refused**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection settings
psql -h localhost -U postgres -d grc_platform -c "SELECT 1"
```

**Issue: Permission denied**
```bash
# Check database user permissions
psql -h localhost -U postgres -c "
  SELECT rolname, rolsuper, rolcreatedb 
  FROM pg_roles 
  WHERE rolname = 'your_user';
"
```

**Issue: Disk space full**
```bash
# Check disk space
df -h

# Clean up old backups
find /var/backups/grc -name "*.sql.gz" -mtime +30 -delete
```

### Recovery from Corrupted Backup

If a backup file is corrupted:

1. Try to repair with gzip:
   ```bash
   gzip -d -c corrupted_backup.sql.gz > recovered.sql 2>/dev/null
   ```

2. Use an older backup if repair fails

3. Contact database administrator for assistance

## Security Considerations

1. **Encrypt backups** at rest and in transit
2. **Restrict access** to backup files and scripts
3. **Rotate credentials** used for backups
4. **Audit access** to backup storage
5. **Test restores** regularly in isolated environments

### Encrypting Backups

```bash
# Encrypt backup with GPG
gpg --symmetric --cipher-algo AES256 backup.sql.gz

# Decrypt backup
gpg --decrypt backup.sql.gz.gpg > backup.sql.gz
```

## Testing

### Monthly Restore Test

Perform a restore test monthly:

1. Create a test database
2. Restore latest backup to test database
3. Verify data integrity
4. Run application tests against restored data
5. Document results

### Restore Test Checklist

- [ ] Backup file accessible
- [ ] Restore completes without errors
- [ ] All tables present
- [ ] Row counts match expected
- [ ] Application connects successfully
- [ ] Sample queries return expected results
- [ ] Test database cleaned up
