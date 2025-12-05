#!/usr/bin/env python3
"""
import-messages-to-dynamodb.py

Imports test messages from CSV file to DynamoDB Messages table.
This script populates a conversation with 100 realistic messages for testing the AI summary feature.

Usage:
    python3 import-messages-to-dynamodb.py

Requirements:
    pip install boto3
"""

import boto3
import csv
import json
from decimal import Decimal

# Configuration
TABLE_NAME = "Messages"
REGION = "us-east-1"
CSV_FILE = "test-messages.csv"

def convert_to_dynamodb_item(row):
    """
    Convert CSV row to DynamoDB item format.
    Handles proper type conversion for DynamoDB.
    """
    item = {
        'conversationId': {'S': row['conversationId']},
        'timestamp': {'S': row['timestamp']},
        'messageId': {'S': row['messageId']},
        'senderId': {'S': row['senderId']},
        'type': {'S': row['type']},
        'content': {'S': row['content']},
        'createdAt': {'S': row['createdAt']},
        'deleted': {'BOOL': row['deleted'].lower() == 'true'},
        'readBy': {'L': []},  # Empty list
        'reactions': {'M': {}},  # Empty map
    }

    # Optional fields - only add if not empty
    if row.get('replyTo') and row['replyTo'].strip():
        item['replyTo'] = {'S': row['replyTo']}
    if row.get('duration') and row['duration'].strip():
        item['duration'] = {'N': row['duration']}
    if row.get('fileName') and row['fileName'].strip():
        item['fileName'] = {'S': row['fileName']}
    if row.get('fileSize') and row['fileSize'].strip():
        item['fileSize'] = {'N': row['fileSize']}
    if row.get('mediaUrl') and row['mediaUrl'].strip():
        item['mediaUrl'] = {'S': row['mediaUrl']}

    return item

def main():
    print(f"Starting import of messages to DynamoDB table: {TABLE_NAME}")
    print(f"Region: {REGION}")
    print(f"CSV file: {CSV_FILE}")
    print("")

    # Initialize DynamoDB client
    dynamodb = boto3.client('dynamodb', region_name=REGION)

    # Read CSV and import messages
    imported_count = 0
    failed_count = 0

    try:
        with open(CSV_FILE, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)

            for row in csv_reader:
                try:
                    # Convert to DynamoDB item
                    item = convert_to_dynamodb_item(row)

                    # Insert into DynamoDB
                    dynamodb.put_item(
                        TableName=TABLE_NAME,
                        Item=item
                    )

                    imported_count += 1
                    print(f"✓ Imported message {row['messageId']} ({imported_count}/100)")

                except Exception as e:
                    failed_count += 1
                    print(f"✗ Failed to import message {row['messageId']}: {str(e)}")

        print("")
        print("=" * 60)
        print("Import Summary:")
        print(f"  Successfully imported: {imported_count} messages")
        print(f"  Failed: {failed_count} messages")
        print(f"  Total: {imported_count + failed_count} messages")
        print("=" * 60)
        print("")

        if imported_count == 100:
            print("✅ All 100 messages imported successfully!")
            print("")
            print("Next steps:")
            print("  1. Log in as user: d4e884c8-5011-70f3-e29a-5f29eb210c38")
            print("  2. Open conversation: ee4f1426-5f14-4f3d-b01a-216f8805306a")
            print("  3. Test the AI summary feature!")
        else:
            print("⚠️  Some messages failed to import. Check errors above.")

    except FileNotFoundError:
        print(f"Error: CSV file '{CSV_FILE}' not found!")
        print("Make sure the CSV file is in the same directory as this script.")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
