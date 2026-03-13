#!/bin/bash

# SchemeSync Database Backup Script

set -e

# Configuration
BACKUP_DIR="/opt/schemesync/backups"
DB_PATH="/opt/schemesync/data/schemesync.db"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🗄️ Starting SchemeSync database backup..."

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database file not found: $DB_PATH"
    exit 1
fi

# Create backup filename
BACKUP_FILE="$BACKUP_DIR/schemesync_backup_$DATE.db"

# Create backup
echo "📦 Creating backup: $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_FILE"

# Compress backup
echo "🗜️ Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup created successfully: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Clean old backups
echo "🧹 Cleaning old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "schemesync_backup_*.db.gz" -mtime +$RETENTION_DAYS -delete

# List current backups
echo "📋 Current backups:"
ls -lh "$BACKUP_DIR"/schemesync_backup_*.db.gz 2>/dev/null || echo "No backups found"

echo "✅ Backup process completed!"

# Optional: Upload to S3 (uncomment if needed)
# if [ ! -z "$AWS_S3_BACKUP_BUCKET" ]; then
#     echo "☁️ Uploading to S3..."
#     aws s3 cp "$BACKUP_FILE" "s3://$AWS_S3_BACKUP_BUCKET/schemesync/$(basename $BACKUP_FILE)"
#     echo "✅ Backup uploaded to S3"
# fi