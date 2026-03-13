#!/bin/bash

# SchemeSync Database Restore Script

set -e

# Configuration
BACKUP_DIR="/opt/schemesync/backups"
DB_PATH="/opt/schemesync/data/schemesync.db"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/schemesync_backup_*.db.gz 2>/dev/null | sort -r | head -10
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try to find it in backup directory
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        echo "❌ Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

echo "🔄 Starting SchemeSync database restore..."
echo "📁 Backup file: $BACKUP_FILE"
echo "🎯 Target database: $DB_PATH"

# Confirm restore
read -p "⚠️ This will overwrite the current database. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# Stop the application
echo "🛑 Stopping SchemeSync application..."
pm2 stop schemesync-api || true

# Backup current database
if [ -f "$DB_PATH" ]; then
    CURRENT_BACKUP="$DB_PATH.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backing up current database to: $CURRENT_BACKUP"
    cp "$DB_PATH" "$CURRENT_BACKUP"
fi

# Restore database
echo "📦 Restoring database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    # Decompress and restore
    gunzip -c "$BACKUP_FILE" > "$DB_PATH"
else
    # Direct copy
    cp "$BACKUP_FILE" "$DB_PATH"
fi

# Set proper permissions
chown $USER:$USER "$DB_PATH"
chmod 644 "$DB_PATH"

# Verify restore
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo "✅ Database restored successfully ($DB_SIZE)"
else
    echo "❌ Restore failed!"
    exit 1
fi

# Start the application
echo "🚀 Starting SchemeSync application..."
pm2 start schemesync-api

# Wait for application to start
sleep 5

# Test database connection
echo "🔍 Testing database connection..."
curl -s http://localhost:3000/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Application started successfully"
else
    echo "⚠️ Application may not have started properly. Check logs with: pm2 logs schemesync-api"
fi

echo "✅ Restore process completed!"
echo ""
echo "📋 Next steps:"
echo "1. Verify application is working: curl http://localhost:3000/health"
echo "2. Check application logs: pm2 logs schemesync-api"
echo "3. Test API endpoints to ensure data integrity"