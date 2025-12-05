#!/bin/bash
# create-whiteboards-table.sh
# Creates the PantherKolab-Whiteboards-dev table with ConversationIdIndex GSI

set -e

# Configuration
TABLE_NAME="PantherKolab-Whiteboards-dev"
REGION="us-east-1"

echo "Creating DynamoDB table: $TABLE_NAME"

# Create the table
aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=whiteboardId,AttributeType=S \
    AttributeName=conversationId,AttributeType=S \
  --key-schema \
    AttributeName=whiteboardId,KeyType=HASH \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"ConversationIdIndex\",
        \"KeySchema\": [
          {\"AttributeName\": \"conversationId\", \"KeyType\": \"HASH\"}
        ],
        \"Projection\": {\"ProjectionType\": \"ALL\"},
        \"ProvisionedThroughput\": {
          \"ReadCapacityUnits\": 5,
          \"WriteCapacityUnits\": 5
        }
      }
    ]" \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region "$REGION" \
  --tags Key=Environment,Value=dev Key=Project,Value=PantherKolab

echo "Waiting for table to become active..."
aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"

echo "Table $TABLE_NAME created successfully!"
echo ""
echo "Table details:"
aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --query "Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}" --output table
