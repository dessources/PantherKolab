#!/bin/bash

# =========== DANGER ZONE: DATA MIGRATION SCRIPT ===========
#
# This script scans a DynamoDB table and updates the 'senderId' for matching  items.
#
# PLEASE READ BEFORE RUNNING:
# 1. **BACKUP YOUR DATA**: Before running this script, take a backup of your  DynamoDB table.
# 2. **COST & PERFORMANCE**: This script performs a 'Scan' operation, which can be slow and
#    costly on large tables. Run it during off-peak hours.
# 3. **VERIFY IDs**: Double-check that OLD_SENDER_ID and NEW_SENDER_ID are  correct.
# 4. **REGION**: Ensure the REGION variable matches your DynamoDB table's regio
#
# ==========================================================

# --- Configuration ---
TABLE_NAME="PantherKolab-Messages-dev"
OLD_SENDER_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
NEW_SENDER_ID="44e88408-8091-7022-99dc-c9b9b9d1d4af"
# Uses the default region of your CloudShell environment, or 'us-east-1' as a  fallback.
REGION=${AWS_REGION:-"us-east-1"}

# --- Safety Check ---
echo "DANGER: This script will modify data in the DynamoDB table '$TABLE_NAME'  region '$REGION'."
echo "It will change senderId FROM '$OLD_SENDER_ID' TO '$NEW_SENDER_ID'."
echo "Please ensure you have a backup of your table before proceeding."
read -p "Type 'proceed' to continue: " CONFIRM

if [ "$CONFIRM" != "proceed" ]; then
  echo "Operation cancelled by user."
  exit 1
fi
echo "Proceeding with migration..."

# --- Main Loop ---
UPDATED_COUNT=0
EXCLUSIVE_START_KEY=""

while true; do
  # Build the scan command. We use 'eval' to handle the optional  --exclusive-start-key argument.
  CMD="aws dynamodb scan --table-name \"$TABLE_NAME\" --filter-expression  \"senderId = :old_id\" --expression-attribute-values '{\":old_id\":{\"S\":\" $OLD_SENDER_ID\"}}' --region \"$REGION\" --output json"

  if [ -n "$EXCLUSIVE_START_KEY" ]; then
    # Note: The key must be passed as a JSON string literal, hence the single   quotes.
    CMD="$CMD --exclusive-start-key '$EXCLUSIVE_START_KEY'"
  fi

  # Execute the scan command
  echo "Scanning for a batch of items..."
  SCAN_OUTPUT=$(eval $CMD)

  # Exit if the scan command fails
  if [ $? -ne 0 ]; then
    echo "ERROR: AWS CLI scan operation failed. Aborting."
    echo "$SCAN_OUTPUT"
    exit 1
  fi

  ITEMS=$(echo "$SCAN_OUTPUT" | jq -c '.Items[]')

  if [ -z "$ITEMS" ]; then
    echo "No more items with the old senderId were found."
    break
  fi

  # Loop through each item found in the scan and update it
  echo "$ITEMS" | while read -r item; do
    # Extract the primary key attributes (conversationId and timestamp) for the update command
    CONVERSATION_ID=$(echo "$item" | jq -r '.conversationId.S')
    TIMESTAMP=$(echo "$item" | jq -r '.timestamp.S')

    # Build the key for the update command
    ITEM_KEY="{\"conversationId\":{\"S\":\"$CONVERSATION_ID \"},\"timestamp\":{\"S\":\"$TIMESTAMP\"}}"

    # Execute the update command for the specific item
    aws dynamodb update-item \
      --table-name "$TABLE_NAME" \
      --key "$ITEM_KEY" \
      --update-expression "SET senderId = :new_id" \
      --expression-attribute-values "{\":new_id\":{\"S\":\"$NEW_SENDER_ID\"}}" 
      --region "$REGION" > /dev/null # Suppress stdout on success

    if [ $? -eq 0 ]; then
      UPDATED_COUNT=$((UPDATED_COUNT + 1))
      # Use carriage return to show a live-updating counter
      echo -ne "Items updated: $UPDATED_COUNT\r"
    else
      echo -e "\nERROR: Failed to update item with Key: $ITEM_KEY"
    fi
  done

  # Check if there are more items to scan (for pagination)
  EXCLUSIVE_START_KEY=$(echo "$SCAN_OUTPUT" | jq -c '.LastEvaluatedKey | select != null)')

  if [ -z "$EXCLUSIVE_START_KEY" ]; then
    # No more pages, the scan is complete
    break
  else
    echo -e "\nFound more items to process, fetching next page..."
    fi
  done
  
  echo -e "\n"
  echo "--- Migration Complete ---"
  echo "Total items updated: $UPDATED_COUNT"
  echo "--------------------------"