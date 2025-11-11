// services/userService.ts
import { dynamoDb } from "../lib/dynamodb"
import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import {
  CreateUserInput,
  UpdateUserInput,
  TABLE_NAMES,
  INDEX_NAMES,
  AcademicYear
} from "../types/database"
import { UserProfile } from "@/types/UserProfile"

const TABLE_NAME = TABLE_NAMES.USERS


export const userService = {
  // Create user profile
  async createUser(userData: CreateUserInput): Promise<UserProfile> {
    const now = new Date().toISOString()

    const userProfile: UserProfile = {
      userId: userData.userId,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      fullName: `${userData.firstName} ${userData.lastName}`.trim(),
      emailVerified: false,
      profilePicture: null,
      major: 'Undeclared',
      bio: null,
      interests: [],
      portfolioUrl: null,
      createdAt: now,
      updatedAt: now,
    }

    const params = {
      TableName: TABLE_NAME,
      Item: userProfile,
      // Prevent overwriting existing user
      ConditionExpression: 'attribute_not_exists(userId)'
    }

    try {
      await dynamoDb.send(new PutCommand(params))
      return userProfile
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ConditionalCheckFailedException') {
        throw new Error('User already exists')
      }
      throw error
    }
  },

  // Get user profile by userId
  async getUser(userId: string): Promise<UserProfile | null> {
    const params = {
      TableName: TABLE_NAME,
      Key: { userId },
    }

    const result = await dynamoDb.send(new GetCommand(params))
    return result.Item ? (result.Item as UserProfile) : null
  },

  // Get user by email (using EmailIndex GSI)
  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const params = {
      TableName: TABLE_NAME,
      IndexName: INDEX_NAMES.USERS.EMAIL,
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email.toLowerCase()
      },
      Limit: 1
    }

    const result = await dynamoDb.send(new QueryCommand(params))
    return result.Items && result.Items.length > 0 ? (result.Items[0] as UserProfile) : null
  },

  // Update user profile
  async updateUser(userId: string, updates: UpdateUserInput): Promise<UserProfile> {
    const updateExpression: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, unknown> = {}

    // Build update expression dynamically
    let index = 0
    Object.keys(updates).forEach((key) => {
      if (key !== 'userId' && key !== 'email' && key !== 'createdAt') {
        updateExpression.push(`#attr${index} = :val${index}`)
        expressionAttributeNames[`#attr${index}`] = key
        expressionAttributeValues[`:val${index}`] = updates[key as keyof UpdateUserInput]
        index++
      }
    })

    // Always update updatedAt
    updateExpression.push(`#updatedAt = :updatedAt`)
    expressionAttributeNames['#updatedAt'] = 'updatedAt'
    expressionAttributeValues[':updatedAt'] = new Date().toISOString()

    if (updateExpression.length === 1) {
      throw new Error('No valid fields to update')
    }

    const params = {
      TableName: TABLE_NAME,
      Key: { userId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW' as const,
      ConditionExpression: 'attribute_exists(userId)' // Ensure user exists
    }

    try {
      const result = await dynamoDb.send(new UpdateCommand(params))
      return result.Attributes as UserProfile
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ConditionalCheckFailedException') {
        throw new Error('User not found')
      }
      throw error
    }
  },

  // Check if user exists
  async userExists(userId: string): Promise<boolean> {
    const user = await this.getUser(userId)
    return user !== null
  },

  // Get users by major and year (using MajorIndex GSI)
  async getUsersByMajorAndYear(major: string, year?: AcademicYear): Promise<UserProfile[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      TableName: TABLE_NAME,
      IndexName: INDEX_NAMES.USERS.MAJOR,
      KeyConditionExpression: year
        ? 'major = :major AND #year = :year'
        : 'major = :major',
      ExpressionAttributeValues: year
        ? { ':major': major, ':year': year }
        : { ':major': major }
    }

    if (year) {
      params.ExpressionAttributeNames = { '#year': 'year' }
    }

    const result = await dynamoDb.send(new QueryCommand(params))
    return (result.Items || []) as UserProfile[]
  },

  // Mark email as verified
  async verifyEmail(userId: string): Promise<UserProfile> {
    return this.updateUser(userId, { emailVerified: true })
  },
}