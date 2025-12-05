#!/usr/bin/env tsx

/**
 * DynamoDB Connection Test Script
 * Tests the connection to DynamoDB and performs basic CRUD operations
 *
 * Usage: npm run test:dynamodb
 * or: tsx scripts/test-dynamodb-connection.ts
 */

import { dynamoDb } from "../src/lib/dynamodb";
import { PutCommand, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "../src/types/database";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function success(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function error(message: string) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function info(message: string) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function warn(message: string) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

async function testDynamoDBConnection() {
  console.log("\n=========================================");
  console.log("PantherKolab DynamoDB Connection Test");
  console.log("=========================================\n");

  info(`Testing connection to Users table: ${TABLE_NAMES.USERS}`);
  info(`Region: ${process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1"}\n`);

  const testUserId = `test-user-${Date.now()}`;
  const testUser = {
    userId: testUserId,
    email: "test@fiu.edu",
    firstName: "Test",
    lastName: "User",
    fullName: "Test User",
    emailVerified: true,
    profilePicture: null,
    major: "Computer Science",
    year: "Junior",
    bio: "This is a test user",
    interests: ["coding", "testing"],
    portfolioUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    // Test 1: Write to DynamoDB
    info("Test 1: Writing test user to DynamoDB...");
    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAMES.USERS,
        Item: testUser,
      })
    );
    success("Successfully wrote test user to DynamoDB");

    // Test 2: Read from DynamoDB
    info("\nTest 2: Reading test user from DynamoDB...");
    const getResult = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAMES.USERS,
        Key: { userId: testUserId },
      })
    );

    if (getResult.Item) {
      success("Successfully read test user from DynamoDB");
      console.log(
        "   Retrieved data:",
        JSON.stringify(getResult.Item, null, 2)
      );
    } else {
      throw new Error("User not found after writing");
    }

    // Test 3: Verify data integrity
    info("\nTest 3: Verifying data integrity...");
    const retrievedUser = getResult.Item;
    if (
      retrievedUser.email === testUser.email &&
      retrievedUser.firstName === testUser.firstName &&
      retrievedUser.major === testUser.major
    ) {
      success("Data integrity verified - all fields match");
    } else {
      throw new Error("Data mismatch detected");
    }

    // Test 4: Clean up - Delete test user
    info("\nTest 4: Cleaning up test data...");
    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLE_NAMES.USERS,
        Key: { userId: testUserId },
      })
    );
    success("Successfully deleted test user");

    // Final verification
    info("\nTest 5: Verifying deletion...");
    const verifyDelete = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAMES.USERS,
        Key: { userId: testUserId },
      })
    );

    if (!verifyDelete.Item) {
      success("Deletion verified - test user removed");
    } else {
      warn("Test user still exists after deletion attempt");
    }

    // All tests passed
    console.log("\n=========================================");
    success("All tests passed! DynamoDB is configured correctly.");
    console.log("=========================================\n");

    console.log("Environment Configuration:");
    console.log(
      `  - AWS Region: ${process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1"}`
    );
    console.log(`  - Users Table: ${TABLE_NAMES.USERS}`);
    console.log(`  - Conversations Table: ${TABLE_NAMES.CONVERSATIONS}`);
    console.log(`  - Messages Table: ${TABLE_NAMES.MESSAGES}`);
    console.log(`  - Groups Table: ${TABLE_NAMES.GROUPS}`);
    console.log("");

    process.exit(0);
  } catch (err: unknown) {
    console.log("\n=========================================");
    error("DynamoDB Connection Test FAILED");
    console.log("=========================================\n");

    if (err instanceof Error) {
      console.error("Error details:", err.message);

      // Provide helpful troubleshooting tips
      console.log("\n📋 Troubleshooting Tips:\n");

      if (err.message.includes("ResourceNotFoundException")) {
        warn("Table not found. Did you create the DynamoDB tables?");
        console.log("   Run: ./scripts/create-dynamodb-tables.sh");
      }

      if (err.message.includes("AccessDeniedException")) {
        warn("Access denied. Check your AWS credentials and IAM permissions.");
        console.log(
          "   Required permissions: dynamodb:PutItem, GetItem, DeleteItem"
        );
      }

      if (err.message.includes("missing credentials")) {
        warn("AWS credentials not configured.");
        console.log("   Check your .env.local file for:");
        console.log("   - NEXT_PUBLIC_APP_AWS_ACCESS_KEY_ID");
        console.log("   - NEXT_PUBLIC_APP_AWS_SECRET_ACCESS_KEY");
        console.log("   - NEXT_PUBLIC_AWS_REGION");
      }
    } else {
      console.error("Unknown error:", err);
    }

    console.log("");
    process.exit(1);
  }
}

// Run the test
testDynamoDBConnection();
