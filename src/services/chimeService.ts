import { v4 as uuidv4 } from 'uuid'
import {
  CreateMeetingCommand,
  DeleteMeetingCommand,
  CreateAttendeeCommand,
  Attendee as ChimeAttendee,
} from '@aws-sdk/client-chime-sdk-meetings'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

/**
 * marshall: Converts JavaScript objects into DynamoDB AttributeValue format
 * Example: { name: 'John', age: 30 } becomes { name: { S: 'John' }, age: { N: '30' } }
 *
 * unmarshall: Converts DynamoDB AttributeValue format back into JavaScript objects
 * Example: { name: { S: 'John' }, age: { N: '30' } } becomes { name: 'John', age: 30 }
 *
 * These are needed because DynamoDB stores data with explicit type indicators (S=String, N=Number, etc.)
 * while we work with plain JavaScript objects in our code.
 */
import {
  Meeting,
  MeetingSettings,
  CallSession,
  CallStatus,
  CallParticipant,
  ParticipantStatus,
  MeetingInvite,
  InviteStatus,
  MeetingAttendee,
  CreateMeetingInput,
  CreateCallSessionInput,
  TABLE_NAMES,
} from '@/types/database'
import { chimeClient } from '@/lib/chime/chimeConfig'

// Initialize DynamoDB client
const dynamodbClient = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
})

/**
 * Service for managing Chime meetings and call sessions
 */
class ChimeService {
  /**
   * Create a new meeting
   */
  async createMeeting(input: CreateMeetingInput): Promise<Meeting> {
    const meetingId = uuidv4()
    const now = new Date().toISOString()

    // Default settings if not provided
    const settings: MeetingSettings = {
      allowCamera: input.settings?.allowCamera ?? true,
      allowMicrophone: input.settings?.allowMicrophone ?? true,
      allowScreenShare: input.settings?.allowScreenShare ?? true,
      recordingEnabled: input.settings?.recordingEnabled ?? false,
      waitingRoomEnabled: input.settings?.waitingRoomEnabled ?? true,
    }

    // Create meeting record in DynamoDB
    const meeting: Meeting = {
      meetingId,
      chimeMeetingId: null,
      title: input.title,
      description: input.description || null,
      creatorId: input.creatorId,
      scheduledTime: input.scheduledTime,
      startTime: null,
      endTime: null,
      duration: null,
      status: 'SCHEDULED',
      accessType: input.accessType,
      invitedUserIds: input.invitedUserIds || [],
      conversationId: input.conversationId || null,
      maxAttendees: input.maxAttendees || 100,
      settings,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await dynamodbClient.send(
        new PutCommand({
          TableName: TABLE_NAMES.MEETINGS,
          Item: marshall(meeting),
        })
      )
    } catch (error) {
      throw new Error(`Failed to create meeting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return meeting
  }

  /**
   * Start a meeting (create Chime meeting and update status)
   */
  async startMeeting(meetingId: string): Promise<{ meeting: Meeting; chimeMeetingId: string }> {
    // Get meeting from DynamoDB
    const meeting = await this.getMeetingById(meetingId)
    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`)
    }

    if (meeting.status === 'ACTIVE') {
      return { meeting, chimeMeetingId: meeting.chimeMeetingId! }
    }

    // Create Chime meeting
    let chimeMeetingId: string
    try {
      const response = await chimeClient.send(
        new CreateMeetingCommand({
          ClientRequestToken: meetingId,
          MediaRegion: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
          ExternalMeetingId: meetingId,
        })
      )
      if (!response.Meeting?.MeetingId) {
        throw new Error('Failed to get Chime meeting ID')
      }
      chimeMeetingId = response.Meeting.MeetingId
    } catch (error) {
      throw new Error(`Failed to create Chime meeting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Update meeting status in DynamoDB
    const now = new Date().toISOString()
    try {
      await dynamodbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.MEETINGS,
          Key: marshall({ meetingId }),
          UpdateExpression: 'SET #status = :status, #chimeMeetingId = :chimeMeetingId, #startTime = :startTime, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#chimeMeetingId': 'chimeMeetingId',
            '#startTime': 'startTime',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': { S: 'ACTIVE' },
            ':chimeMeetingId': { S: chimeMeetingId },
            ':startTime': { S: now },
            ':updatedAt': { S: now },
          },
        })
      )
    } catch (error) {
      throw new Error(`Failed to update meeting status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      meeting: { ...meeting, status: 'ACTIVE', chimeMeetingId, startTime: now, updatedAt: now },
      chimeMeetingId,
    }
  }

  /**
   * End a meeting and cleanup Chime resources
   */
  async endMeeting(meetingId: string): Promise<void> {
    const meeting = await this.getMeetingById(meetingId)
    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`)
    }

    // Delete Chime meeting if it exists
    if (meeting.chimeMeetingId) {
      try {
        await chimeClient.send(
          new DeleteMeetingCommand({
            MeetingId: meeting.chimeMeetingId,
          })
        )
      } catch (error) {
        console.error(`Failed to delete Chime meeting: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Update meeting status in DynamoDB
    const now = new Date().toISOString()
    const startTime = meeting.startTime ? new Date(meeting.startTime).getTime() : 0
    const duration = startTime ? Math.floor((new Date().getTime() - startTime) / 1000) : null

    try {
      await dynamodbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.MEETINGS,
          Key: marshall({ meetingId }),
          UpdateExpression: 'SET #status = :status, #endTime = :endTime, #duration = :duration, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#endTime': 'endTime',
            '#duration': 'duration',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': { S: 'ENDED' },
            ':endTime': { S: now },
            ':duration': duration !== null ? { N: duration.toString() } : { NULL: true },
            ':updatedAt': { S: now },
          },
        })
      )
    } catch (error) {
      throw new Error(`Failed to end meeting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Cancel a meeting
   */
  async cancelMeeting(meetingId: string): Promise<void> {
    const meeting = await this.getMeetingById(meetingId)
    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`)
    }

    // Delete Chime meeting if it's active
    if (meeting.chimeMeetingId) {
      try {
        await chimeClient.send(
          new DeleteMeetingCommand({
            MeetingId: meeting.chimeMeetingId,
          })
        )
      } catch (error) {
        console.error(`Failed to delete Chime meeting: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Update status to CANCELLED
    const now = new Date().toISOString()
    try {
      await dynamodbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.MEETINGS,
          Key: marshall({ meetingId }),
          UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': { S: 'CANCELLED' },
            ':updatedAt': { S: now },
          },
        })
      )
    } catch (error) {
      throw new Error(`Failed to cancel meeting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get meeting by ID
   */
  async getMeetingById(meetingId: string): Promise<Meeting | null> {
    try {
      const response = await dynamodbClient.send(
        new GetCommand({
          TableName: TABLE_NAMES.MEETINGS,
          Key: marshall({ meetingId }),
        })
      )
      return response.Item ? (unmarshall(response.Item) as Meeting) : null
    } catch (error) {
      throw new Error(`Failed to get meeting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user's scheduled meetings (query by creatorId)
   */
  async getUserMeetings(creatorId: string): Promise<Meeting[]> {
    try {
      const response = await dynamodbClient.send(
        new QueryCommand({
          TableName: TABLE_NAMES.MEETINGS,
          IndexName: 'CreatorIndex',
          KeyConditionExpression: 'creatorId = :creatorId',
          ExpressionAttributeValues: {
            ':creatorId': { S: creatorId },
          },
        })
      )
      return response.Items ? response.Items.map((item) => unmarshall(item) as Meeting) : []
    } catch (error) {
      throw new Error(`Failed to get user meetings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate meeting access for a user
   */
  async validateMeetingAccess(meetingId: string, userId: string): Promise<boolean> {
    const meeting = await this.getMeetingById(meetingId)
    if (!meeting) {
      return false
    }

    // Public meetings are accessible to everyone
    if (meeting.accessType === 'PUBLIC') {
      return true
    }

    // Restricted meetings require invite or creator
    if (meeting.accessType === 'RESTRICTED') {
      return meeting.creatorId === userId || meeting.invitedUserIds.includes(userId)
    }

    // Conversation-based meetings require participant status (would need to check conversation)
    if (meeting.accessType === 'CONVERSATION') {
      return meeting.creatorId === userId || meeting.invitedUserIds.includes(userId)
    }

    return false
  }

  /**
   * Generate attendee token for joining a meeting
   */
  async generateAttendeeToken(meetingId: string, userId: string): Promise<{
    attendeeId: string
    joinToken: string
  }> {
    // Validate access
    const hasAccess = await this.validateMeetingAccess(meetingId, userId)
    if (!hasAccess) {
      throw new Error(`User ${userId} does not have access to meeting ${meetingId}`)
    }

    const meeting = await this.getMeetingById(meetingId)
    if (!meeting || !meeting.chimeMeetingId) {
      throw new Error(`Meeting not found or not started: ${meetingId}`)
    }

    // Create attendee in Chime
    let attendee: ChimeAttendee
    try {
      const response = await chimeClient.send(
        new CreateAttendeeCommand({
          MeetingId: meeting.chimeMeetingId,
          ExternalUserId: userId,
        })
      )
      attendee = response.Attendee!
    } catch (error) {
      throw new Error(`Failed to create attendee: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Create attendee record in DynamoDB
    const attendeeRecord: MeetingAttendee = {
      attendeeId: uuidv4(),
      meetingId,
      userId,
      chimeAttendeeId: attendee.AttendeeId!,
      joinedAt: new Date().toISOString(),
      leftAt: null,
      duration: null,
      wasInvited: meeting.invitedUserIds.includes(userId),
      createdAt: new Date().toISOString(),
    }

    try {
      await dynamodbClient.send(
        new PutCommand({
          TableName: TABLE_NAMES.MEETING_ATTENDEES,
          Item: marshall(attendeeRecord),
        })
      )
    } catch (error) {
      console.error(`Failed to create attendee record: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      attendeeId: attendee.AttendeeId!,
      joinToken: attendee.JoinToken!,
    }
  }

  /**
   * Create a call session (direct or group call)
   */
  async createCallSession(input: CreateCallSessionInput): Promise<CallSession> {
    const sessionId = uuidv4()
    const now = new Date().toISOString()

    // Create Chime meeting for the call
    let chimeMeetingId: string
    try {
      const response = await chimeClient.send(
        new CreateMeetingCommand({
          ClientRequestToken: sessionId,
          MediaRegion: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
          ExternalMeetingId: `call-${sessionId}`,
        })
      )
      if (!response.Meeting?.MeetingId) {
        throw new Error('Failed to get Chime meeting ID')
      }
      chimeMeetingId = response.Meeting.MeetingId
    } catch (error) {
      throw new Error(`Failed to create Chime meeting for call: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Initialize participants
    const participants: CallParticipant[] = input.participantIds.map((userId) => ({
      userId,
      joinedAt: userId === input.initiatorId ? now : null,
      leftAt: null,
      status: userId === input.initiatorId ? 'JOINED' : 'RINGING',
      chimeAttendeeId: null,
    }))

    // Create call session record
    const callSession: CallSession = {
      sessionId,
      timestamp: now,
      chimeMeetingId,
      callType: input.callType,
      conversationId: input.conversationId,
      initiatorId: input.initiatorId,
      participants,
      status: 'RINGING',
      startedAt: now,
      endedAt: null,
      duration: null,
      endReason: null,
      createdAt: now,
    }

    try {
      await dynamodbClient.send(
        new PutCommand({
          TableName: TABLE_NAMES.CALL_SESSIONS,
          Item: marshall(callSession),
        })
      )
    } catch (error) {
      throw new Error(`Failed to create call session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return callSession
  }

  /**
   * Update call session status
   */
  async updateCallSessionStatus(sessionId: string, status: CallStatus, endReason?: string): Promise<void> {
    const now = new Date().toISOString()

    try {
      await dynamodbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.CALL_SESSIONS,
          Key: marshall({ sessionId, timestamp: now }),
          UpdateExpression: 'SET #status = :status' + (endReason ? ', #endReason = :endReason' : '') + ', #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            ...(endReason && { '#endReason': 'endReason' }),
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': { S: status },
            ...(endReason && { ':endReason': { S: endReason } }),
            ':updatedAt': { S: now },
          },
        })
      )
    } catch (error) {
      throw new Error(`Failed to update call session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update participant status in a call
   */
  async updateParticipantStatus(
    sessionId: string,
    timestamp: string,
    userId: string,
    status: string,
    chimeAttendeeId?: string
  ): Promise<void> {
    try {
      const response = await dynamodbClient.send(
        new GetCommand({
          TableName: TABLE_NAMES.CALL_SESSIONS,
          Key: marshall({ sessionId, timestamp }),
        })
      )

      if (!response.Item) {
        throw new Error(`Call session not found: ${sessionId}`)
      }

      const callSession = unmarshall(response.Item) as CallSession
      const participants = callSession.participants.map((p) => {
        if (p.userId === userId) {
          const now = new Date().toISOString()
          return {
            ...p,
            status: status as ParticipantStatus,
            joinedAt: status === 'JOINED' && !p.joinedAt ? now : p.joinedAt,
            leftAt: status === 'LEFT' && !p.leftAt ? now : p.leftAt,
            chimeAttendeeId: chimeAttendeeId || p.chimeAttendeeId,
          }
        }
        return p
      })

      const now = new Date().toISOString()
      await dynamodbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.CALL_SESSIONS,
          Key: marshall({ sessionId, timestamp }),
          UpdateExpression: 'SET participants = :participants, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':participants': { L: participants.map((p) => ({ M: marshall(p) })) },
            ':updatedAt': { S: now },
          },
        })
      )
    } catch (error) {
      throw new Error(`Failed to update participant status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * End a call session
   */
  async endCallSession(sessionId: string, timestamp: string, endReason: string): Promise<void> {
    const callSession = await this.getCallSessionById(sessionId, timestamp)
    if (!callSession) {
      throw new Error(`Call session not found: ${sessionId}`)
    }

    // Delete Chime meeting
    if (callSession.chimeMeetingId) {
      try {
        await chimeClient.send(
          new DeleteMeetingCommand({
            MeetingId: callSession.chimeMeetingId,
          })
        )
      } catch (error) {
        console.error(`Failed to delete Chime meeting: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Calculate duration
    const startTime = new Date(callSession.startedAt).getTime()
    const now = new Date().getTime()
    const duration = Math.floor((now - startTime) / 1000)

    // Update call session
    const nowStr = new Date().toISOString()
    try {
      await dynamodbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.CALL_SESSIONS,
          Key: marshall({ sessionId, timestamp: callSession.timestamp }),
          UpdateExpression: 'SET #status = :status, #endedAt = :endedAt, #duration = :duration, #endReason = :endReason',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#endedAt': 'endedAt',
            '#duration': 'duration',
            '#endReason': 'endReason',
          },
          ExpressionAttributeValues: {
            ':status': { S: 'ENDED' },
            ':endedAt': { S: nowStr },
            ':duration': { N: duration.toString() },
            ':endReason': { S: endReason },
          },
        })
      )
    } catch (error) {
      throw new Error(`Failed to end call session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get call session by ID
   */
  async getCallSessionById(sessionId: string, timestamp: string): Promise<CallSession | null> {
    try {
      const response = await dynamodbClient.send(
        new GetCommand({
          TableName: TABLE_NAMES.CALL_SESSIONS,
          Key: marshall({ sessionId, timestamp }),
        })
      )
      return response.Item ? (unmarshall(response.Item) as CallSession) : null
    } catch (error) {
      throw new Error(`Failed to get call session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a meeting invite
   */
  async createMeetingInvite(meetingId: string, inviteeId: string, invitedBy: string, message?: string): Promise<MeetingInvite> {
    const inviteId = uuidv4()
    const now = new Date().toISOString()

    const invite: MeetingInvite = {
      inviteId,
      meetingId,
      inviteeId,
      invitedBy,
      status: 'PENDING',
      sentAt: now,
      respondedAt: null,
      message: message || null,
      createdAt: now,
    }

    try {
      await dynamodbClient.send(
        new PutCommand({
          TableName: TABLE_NAMES.MEETING_INVITES,
          Item: marshall(invite),
        })
      )
    } catch (error) {
      throw new Error(`Failed to create invite: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return invite
  }

  /**
   * Update meeting invite status
   */
  async updateInviteStatus(inviteId: string, status: InviteStatus): Promise<void> {
    const now = new Date().toISOString()

    try {
      await dynamodbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.MEETING_INVITES,
          Key: marshall({ inviteId }),
          UpdateExpression: 'SET #status = :status, #respondedAt = :respondedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#respondedAt': 'respondedAt',
          },
          ExpressionAttributeValues: {
            ':status': { S: status },
            ':respondedAt': { S: now },
          },
        })
      )
    } catch (error) {
      throw new Error(`Failed to update invite: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Record attendee leaving a meeting
   */
  async recordAttendeeLeft(attendeeId: string, meetingId: string, userId: string): Promise<void> {
    const now = new Date().toISOString()
    const joinedAtItem = await dynamodbClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.MEETING_ATTENDEES,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'userId = :userId AND meetingId = :meetingId',
        ExpressionAttributeValues: {
          ':userId': { S: userId },
          ':meetingId': { S: meetingId },
        },
      })
    )

    if (!joinedAtItem.Items || joinedAtItem.Items.length === 0) {
      throw new Error(`Attendee record not found`)
    }

    const attendeeRecord = unmarshall(joinedAtItem.Items[0]) as MeetingAttendee
    const joinedAt = new Date(attendeeRecord.joinedAt).getTime()
    const duration = Math.floor((new Date(now).getTime() - joinedAt) / 1000)

    try {
      await dynamodbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.MEETING_ATTENDEES,
          Key: marshall({ attendeeId }),
          UpdateExpression: 'SET #leftAt = :leftAt, #duration = :duration',
          ExpressionAttributeNames: {
            '#leftAt': 'leftAt',
            '#duration': 'duration',
          },
          ExpressionAttributeValues: {
            ':leftAt': { S: now },
            ':duration': { N: duration.toString() },
          },
        })
      )
    } catch (error) {
      throw new Error(`Failed to record attendee left: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Export singleton instance
export const chimeService = new ChimeService()