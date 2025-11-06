# PantherKolab - FIU Student Collaboration Platform

## Project Context

Kolab is an innovative, student-centric communication and collaboration platform being built as part of the INIT Build Program at Florida International University (FIU). This is a 9-week team project designed to revolutionize how college students collaborate, study, and communicate on campus.

**Project Duration:** 9 weeks (Fall 2025)  
**Team Size:** 5-7 members with varying skill levels (from beginners to experienced developers)  
**Target Users:** FIU students, with potential campus-wide deployment

This is not just another chat app—it's a comprehensive platform that combines the best features of Discord, WhatsApp, Notion, and Canvas, specifically tailored for academic collaboration.

## Core Goals

### Primary Objectives:

1. **Real-time Communication:** Seamless text, audio, and video messaging between students
2. **Academic Collaboration:** Live whiteboards, project management, and study session coordination
3. **AI-Powered Assistance:** Conversation summaries for missed discussions and smart group suggestions
4. **Student Empowerment:** Personal branding through portfolio pages and bio sections
5. **FIU-Exclusive Access:** Email-based authentication restricted to @fiu.edu addresses only

### Success Criteria:

- ✅ All core features functional and polished
- ✅ 95%+ uptime during demo period
- ✅ Sub-2s page load times
- ✅ Zero security vulnerabilities
- ✅ Comprehensive documentation
- ✅ Each team member has significant commits and features shipped

## Features Breakdown

### Core Features (MVP - Must Have):

- **Messaging System:**

  - Real-time text messaging
  - Audio messages (voice notes)
  - Media files and document sharing
  - Group chats with role-based permissions

- **Communication:**

  - Audio calls
  - Video calls
  - Screen sharing capabilities

- **Collaboration Tools:**

  - Live virtual whiteboards for study sessions
  - Polls and voting
  - Project management (tasks, deadlines, assignments)

- **AI Features:**

  - Conversation summarization for missed messages
  - Automatic group chat suggestions based on enrolled classes
  - Smart study buddy matching

- **User Features:**
  - Personal branding (bio, portfolio page)
  - FIU email-only authentication
  - User profiles with academic information

### Stretch Features (Nice to Have):

- Campus-specific integrations (FIU Canvas, library resources)
- Location-aware features (building-based groups, study space availability)
- Academic calendar integration
- Advanced analytics and insights

## Tech Stack

### Frontend:

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (optional), custom components
- **State Management:** React Context API / Zustand (for complex state)
- **Real-time Communication:** Socket.IO client for live notifications and event handling

### Backend:

- **API:** Next.js API Routes with REST endpoints
- **Authentication:** AWS Cognito (email/password with email verification)
- **Real-time Communication:** Socket.IO for real-time notifications and event broadcasting
- **Serverless Functions:** AWS Lambda (for business logic, email triggers, AI summaries)

### Database & Storage:

- **Primary Database:** Amazon DynamoDB (NoSQL for fast, scalable storage)
- **File Storage:** Amazon S3 (media files, documents, audio messages, profile pictures)
- **CDN:** Amazon CloudFront (fast global content delivery)
- **Caching:** Amazon ElastiCache Redis (optional, for active conversations)

### AI & Media Processing:

- **AI/LLM:** Amazon Bedrock (Claude) or OpenAI API for conversation summaries
- **Audio/Video Calls:**
  - **AWS Chime SDK v3.29.0** ✅ IMPLEMENTED
    - WebRTC peer-to-peer connections
    - Meeting lifecycle management
    - Attendee management and tokens
    - Video tile APIs for remote participant rendering
    - Audio device enumeration and control
  - Alternative: Agora.io (for comparison)
- **Media Processing:** AWS Lambda for thumbnail generation, AWS Transcribe for audio-to-text

### DevOps & Deployment:

- **Hosting:** AWS Amplify (full-stack deployment) or Vercel
- **Version Control:** Git + GitHub (public repository)
- **CI/CD:** GitHub Actions or AWS Amplify CI/CD
- **Monitoring:** Amazon CloudWatch, AWS X-Ray (distributed tracing)
- **Environment Management:** AWS Secrets Manager, .env.local files

### Development Tools:

- **Package Manager:** npm or pnpm
- **Code Quality:** ESLint, Prettier
- **Type Checking:** TypeScript strict mode
- **Testing:** Jest, React Testing Library (to be added)
- **API Testing:** Postman, cURL, or REST client tools

## Project Structure

```
kolab/
├── frontend/                 # Next.js application
│   ├── app/                 # Next.js 14 App Router
│   │   ├── (auth)/         # Authentication routes
│   │   ├── (dashboard)/    # Main app routes
│   │   ├── api/            # API routes (if needed)
│   │   └── layout.tsx      # Root layout
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components
│   │   ├── chat/           # Chat-specific components
│   │   ├── whiteboard/     # Whiteboard components
│   │   └── portfolio/      # Portfolio page components
│   ├── lib/                # Utility functions and configuration
│   │   ├── parameterStore.ts
│   │   ├── dynamodb/
│   │   ├── chime/
│   │   ├── socket.ts
│   │   └── utils.ts
│   ├── public/             # Static assets
│   └── styles/             # Global styles
├── backend/                 # AWS Lambda functions and triggers
│   ├── triggers/           # Cognito triggers (email validation, etc.)
│   └── utils/              # Shared utilities
├── docs/                   # Documentation
│   ├── architecture.md
│   ├── api-documentation.md
│   └── setup-guide.md
├── scripts/                # Utility scripts
│   ├── cleanup-calls.ts    # Call session cleanup script
│   └── cleanup-calls-cloudshell.sh
└── README.md
```

## Architecture Overview

### Data Flow for Real-time Messaging:

1. **User sends message** → Next.js client sends message to API route
2. **API route processes message** → Stores message in DynamoDB
3. **Socket.IO broadcasts update** → Sends message to all connected clients in chat room
4. **Clients receive update** → React components update UI automatically via Socket.IO event listener

### Authentication Flow:

1. **User signs up with email** → Cognito validates email format ends with @fiu.edu
2. **Verification email sent** → User receives confirmation code
3. **User confirms email** → Account activated
4. **User logs in** → JWT tokens issued to client
5. **Client authenticated** → All API requests include JWT tokens in Authorization header

**Email Restriction Implementation:**

- Cognito Pre Sign-up Lambda Trigger validates email domain
- Only @fiu.edu emails allowed to create accounts
- Non-FIU emails rejected immediately with clear error message

### AI Summarization Flow:

1. **User requests summary** → Client calls API endpoint to trigger summarization
2. **API route initiates Lambda** → Invokes AWS Lambda for background processing
3. **Lambda fetches messages** → Queries DynamoDB for conversation history
4. **Lambda calls AI service** → Sends messages to Bedrock/OpenAI API
5. **AI generates summary** → Returns formatted summary
6. **Summary stored & delivered** → Saved to DynamoDB, sent to client via Socket.IO or API response

## Important Considerations

### Security:

- **NEVER commit credentials:** Use .env.local and AWS Secrets Manager
- **Use IAM roles properly:** Least privilege access for all AWS resources
- **Validate on backend:** Never trust client-side validation alone
- **Rate limiting:** Implement to prevent abuse (API Gateway throttling)
- **Email domain restriction:** Only allow @fiu.edu email addresses (Cognito Pre Sign-up trigger)
- **Input sanitization:** Prevent XSS and injection attacks
- **HTTPS only:** Enforce secure connections

### Performance:

- **Optimize images:** Use Next.js Image component with CloudFront
- **Lazy load components:** Split code for faster initial load
- **Pagination:** Don't load entire message history at once
- **WebSocket connection management:** Handle reconnections gracefully
- **DynamoDB indexes:** Design GSIs for efficient queries
- **Code splitting:** Dynamic imports for heavy components
- **Cache strategies:** Leverage CDN and browser caching

### Scalability:

- **Next.js API Routes:** Auto-scale on AWS infrastructure (serverless)
- **DynamoDB on-demand:** Pay only for what you use
- **Socket.IO:** Horizontal scaling possible with Redis adapter
- **S3 + CloudFront:** Handles media delivery at any scale
- **Lambda concurrency:** Consider reserved concurrency for critical functions

### Team Collaboration:

- **Git workflow:** Feature branches → PR → Code review → Merge
- **Commit conventions:** Use conventional commits (feat:, fix:, docs:, etc.)
- **Code reviews:** Required for all PRs, focus on learning
- **Pair programming:** Schedule sessions for complex features and mentoring
- **Documentation:** Keep README, API docs, and architecture diagrams updated

### Development Workflow:

- **Local development:** Use AWS Amplify mock/sandbox for testing
- **Staging environment:** Separate AWS environment for testing
- **Feature flags:** Use for incomplete features in production
- **Rollback plan:** Keep previous deployments accessible

### Environment Variables & AWS Credentials:

**Required `.env.local` Variables:**

```env
# AWS Credentials
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
NEXT_PUBLIC_AWS_REGION=us-east-1

# Cognito Configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxx

# DynamoDB Tables
DYNAMODB_CALL_SESSIONS_TABLE=PantherKolab-CallSessions-dev
DYNAMODB_MEETINGS_TABLE=PantherKolab-Meetings-dev

# AWS Chime Configuration
# (Handled automatically via Chime SDK)
```

**IMPORTANT:** Never commit `.env.local` to version control. Use AWS Secrets Manager for production.

---

### Cost Management (AWS Free Tier):

- **Cognito:** 50,000 MAUs free
- **DynamoDB:** 25 GB storage, 25 read/write units free
- **Lambda:** 1 million requests, 400,000 GB-seconds free
- **S3:** 5 GB storage, 20,000 GET requests free
- **Parameter Store:** Free tier includes 10 parameters
- **AWS Chime SDK:**
  - **NO free tier - pay-as-you-go**
  - Charged by attendee-minute (active participants in meetings)
  - Minimum charge: ~$0.006 per attendee-minute (~$0.36/hour per person)
  - IMPORTANT: Orphaned meetings that aren't deleted continue to accrue charges!

**⚠️ AWS Chime Billing Warning:**

- Always call `DeleteMeetingCommand` when ending calls
- Monitor for RINGING calls stuck in DynamoDB without being ended
- Use cleanup scripts to terminate orphaned sessions
- Set up CloudWatch alarms for unexpected Chime SDK costs

**Monitoring:** Set up AWS Budgets alerts to avoid unexpected charges!

### Testing Strategy:

- **Unit tests:** For utility functions and business logic
- **Integration tests:** For API routes and Lambda functions
- **E2E tests:** For critical user flows (auth, messaging)
- **Manual testing:** Test on real devices, different browsers

### Accessibility:

- **Keyboard navigation:** All features accessible via keyboard
- **Screen reader support:** Proper ARIA labels
- **Color contrast:** Meet WCAG 2.1 AA standards (already designed in FIU colors)
- **Alt text:** For all images and media

## Development Phases

### Phase 1: Foundation (Weeks 1-2)

- Set up development environment
- Configure AWS services (Cognito, DynamoDB, Chime)
- Basic Next.js app structure with API routes
- Authentication with FIU email restriction (Cognito Pre Sign-up Lambda trigger)
- Socket.IO setup for real-time communication
- Team onboarding and skill building

### Phase 2: Core Messaging (Weeks 3-4)

- Real-time text messaging
- Group creation and management
- Message history and pagination
- Read receipts and typing indicators
- File upload to S3

### Phase 3: Rich Media & Communication (Weeks 5-6)

- Voice notes (audio messages)
- Image/video sharing
- **Audio/video calls integration** ✅ IN PROGRESS
  - AWS Chime SDK v3.29.0 integration
  - ChimeManager singleton with observer pattern
  - Call session management (RINGING, ACTIVE, ENDED states)
  - Direct and group call support
  - Video tile binding and device enumeration
  - Attendee token generation and meeting lifecycle
- Media optimization and CDN setup

### Phase 4: Collaboration & AI (Weeks 7-8)

- Live whiteboard implementation
- Polls and voting
- Project management features
- Conversation summarization
- Smart group suggestions

### Phase 5: Polish & Demo Prep (Week 9)

- UI/UX refinements
- Performance optimization
- Security audit
- Documentation completion
- Demo preparation and rehearsal

## Current Implementation Status

### Audio/Video Calls Feature (Phase 3) - 95% Complete

#### Completed Components:

**Backend Infrastructure:**

- ✅ DynamoDB tables for call sessions and meetings
- ✅ AWS Chime SDK integration (meetings, attendees)
- ✅ API routes for call lifecycle (initiate, accept, join, end)
- ✅ JWT authentication via Cognito (ID token verification)
- ✅ Call session state management (RINGING → ACTIVE → ENDED)

**Frontend Components:**

- ✅ ChimeManager singleton (`src/lib/chime/ChimeManager.ts`)

  - Meeting initialization and cleanup
  - Audio/video device enumeration
  - Local media stream management
  - Video tile binding for remote participants
  - Observer pattern for event subscriptions

- ✅ CallWindow component (`src/components/calls/CallWindow.tsx`)

  - Chime SDK initialization
  - Video element binding
  - Mute/camera toggle controls
  - Real-time event handling

- ✅ DeviceSelector component (`src/components/calls/DeviceSelector.tsx`)

  - Audio input/output device selection
  - Video input device selection
  - Device enumeration and switching

- ✅ CallTestPage (`src/app/test/call/page.tsx`)
  - Interactive UI for testing complete call flow
  - Real-time event logging
  - Multi-browser testing support

**API Endpoints:**

- ✅ `POST /api/calls/initiate` - Initiate a new call
- ✅ `POST /api/calls/join-info` - Get Chime credentials for joining
- ✅ `POST /api/calls/[sessionId]/participant-update` - Accept/update call status
- ✅ `POST /api/calls/[sessionId]/join-token` - Generate attendee tokens
- ✅ `POST /api/calls/[sessionId]/end` - Terminate call session
- ✅ `POST /api/meetings/[meetingId]/start` - Create Chime meeting
- ✅ `POST /api/meetings/[meetingId]/end` - End meeting
- ✅ `POST /api/meetings/[meetingId]/join-token` - Generate meeting tokens

#### Known Limitations & Future Improvements:

**Current Limitations:**

- No server-side timeout for orphaned RINGING calls (30-60 second auto-end recommended)
- No automatic cleanup when initiator disconnects
- Socket.IO real-time notifications not fully integrated (manual UI-based testing)
- No bandwidth/connection quality monitoring
- Limited error recovery for network failures

**Recommended Enhancements:**

1. **Server-side Call Timeout** - Auto-end RINGING calls after 30-60 seconds
2. **Automatic Cleanup on Disconnect** - End calls if initiator Socket.IO connection drops
3. **Connection Quality Monitoring** - Display bandwidth and audio/video quality indicators
4. **Error Recovery** - Automatic reconnection and state recovery on network failures
5. **Call History & Analytics** - Track call duration, participants, quality metrics
6. **Offline Message Queue** - Queue notifications for offline users

#### Testing & Cleanup Tools:

**Cleanup Scripts:**

- `scripts/cleanup-calls.ts` - Node.js script to clean orphaned sessions (local)
- `scripts/cleanup-calls-cloudshell.sh` - Bash script for CloudShell (AWS credentials)

**Monitoring Commands:**

```bash
# List all RINGING calls
aws dynamodb scan --table-name PantherKolab-CallSessions-dev \
  --filter-expression "#status = :status" \
  --expression-attribute-names "{'#status':'status'}" \
  --expression-attribute-values '{":status":{"S":"RINGING"}}' \
  --region us-east-1 --output table

# Check Chime meeting state
aws chime-sdk-meetings get-meeting --meeting-id <CHIME_MEETING_ID> --region us-east-1
```

#### Architecture Diagram:

```
User 1 (Browser)          User 2 (Browser)
      ↓                          ↓
   CallTestPage ←─→ Cognito (ID Token) ←─→ CallTestPage
      ↓                          ↓
   ChimeManager             ChimeManager
      ↓                          ↓
   Chime SDK ←──────────────→ Chime SDK
      ↓                          ↓
   Audio/Video              Audio/Video

Backend (AWS):
  /api/calls/initiate → DynamoDB (CallSessions) → Chime SDK (CreateMeeting)
                                                       ↓
  /api/calls/join-info → DynamoDB + Chime SDK → GetMeetingInfo
                            ↓
  /api/calls/[sessionId]/end → Chime SDK (DeleteMeeting) → DynamoDB (Update)
```

---

## Key Files to Know

### Configuration Files:

- `lib/parameterStore.ts` - AWS Parameter Store client for secrets management
- `lib/dynamodb/index.ts` - DynamoDB client with credentials configuration
- `lib/chime/chimeConfig.ts` - AWS Chime SDK client configuration
- `next.config.js` - Next.js configuration
- `.env.local` - Environment variables (NEVER commit!)
- `tailwind.config.ts` - Tailwind CSS configuration

### Entry Points:

- `app/layout.tsx` - Root layout with Amplify provider
- `app/page.tsx` - Landing/login page
- `app/(auth)/signup/page.tsx` - Registration with email validation
- `app/(auth)/login/page.tsx` - Login page
- `app/(dashboard)/layout.tsx` - Main app layout
- `app/(dashboard)/chat/page.tsx` - Main chat interface

### Core Logic:

- `src/app/api/messages/route.ts` - Message API endpoints
- `src/app/api/calls/` - Audio/video call API endpoints
- `src/lib/socket.ts` - Socket.IO client configuration
- `src/components/chat/MessageList.tsx` - Message rendering
- `src/components/chat/MessageInput.tsx` - Message sending
- `src/backend/triggers/preSignUp.ts` - Email domain validation Lambda
- `src/services/` - Business logic services (ChimeService, etc.)

**Audio/Video Call System:**

- `src/lib/chime/ChimeManager.ts` - AWS Chime SDK wrapper (singleton pattern)
- `src/components/calls/CallWindow.tsx` - Call UI component
- `src/components/calls/DeviceSelector.tsx` - Audio/video device selection
- `src/app/test/call/page.tsx` - Interactive call testing interface
- `src/services/chimeService.ts` - Call session and meeting management
- `src/app/api/calls/initiate/route.ts` - Call initiation endpoint
- `src/app/api/calls/join-info/route.ts` - Call credentials endpoint
- `src/app/api/calls/[sessionId]/participant-update/route.ts` - Participant status updates
- `src/app/api/calls/[sessionId]/end/route.ts` - Call termination

### Email Validation Lambda Example:

```typescript
// backend/triggers/preSignUp.ts
export const handler = async (event: any) => {
  const email = event.request.userAttributes.email;

  if (!email.endsWith("@fiu.edu")) {
    throw new Error(
      "Only FIU email addresses (@fiu.edu) are allowed to register."
    );
  }

  return event;
};
```

## Common Commands

```bash
# Development
npm run dev                    # Start Next.js dev server with Turbopack
npm run build                  # Build for production
npm run start                  # Start production server

# Cleanup & Maintenance
npm run cleanup:calls          # Clean orphaned call sessions (local)
bash scripts/cleanup-calls-cloudshell.sh <sessionId>  # CloudShell cleanup

# Code Quality
npm run lint                   # Run ESLint
npm run format                # Run Prettier (if configured)

# Deployment
git push origin <branch>       # Push to GitHub
# GitHub Actions handles CI/CD automatically
```

## Success Metrics (9-Week Timeline)

By the end of 9 weeks:

- ✅ All core features functional and polished
- ✅ 95%+ uptime during demo period
- ✅ Sub-2s page load times
- ✅ Zero security vulnerabilities
- ✅ Comprehensive documentation
- ✅ Each team member has significant commits and features shipped

## Resources for Team

### Learning Materials:

- Next.js 14 Documentation: https://nextjs.org/docs
- AWS SDK for JavaScript: https://docs.aws.amazon.com/sdk-for-javascript
- AWS Cognito Documentation: https://docs.aws.amazon.com/cognito
- Socket.IO Documentation: https://socket.io/docs
- AWS Chime SDK: https://aws.amazon.com/chime/chime-sdk
- Tailwind CSS: https://tailwindcss.com/docs
- TypeScript Handbook: https://www.typescriptlang.org/docs

### Inspiration:

- Discord's UI/UX patterns
- WhatsApp's simplicity
- Notion's collaboration features
- Slack's group organization

---

**Remember:** This is a learning project. Mistakes are expected and encouraged. The goal is to build something impressive while growing as developers and teammates. Ask questions, collaborate often, and celebrate small wins!
