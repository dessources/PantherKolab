import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Lazy initialization to ensure env vars are loaded
let dynamoDbInstance: DynamoDBDocumentClient | null = null;

export const getDynamoDb = (): DynamoDBDocumentClient => {
  if (!dynamoDbInstance) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
      },
    });
    dynamoDbInstance = DynamoDBDocumentClient.from(client);
  }
  return dynamoDbInstance;
};

// For backward compatibility
export const dynamoDb = new Proxy({} as DynamoDBDocumentClient, {
  get(_target, prop) {
    return getDynamoDb()[prop as keyof DynamoDBDocumentClient];
  },
});
