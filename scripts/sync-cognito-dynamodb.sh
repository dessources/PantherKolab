#!/bin/bash
 
 # ==============================================================================
 # PantherKolab User Sync Script
 # ==============================================================================
 # This script synchronizes users from an AWS Cognito User Pool to a DynamoDB
 # table. It checks for the existence of each user and creates a profile item
 # in DynamoDB if one does not already exist.
 #
    # Prerequisites:
    # - AWS CLI installed and configured (available by default in CloudShell).
    # - `jq` command-line JSON processor (available by default in CloudShell).
    # ==============================================================================
    
    # --- Configuration ---
    # IMPORTANT: Replace the placeholder value with your actual Cognito User Pool ID.
    # You can find this in your project's .env.local file or the AWS Console.
    USER_POOL_ID="us-east-1_4fWvgNvC3" # <--- REPLACE THIS VALUE
    TABLE_NAME="PantherKolab-Users-dev"
    REGION="us-east-1"
    
    
    # --- Do not edit below this line ---
    
    # Verify that USER_POOL_ID has been changed from the placeholder
    if [[ "$USER_POOL_ID" -eq "us-east-1_4fWvgNvC3" ]]; then
        echo "ERROR: Please replace the placeholder USER_POOL_ID in the script with your  actual Cognito User Pool ID."
        exit 1
    fi
    
    echo "Starting user sync from Cognito to DynamoDB..."
    echo "---------------------------------"
    echo "User Pool ID: $USER_POOL_ID"
    echo "Table Name:   $TABLE_NAME"
    echo "Region:       $REGION"
    echo "---------------------------------"
    
    
    # --- Main Sync Logic ---
    
    # Fetch all users from Cognito, process them one by one.
    # The `aws cognito-idp list-users` command retrieves the users.
    # The output is piped to `jq` to parse the JSON and process each user in a loop.
    aws cognito-idp list-users --user-pool-id "$USER_POOL_ID" --region "$REGION" --query  "Users[]" | \
    jq -c '.[]' | \
    while read -r user; do
        # --- 1. Parse user data from Cognito ---
        userId=$(echo "$user" | jq -r '.Username')
    
        # Helper function to safely extract attribute values
        getAttribute() {
            local attr_name="$1"
            echo "$user" | jq -r --arg name "$attr_name" '.Attributes[] | select(.Name ==    $name) | .Value'
        }
   
        email=$(getAttribute "email")
        firstName=$(getAttribute "given_name")
        lastName=$(getAttribute "family_name")
        emailVerifiedStr=$(getAttribute "email_verified")
   
        # Convert email_verified string ("true" or "false") to a boolean for DynamoDB       
        emailVerified=false
        if [ "$emailVerifiedStr" == "true" ]; then
            emailVerified=true
        fi
   
        # Provide default names if missing, and convert to lowercase for consistency        
        if [ -z "$firstName" ]; then firstName="User"; fi
        if [ -z "$lastName" ]; then lastName="Profile"; fi
   
        # Create and sanitize fullName
        fullName=$(echo "$firstName $lastName" | tr '[:upper:]' '[:lower:]' | xargs)        
   
   
        echo "Processing User: $userId ($email)"
   
        # --- 2. Check if user exists in DynamoDB ---
        # The `aws dynamodb get-item` command attempts to fetch the item.
        # We check if the 'Item' key in the JSON output is empty.
        existing_item=$(aws dynamodb get-item \
            --table-name "$TABLE_NAME" \
            --key "{\"userId\": {\"S\": \"$userId\"}}" \
            --region "$REGION")
   
        if [ -z "$(echo "$existing_item" | jq '.Item')" ]; then
            echo "  -> Status: NOT FOUND in DynamoDB. Creating new profile..."
   
            # --- 3. Construct the new item for DynamoDB ---
            now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Using a heredoc to build the JSON payload for the new item
          item_json=$(cat <<EOF
  {
      "userId": {"S": "$userId"},
      "email": {"S": "$email"},
      "firstName": {"S": "$(echo "$firstName" | tr '[:upper:]' '[:lower:]')"},
      "lastName": {"S": "$(echo "$lastName" | tr '[:upper:]' '[:lower:]')"},
      "fullName": {"S": "$fullName"},
      "emailVerified": {"BOOL": $emailVerified},
      "createdAt": {"S": "$now"},
      "updatedAt": {"S": "$now"},
      "major": {"S": "Undeclared"},
      "bio": {"NULL": true},
      "interests": {"L": []},
      "portfolioUrl": {"NULL": true},
      "profilePicture": {"NULL": true}
  }
EOF
  )
            # --- 4. Create the item in DynamoDB ---
            aws dynamodb put-item \
                --table-name "$TABLE_NAME" \
                --item "$item_json" \
                --region "$REGION"
   
            if [ $? -eq 0 ]; then
                echo "  -> Result: Successfully created profile for user $userId."
            else
                echo "  -> Result: ERROR! Failed to create profile for user $userId."       
            fi
        else
            echo "  -> Status: Already exists in DynamoDB. Skipping."
        fi
        echo "---------------------------------"
    done
   
    echo "Sync complete."