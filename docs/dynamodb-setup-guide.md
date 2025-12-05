# DynamoDB Setup Guide for PantherKolab

## Overview

This guide walks you through setting up Amazon DynamoDB for the PantherKolab project, including table design, AWS configuration, and integration with Cognito authentication.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [DynamoDB Table Design](#dynamodb-table-design)
3. [AWS Setup Steps](#aws-setup-steps)
4. [Environment Configuration](#environment-configuration)
5. [Cognito-DynamoDB Integration](#cognito-dynamodb-integration)
6. [Testing the Setup](#testing-the-setup)

---

## Prerequisites

Before starting, ensure you have:

- ✅ AWS Account with appropriate permissions
- ✅ AWS CLI installed and configured
- ✅ Node.js and npm installed
- ✅ AWS SDK packages installed (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`)
- ✅ AWS Amplify configured for Cognito

---

## DynamoDB Table Design

### Table 1: Users

**Purpose:** Store user profiles and academic information

**Primary Key:**

- Partition Key: `userId` (String) - Cognito user sub

**Attributes:**

```typescript
{
  userId: string            // Partition key (Cognito sub)
  email: string            // User email (FIU email)
  firstName: string        // User's first name
  lastName: string         // User's last name
  fullName: string         // Combined full name
  emailVerified: boolean   // Email verification status
  profilePicture: string?  // S3 URL to profile picture
  major: string?           // Academic major
  year: string?            // Academic year (Freshman, Sophomore, etc.)
  bio: string?             // Personal bio
  interests: string[]      // Array of interests/tags
  portfolioUrl: string?    // Personal portfolio/website
  createdAt: string        // ISO timestamp
  updatedAt: string        // ISO timestamp
}
```

**Global Secondary Indexes (GSI):**

- `EmailIndex`: email (PK) - for email lookups
- `MajorIndex`: major (PK), year (SK) - for finding students by major/year

---

### Table 2: Conversations

**Purpose:** Store conversation metadata (DMs and groups)

**Primary Key:**

- Partition Key: `conversationId` (String)

**Attributes:**

```typescript
{
  conversationId: string     // UUID
  type: 'DM' | 'GROUP'      // Conversation type
  name: string?             // Group name (null for DMs)
  description: string?      // Group description
  participants: string[]    // Array of userIds
  admins: string[]         // Array of admin userIds (for groups)
  createdBy: string        // Creator userId
  createdAt: string        // ISO timestamp
  updatedAt: string        // ISO timestamp
  lastMessageAt: string    // For sorting conversations
  avatar: string?          // S3 URL for group avatar
}
```

**Global Secondary Indexes (GSI):**

- `ParticipantIndex`: Add participants as a List attribute, use `contains` for queries

---

### Table 3: Messages

**Purpose:** Store all messages (text, audio, media)

**Primary Key:**

- Partition Key: `conversationId` (String)
- Sort Key: `timestamp` (String) - ISO timestamp

**Attributes:**

```typescript
{
  conversationId: string    // Partition key
  timestamp: string        // Sort key (ISO timestamp)
  messageId: string        // UUID
  senderId: string         // User ID who sent the message
  type: 'TEXT' | 'AUDIO' | 'IMAGE' | 'VIDEO' | 'FILE'
  content: string?         // Text content (for text messages)
  mediaUrl: string?        // S3 URL for media files
  fileName: string?        // Original file name
  fileSize: number?        // File size in bytes
  duration: number?        // Duration for audio/video (seconds)
  readBy: string[]         // Array of userIds who read the message
  reactions: Record<string, string[]> // emoji -> [userId]
  replyTo: string?         // messageId being replied to
  deleted: boolean         // Soft delete flag
  createdAt: string        // ISO timestamp
}
```

**Global Secondary Indexes (GSI):**

- `MessageIdIndex`: messageId (PK) - for direct message lookups

---

### Table 4: Groups

**Purpose:** Store group-specific settings and metadata

**Primary Key:**

- Partition Key: `groupId` (String)

**Attributes:**

```typescript
{
  groupId: string             // Same as conversationId for groups
  classCode: string?          // Associated class code (e.g., "COP4520")
  semester: string?           // Semester (e.g., "Fall 2025")
  isClassGroup: boolean       // Auto-created for classes
  tags: string[]              // Tags for discoverability
  settings: {
    isPublic: boolean         // Can anyone join?
    requireApproval: boolean  // Admin approval needed?
    maxMembers: number        // Member limit
  }
  memberCount: number         // Current member count
  createdAt: string
  updatedAt: string
}
```

**Global Secondary Indexes (GSI):**

- `ClassCodeIndex`: classCode (PK), semester (SK) - for finding class groups

---

## AWS Setup Steps

### Option 1: Using AWS Console (Recommended for Learning)

#### Step 1: Navigate to DynamoDB

1. Log into AWS Console
2. Search for "DynamoDB" in the services search
3. Click "Create table"

#### Step 2: Create Users Table

**Configuration:**

```
Table name: PantherKolab-Users-dev
Partition key: userId (String)
Sort key: (none)

Table settings: Customize settings
Read/write capacity: On-demand
Encryption: AWS owned key (for dev)
```

**Add Global Secondary Indexes:**

1. EmailIndex:

   - Partition key: `email` (String)
   - Projection: All attributes
   - Capacity: On-demand

2. MajorIndex:
   - Partition key: `major` (String)
   - Sort key: `year` (String)
   - Projection: All attributes
   - Capacity: On-demand

#### Step 3: Create Conversations Table

```
Table name: PantherKolab-Conversations-dev
Partition key: conversationId (String)
Read/write capacity: On-demand
```

#### Step 4: Create Messages Table

```
Table name: PantherKolab-Messages-dev
Partition key: conversationId (String)
Sort key: timestamp (String)
Read/write capacity: On-demand
```

**Add GSI:**

- MessageIdIndex:
  - Partition key: `messageId` (String)
  - Projection: All attributes

#### Step 5: Create Groups Table

```
Table name: PantherKolab-Groups-dev
Partition key: groupId (String)
Read/write capacity: On-demand
```

**Add GSI:**

- ClassCodeIndex:
  - Partition key: `classCode` (String)
  - Sort key: `semester` (String)
  - Projection: All attributes

---

### Option 2: Using AWS CLI (Faster, Repeatable)

Save this as `scripts/create-dynamodb-tables.sh`:

```bash
#!/bin/bash

REGION="us-east-1"
ENV="dev"

echo "Creating DynamoDB tables for PantherKolab..."

# Create Users Table
aws dynamodb create-table \
    --table-name PantherKolab-Users-${ENV} \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=email,AttributeType=S \
        AttributeName=major,AttributeType=S \
        AttributeName=year,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"EmailIndex\",
                \"KeySchema\": [{\"AttributeName\":\"email\",\"KeyType\":\"HASH\"}],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            },
            {
                \"IndexName\": \"MajorIndex\",
                \"KeySchema\": [
                    {\"AttributeName\":\"major\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"year\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            }
        ]" \
    --region ${REGION}

echo "Created Users table"

# Create Conversations Table
aws dynamodb create-table \
    --table-name PantherKolab-Conversations-${ENV} \
    --attribute-definitions \
        AttributeName=conversationId,AttributeType=S \
    --key-schema \
        AttributeName=conversationId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

echo "Created Conversations table"

# Create Messages Table
aws dynamodb create-table \
    --table-name PantherKolab-Messages-${ENV} \
    --attribute-definitions \
        AttributeName=conversationId,AttributeType=S \
        AttributeName=timestamp,AttributeType=S \
        AttributeName=messageId,AttributeType=S \
    --key-schema \
        AttributeName=conversationId,KeyType=HASH \
        AttributeName=timestamp,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"MessageIdIndex\",
                \"KeySchema\": [{\"AttributeName\":\"messageId\",\"KeyType\":\"HASH\"}],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            }
        ]" \
    --region ${REGION}

echo "Created Messages table"

# Create Groups Table
aws dynamodb create-table \
    --table-name PantherKolab-Groups-${ENV} \
    --attribute-definitions \
        AttributeName=groupId,AttributeType=S \
        AttributeName=classCode,AttributeType=S \
        AttributeName=semester,AttributeType=S \
    --key-schema \
        AttributeName=groupId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"ClassCodeIndex\",
                \"KeySchema\": [
                    {\"AttributeName\":\"classCode\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"semester\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            }
        ]" \
    --region ${REGION}

echo "Created Groups table"
echo "All tables created successfully!"
```

Run with:

```bash
chmod +x scripts/create-dynamodb-tables.sh
./scripts/create-dynamodb-tables.sh
```

---

## Environment Configuration

### Required Environment Variables

Add these to your `.env.local` file:

```bash
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_AWS_ACCESS_KEY_ID=your_access_key_here
NEXT_PUBLIC_APP_AWS_SECRET_ACCESS_KEY=your_secret_key_here

# DynamoDB Table Names
DYNAMODB_USERS_TABLE=PantherKolab-Users-dev
DYNAMODB_CONVERSATIONS_TABLE=PantherKolab-Conversations-dev
DYNAMODB_MESSAGES_TABLE=PantherKolab-Messages-dev
DYNAMODB_GROUPS_TABLE=PantherKolab-Groups-dev

# Cognito Configuration (already configured)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your_user_pool_id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your_client_id
```

**⚠️ SECURITY WARNING:**

- NEVER commit `.env.local` to git
- Use IAM roles in production instead of access keys
- Follow principle of least privilege for IAM permissions

---

## Cognito-DynamoDB Integration

### The Flow

```
1. User signs up → Cognito creates auth account
2. Cognito triggers Post-Confirmation Lambda
3. Lambda creates user profile in DynamoDB Users table
4. User can now login and access their profile
```

### Why This Approach?

✅ **Automatic** - No manual profile creation needed
✅ **Reliable** - Triggered by Cognito, not client-side
✅ **Secure** - Runs server-side with proper permissions
✅ **Consistent** - Every Cognito user gets a DynamoDB profile

### Implementation Options

#### Option A: Cognito Lambda Trigger (Recommended)

Create a Post-Confirmation Lambda trigger that runs automatically after email verification.

**Location:** `backend/triggers/postConfirmation.ts`

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PostConfirmationTriggerEvent } from "aws-lambda";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

export const handler = async (event: PostConfirmationTriggerEvent) => {
  const { sub, email, given_name, family_name } = event.request.userAttributes;

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: process.env.USERS_TABLE_NAME!,
        Item: {
          userId: sub,
          email: email,
          firstName: given_name,
          lastName: family_name || "",
          fullName: `${given_name} ${family_name || ""}`.trim(),
          emailVerified: true,
          profilePicture: null,
          major: null,
          year: null,
          bio: null,
          interests: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );

    console.log(`User profile created for ${email}`);
  } catch (error) {
    console.error("Error creating user profile:", error);
    // Don't throw - allow signup to complete even if DynamoDB fails
  }

  return event;
};
```

**Deploy this Lambda:**

1. Create Lambda function in AWS Console
2. Attach to Cognito User Pool as Post-Confirmation trigger
3. Give Lambda IAM permission to write to DynamoDB
4. Set environment variable `USERS_TABLE_NAME`

#### Option B: Client-Side Creation (Current Approach)

Your current implementation in `src/app/api/auth/signup/route.ts` works but requires client to call the API after signup.

**Pros:**

- Simple to implement
- No AWS Lambda deployment needed

**Cons:**

- Not automatic (client must remember to call)
- Can fail silently
- User exists in Cognito but not DynamoDB if client fails

---

## Testing the Setup

### 1. Test DynamoDB Connection

Create `scripts/test-dynamodb.ts`:

```typescript
import { dynamoDb } from "../src/lib/dynamodb";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

async function testConnection() {
  console.log("Testing DynamoDB connection...");

  const testItem = {
    TableName: process.env.DYNAMODB_USERS_TABLE!,
    Item: {
      userId: "test-user-123",
      email: "test@fiu.edu",
      firstName: "Test",
      lastName: "User",
      fullName: "Test User",
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  try {
    // Write test item
    await dynamoDb.send(new PutCommand(testItem));
    console.log("✅ Write successful");

    // Read test item
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_USERS_TABLE!,
        Key: { userId: "test-user-123" },
      })
    );
    console.log("✅ Read successful:", result.Item);
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testConnection();
```

Run with:

```bash
tsx scripts/test-dynamodb.ts
```

### 2. Test User Creation Flow

1. Sign up a new user via your app
2. Check Cognito User Pool - user should exist
3. Check DynamoDB Users table - profile should exist
4. Verify userId in DynamoDB matches Cognito `sub`

### 3. Test userService Methods

```typescript
import { userService } from "./src/services/userService";

// Get user
const user = await userService.getUser("some-user-id");
console.log(user);

// Update user
await userService.updateUser("some-user-id", {
  major: "Computer Science",
  year: "Junior",
  bio: "CS student interested in AI",
});

// Check existence
const exists = await userService.userExists("some-user-id");
console.log("User exists:", exists);
```

---

## Common Issues & Solutions

### Issue: "ResourceNotFoundException: Requested resource not found"

**Solution:** Table doesn't exist. Check table name matches environment variable.

```bash
# List tables
aws dynamodb list-tables --region us-east-1
```

### Issue: "ValidationException: One or more parameter values were invalid"

**Solution:** Check data types match schema (String, Number, Boolean, etc.)

### Issue: "AccessDeniedException"

**Solution:** IAM user/role lacks DynamoDB permissions. Add this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/PantherKolab-*"
    }
  ]
}
```

### Issue: User created in Cognito but not DynamoDB

**Solution:**

- Check Lambda trigger is attached and has correct permissions
- Check CloudWatch logs for Lambda errors
- Implement retry logic or fallback to API route

---

## Next Steps

After completing this setup:

1. ✅ Test all CRUD operations on Users table
2. ✅ Implement Conversations service
3. ✅ Implement Messages service
4. ✅ Set up S3 for media storage
5. ✅ Implement real-time subscriptions with AppSync

---

## Additional Resources

- [DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/)
- [AWS SDK v3 for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Cognito Lambda Triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html)

---

**Created:** October 2025
**Last Updated:** October 2025
**Author:** PantherKolab Team
