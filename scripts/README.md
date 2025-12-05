# PantherKolab Scripts

This directory contains utility scripts for managing AWS resources and testing the PantherKolab application.

## DynamoDB Scripts

### Setup Scripts

#### `create-dynamodb-tables.sh`

Creates all required DynamoDB tables for PantherKolab.

**Usage:**

```bash
# Using default values (us-east-1, dev)
./scripts/create-dynamodb-tables.sh

# With custom region and environment
AWS_REGION=us-west-2 ENVIRONMENT=prod ./scripts/create-dynamodb-tables.sh
```

**Environment Variables:**

- `AWS_REGION` - AWS region (default: us-east-1)
- `ENVIRONMENT` - Environment name (default: dev)

**Tables Created:**

- PantherKolab-Users-{env}
- PantherKolab-Conversations-{env}
- PantherKolab-Messages-{env}
- PantherKolab-Groups-{env}

---

#### `delete-dynamodb-tables.sh`

Deletes all PantherKolab DynamoDB tables.

**⚠️ WARNING:** This permanently deletes all data!

**Usage:**

```bash
./scripts/delete-dynamodb-tables.sh
# You will be prompted to type 'DELETE' to confirm
```

---

#### `list-dynamodb-tables.sh`

Lists all PantherKolab tables with their status, item count, and size.

**Usage:**

```bash
./scripts/list-dynamodb-tables.sh
```

---

### Testing Scripts

#### `test-dynamodb-connection.ts`

Tests the DynamoDB connection and performs CRUD operations.

**Usage:**

```bash
# Using tsx directly
tsx scripts/test-dynamodb-connection.ts

# Or add to package.json scripts:
npm run test:dynamodb
```

**What it tests:**

1. ✅ Write operation (PutCommand)
2. ✅ Read operation (GetCommand)
3. ✅ Data integrity verification
4. ✅ Delete operation (DeleteCommand)
5. ✅ Deletion verification

**Requirements:**

- Tables must be created first
- Environment variables must be set in `.env.local`
- AWS credentials must be valid

---

## Prerequisites

### For Bash Scripts

1. **AWS CLI** must be installed:

   ```bash
   # Check if installed
   aws --version

   # Install on macOS
   brew install awscli

   # Install on Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. **AWS Credentials** must be configured:

   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Enter default region (e.g., us-east-1)
   ```

3. **Make scripts executable:**
   ```bash
   chmod +x scripts/*.sh
   ```

### For TypeScript Scripts

1. **tsx** must be installed:

   ```bash
   npm install -g tsx
   ```

2. **Environment variables** in `.env.local`:
   ```bash
   NEXT_PUBLIC_AWS_REGION=us-east-1
   NEXT_PUBLIC_AWS_ACCESS_KEY_ID=your_access_key
   NEXT_PUBLIC_APP_AWS_SECRET_ACCESS_KEY=your_secret_key
   DYNAMODB_USERS_TABLE=PantherKolab-Users-dev
   DYNAMODB_CONVERSATIONS_TABLE=PantherKolab-Conversations-dev
   DYNAMODB_MESSAGES_TABLE=PantherKolab-Messages-dev
   DYNAMODB_GROUPS_TABLE=PantherKolab-Groups-dev
   ```

---

## Quick Start

### First Time Setup

1. **Configure AWS credentials:**

   ```bash
   aws configure
   ```

2. **Create DynamoDB tables:**

   ```bash
   ./scripts/create-dynamodb-tables.sh
   ```

3. **Verify tables were created:**

   ```bash
   ./scripts/list-dynamodb-tables.sh
   ```

4. **Test connection:**

   ```bash
   tsx scripts/test-dynamodb-connection.ts
   ```

5. **Update `.env.local`:**
   ```bash
   DYNAMODB_USERS_TABLE=PantherKolab-Users-dev
   DYNAMODB_CONVERSATIONS_TABLE=PantherKolab-Conversations-dev
   DYNAMODB_MESSAGES_TABLE=PantherKolab-Messages-dev
   DYNAMODB_GROUPS_TABLE=PantherKolab-Groups-dev
   ```

---

## Troubleshooting

### "Permission denied" error

```bash
chmod +x scripts/*.sh
```

### "Table already exists" error

This is normal if you've already created the tables. The script will skip existing tables.

### "ResourceNotFoundException" error

The table doesn't exist. Run `create-dynamodb-tables.sh` first.

### "AccessDeniedException" error

Your AWS credentials don't have sufficient permissions. Ensure your IAM user has:

- `dynamodb:CreateTable`
- `dynamodb:DescribeTable`
- `dynamodb:PutItem`
- `dynamodb:GetItem`
- `dynamodb:DeleteItem`
- `dynamodb:DeleteTable`

### Connection test fails

1. Check `.env.local` has correct credentials
2. Verify tables exist with `list-dynamodb-tables.sh`
3. Check AWS region matches in both scripts and `.env.local`
4. Verify IAM permissions

---

## Additional Scripts (Coming Soon)

- `seed-test-data.ts` - Populate tables with test data
- `backup-tables.sh` - Create on-demand backups
- `export-data.sh` - Export table data to JSON

---

## Notes

- All bash scripts use `set -e` to exit on error
- Table names follow pattern: `PantherKolab-{TableName}-{Environment}`
- Scripts are idempotent - safe to run multiple times
- Use `ENVIRONMENT=prod` carefully - production data!

---

**Last Updated:** October 2025
