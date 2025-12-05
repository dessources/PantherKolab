#!/usr/bin/env python3
"""
update-sender-id.py

Updates all messages in DynamoDB Messages table with a specific senderId
to a new senderId value.

Usage:
    python3 update-sender-id.py

Requirements:
    pip install boto3
"""

import boto3
from botocore.exceptions import ClientError

# Configuration
TABLE_NAME = "PantherKolab-Messages-dev"
REGION = "us-east-1"
OLD_SENDER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
NEW_SENDER_ID = "44e88408-8091-7022-99dc-c9b9b9d1d4af"

def update_sender_ids():
    """
    Scan the Messages table and update all messages with the old senderId
    to use the new senderId.
    """
    print(f"Updating sender IDs in DynamoDB table: {TABLE_NAME}")
    print(f"Region: {REGION}")
    print(f"Old sender ID: {OLD_SENDER_ID}")
    print(f"New sender ID: {NEW_SENDER_ID}")
    print("")

    # Initialize DynamoDB client
    dynamodb = boto3.client('dynamodb', region_name=REGION)

    updated_count = 0
    scanned_count = 0
    error_count = 0

    try:
        # Scan parameters
        scan_kwargs = {
            'TableName': TABLE_NAME,
            'FilterExpression': 'senderId = :old_sender',
            'ExpressionAttributeValues': {
                ':old_sender': {'S': OLD_SENDER_ID}
            }
        }

        print("Scanning table for messages to update...")
        print("")

        # Scan the table (handles pagination automatically)
        while True:
            response = dynamodb.scan(**scan_kwargs)
            items = response.get('Items', [])
            scanned_count += len(items)

            # Update each item
            for item in items:
                try:
                    conversation_id = item['conversationId']['S']
                    timestamp = item['timestamp']['S']

                    # Update the senderId
                    update_response = dynamodb.update_item(
                        TableName=TABLE_NAME,
                        Key={
                            'conversationId': {'S': conversation_id},
                            'timestamp': {'S': timestamp}
                        },
                        UpdateExpression='SET senderId = :new_sender',
                        ExpressionAttributeValues={
                            ':new_sender': {'S': NEW_SENDER_ID}
                        },
                        ReturnValues='UPDATED_NEW'
                    )

                    updated_count += 1
                    message_id = item.get('messageId', {}).get('S', 'unknown')
                    print(f"✓ Updated message {message_id} in conversation {conversation_id}")

                except ClientError as e:
                    error_count += 1
                    print(f"✗ Error updating message: {e.response['Error']['Message']}")
                except Exception as e:
                    error_count += 1
                    print(f"✗ Unexpected error: {str(e)}")

            # Check if there are more items to scan
            if 'LastEvaluatedKey' not in response:
                break

            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']

        print("")
        print("=" * 60)
        print("Update Summary:")
        print(f"  Messages scanned: {scanned_count}")
        print(f"  Successfully updated: {updated_count}")
        print(f"  Errors: {error_count}")
        print("=" * 60)
        print("")

        if updated_count > 0:
            print(f"✅ Successfully updated {updated_count} message(s)!")
        else:
            print("⚠️  No messages found with the old sender ID.")

    except ClientError as e:
        print(f"Error accessing DynamoDB: {e.response['Error']['Message']}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")

if __name__ == "__main__":
    # Confirm before proceeding
    print("=" * 60)
    print("DynamoDB Sender ID Update Script")
    print("=" * 60)
    print("")
    print(f"This script will update ALL messages in table '{TABLE_NAME}'")
    print(f"from sender ID: {OLD_SENDER_ID}")
    print(f"to sender ID: {NEW_SENDER_ID}")
    print("")

    response = input("Do you want to proceed? (yes/no): ").strip().lower()

    if response == 'yes':
        print("")
        update_sender_ids()
    else:
        print("Operation cancelled.")
