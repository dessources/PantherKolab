#!/bin/bash

# PantherKolab DynamoDB Tables Creation Script
# This script creates all required DynamoDB tables for the project
echo "started"
set -e  # Exit on error

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ENV="${ENVIRONMENT:-dev}"

echo "========================================="
echo "PantherKolab DynamoDB Table Setup"
echo "========================================="
echo "Region: $REGION"
echo "Environment: $ENV"
echo "========================================="
echo ""

# Function to check if table exists
table_exists() {
    aws dynamodb describe-table --table-name "$1" --region "$REGION" > /dev/null 2>&1
}

# Function to wait for table to be active
wait_for_table() {
    echo "Waiting for table $1 to be active..."
    aws dynamodb wait table-exists --table-name "$1" --region "$REGION"
    echo "✅ Table $1 is now active"
}

# Create Users Table
echo "Creating Users table..."
TABLE_NAME="PantherKolab-Users-${ENV}"

if table_exists "$TABLE_NAME"; then
    echo "⚠️  Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
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
        --tags \
            Key=Project,Value=PantherKolab \
            Key=Environment,Value=$ENV \
        --region "$REGION"

    wait_for_table "$TABLE_NAME"
    echo "✅ Created Users table"
fi

echo ""

# Create Conversations Table
echo "Creating Conversations table..."
TABLE_NAME="PantherKolab-Conversations-${ENV}"

if table_exists "$TABLE_NAME"; then
    echo "⚠️  Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions \
            AttributeName=conversationId,AttributeType=S \
        --key-schema \
            AttributeName=conversationId,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --tags \
            Key=Project,Value=PantherKolab \
            Key=Environment,Value=$ENV \
        --region "$REGION"

    wait_for_table "$TABLE_NAME"
    echo "✅ Created Conversations table"
fi

echo ""

# Create Messages Table
echo "Creating Messages table..."
TABLE_NAME="PantherKolab-Messages-${ENV}"

if table_exists "$TABLE_NAME"; then
    echo "⚠️  Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
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
        --tags \
            Key=Project,Value=PantherKolab \
            Key=Environment,Value=$ENV \
        --region "$REGION"

    wait_for_table "$TABLE_NAME"
    echo "✅ Created Messages table"
fi

echo ""

# Create Groups Table
echo "Creating Groups table..."
TABLE_NAME="PantherKolab-Groups-${ENV}"

if table_exists "$TABLE_NAME"; then
    echo "⚠️  Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
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
        --tags \
            Key=Project,Value=PantherKolab \
            Key=Environment,Value=$ENV \
        --region "$REGION"

    wait_for_table "$TABLE_NAME"
    echo "✅ Created Groups table"
fi

echo ""

# Create Meetings Table (Chime)
echo "Creating Meetings table (Chime)..."
TABLE_NAME="PantherKolab-Meetings-${ENV}"

if table_exists "$TABLE_NAME"; then
    echo "⚠️  Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions \
            AttributeName=meetingId,AttributeType=S \
            AttributeName=creatorId,AttributeType=S \
            AttributeName=scheduledTime,AttributeType=S \
        --key-schema \
            AttributeName=meetingId,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --global-secondary-indexes \
            "[
                {
                    \"IndexName\": \"CreatorIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"creatorId\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"scheduledTime\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\": {\"ProjectionType\":\"ALL\"}
                }
            ]" \
        --tags \
            Key=Project,Value=PantherKolab \
            Key=Environment,Value=$ENV \
        --region "$REGION"

    wait_for_table "$TABLE_NAME"
    echo "✅ Created Meetings table"
fi

echo ""

# Create CallSessions Table (Chime)
echo "Creating CallSessions table (Chime)..."
TABLE_NAME="PantherKolab-CallSessions-${ENV}"

if table_exists "$TABLE_NAME"; then
    echo "⚠️  Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions \
            AttributeName=sessionId,AttributeType=S \
            AttributeName=timestamp,AttributeType=S \
            AttributeName=participantId,AttributeType=S \
        --key-schema \
            AttributeName=sessionId,KeyType=HASH \
            AttributeName=timestamp,KeyType=RANGE \
        --billing-mode PAY_PER_REQUEST \
        --global-secondary-indexes \
            "[
                {
                    \"IndexName\": \"ParticipantIndex\",
                    \"KeySchema\": [
                        {\"AttributeName\":\"participantId\",\"KeyType\":\"HASH\"},
                        {\"AttributeName\":\"timestamp\",\"KeyType\":\"RANGE\"}
                    ],
                    \"Projection\": {\"ProjectionType\":\"ALL\"}
                }
            ]" \
        --tags \
            Key=Project,Value=PantherKolab \
            Key=Environment,Value=$ENV \
        --region "$REGION"

    wait_for_table "$TABLE_NAME"
    echo "✅ Created CallSessions table"
fi

echo ""

# Create MeetingInvites Table (Chime)
echo "Creating MeetingInvites table (Chime)..."
TABLE_NAME="PantherKolab-MeetingInvites-${ENV}"

if table_exists "$TABLE_NAME"; then
    echo "⚠️  Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions \
            AttributeName=inviteId,AttributeType=S \
            AttributeName=meetingId,AttributeType=S \
            AttributeName=inviteeId,AttributeType=S \
        --key-schema \
            AttributeName=inviteId,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --global-secondary-indexes \
            "[
                {
                    \"IndexName\": \"MeetingIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"meetingId\",\"KeyType\":\"HASH\"}],
                    \"Projection\": {\"ProjectionType\":\"ALL\"}
                },
                {
                    \"IndexName\": \"InviteeIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"inviteeId\",\"KeyType\":\"HASH\"}],
                    \"Projection\": {\"ProjectionType\":\"ALL\"}
                }
            ]" \
        --tags \
            Key=Project,Value=PantherKolab \
            Key=Environment,Value=$ENV \
        --region "$REGION"

    wait_for_table "$TABLE_NAME"
    echo "✅ Created MeetingInvites table"
fi

echo ""

# Create MeetingAttendees Table (Chime)
echo "Creating MeetingAttendees table (Chime)..."
TABLE_NAME="PantherKolab-MeetingAttendees-${ENV}"

if table_exists "$TABLE_NAME"; then
    echo "⚠️  Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions \
            AttributeName=attendeeId,AttributeType=S \
            AttributeName=meetingId,AttributeType=S \
            AttributeName=userId,AttributeType=S \
        --key-schema \
            AttributeName=attendeeId,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --global-secondary-indexes \
            "[
                {
                    \"IndexName\": \"MeetingIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"meetingId\",\"KeyType\":\"HASH\"}],
                    \"Projection\": {\"ProjectionType\":\"ALL\"}
                },
                {
                    \"IndexName\": \"UserIndex\",
                    \"KeySchema\": [{\"AttributeName\":\"userId\",\"KeyType\":\"HASH\"}],
                    \"Projection\": {\"ProjectionType\":\"ALL\"}
                }
            ]" \
        --tags \
            Key=Project,Value=PantherKolab \
            Key=Environment,Value=$ENV \
        --region "$REGION"

    wait_for_table "$TABLE_NAME"
    echo "✅ Created MeetingAttendees table"
fi

echo ""
echo "========================================="
echo "✅ All DynamoDB tables created successfully!"
echo "========================================="
echo ""
echo "Created tables:"
echo "  - PantherKolab-Users-${ENV}"
echo "  - PantherKolab-Conversations-${ENV}"
echo "  - PantherKolab-Messages-${ENV}"
echo "  - PantherKolab-Groups-${ENV}"
echo "  - PantherKolab-Meetings-${ENV} (Chime)"
echo "  - PantherKolab-CallSessions-${ENV} (Chime)"
echo "  - PantherKolab-MeetingInvites-${ENV} (Chime)"
echo "  - PantherKolab-MeetingAttendees-${ENV} (Chime)"
echo ""
echo "Next steps:"
echo "  1. Update your .env.local with table names"
echo "  2. Add table names to AWS Parameter Store"
echo "  3. Configure Cognito Post-Confirmation trigger"
echo "  4. Test the connection with: npm run test:dynamodb"
echo ""
