# Collaborative Whiteboard Feature Implementation Plan

## Executive Summary

**Recommendation:** Integrate **tldraw** as the whiteboard solution for PantherKolab.

**Rationale:**
- Provides 4/5 required features out-of-box (freeform drawing, text editing, export, collaboration infrastructure)
- Native TypeScript support with comprehensive type definitions
- Official Next.js App Router integration
- Built-in real-time collaboration patterns that align with existing AppSync Events architecture
- Active development and maintenance (v4.2.0, December 2024)
- Faster time-to-market (~4.5 weeks)

**Confirmed Decisions:**
- ✅ Bundle size (~1MB) is acceptable - no constraint
- ✅ LaTeX Editor: Enhanced visual equation builder (Option B) with helper buttons
- ✅ Persistence: Basic (current state only, no version history)
- ✅ Access Control: Deferred to post-MVP
- ✅ Platform: Desktop-only for MVP

---

## Requirements Summary

1. **Freeform drawing/sketching** - ✅ tldraw native
2. **Type regular text** - ✅ tldraw native
3. **Type LaTeX equations** - ⚠️ Custom shape required (detailed below)
4. **Save as PDF/image** - ✅ tldraw export + custom PDF generation
5. **Real-time collaboration** - ✅ tldraw infrastructure + AppSync Events

---

## Architecture Overview

### Real-time Communication Pattern

Follow existing user-centric channel model:
- **Channel:** `/whiteboards/{userId}` - Each user subscribes to their own channel
- **Server fan-out:** When user makes changes, publish events to all collaborators' channels
- **Event types:** WHITEBOARD_CHANGE, WHITEBOARD_CURSOR, WHITEBOARD_USER_JOINED, WHITEBOARD_USER_LEFT

### Data Flow

```
User Edit → tldraw Store → useWhiteboard Hook → API Route → DynamoDB + AppSync Publish
                                                                          ↓
Remote User ← tldraw Store Update ← useWhiteboard Subscription ← AppSync Events
```

### Component Architecture

```
src/
├── app/(protected)/whiteboard/[id]/page.tsx    # Whiteboard page route
├── components/whiteboard/
│   ├── WhiteboardCanvas.tsx                     # Main tldraw wrapper
│   ├── LatexShape.tsx                           # Custom LaTeX shape + tool
│   └── ExportDialog.tsx                         # Export UI (PDF/PNG/SVG)
├── hooks/
│   └── useWhiteboard.ts                         # Real-time sync hook
├── services/
│   └── whiteboardService.ts                     # DynamoDB operations
├── lib/s3/
│   └── s3-client.ts                             # S3 file uploads
└── types/
    ├── database.ts                              # Add Whiteboard types
    └── appsync-events.ts                        # Add WhiteboardEvent types
```

---

## Implementation Plan

### Phase 1: Foundation Setup (3 days)

#### 1.1 Install Dependencies
```bash
npm install tldraw
npm install katex react-katex @types/katex
npm install jspdf html2canvas
npm install @aws-sdk/client-s3
```

#### 1.2 Database Schema

**New DynamoDB Tables:**

**Table: PantherKolab-Whiteboards-{env}**
```typescript
interface Whiteboard {
  whiteboardId: string;           // UUID (PK)
  conversationId: string;         // Link to conversation (required for MVP)
  ownerId: string;                // Creator userId
  name: string;                   // Whiteboard title
  snapshot: string;               // tldraw JSON snapshot (stringified)
  thumbnailUrl: string | null;    // S3 preview image URL
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
  lastEditedBy: string;           // userId of last editor
}
```

**Required GSI:**
- `ConversationIdIndex` on Whiteboards table (for listing whiteboards by conversation)

**MVP Simplifications:**
- No WhiteboardSessions table (no version history)
- No permissions field (all conversation participants have access)
- Snapshot is overwritten on each save (no history)

#### 1.3 Type Definitions

**Update `src/types/database.ts`:**
- Add `Whiteboard` interface (simplified, no WhiteboardSession for MVP)
- Add `WHITEBOARDS` to `TABLE_NAMES` constant
- Export whiteboard-related types

**Update `src/types/appsync-events.ts`:**
- Add `WhiteboardEvent` union type
- Add event interfaces: `WhiteboardChangeEvent`, `WhiteboardCursorEvent`, `WhiteboardUserJoinedEvent`, `WhiteboardUserLeftEvent`
- Update `AppSyncEventUnion` to include `WhiteboardEvent`
- Add `WhiteboardEventType` to `EventType` union

---

### Phase 2: Service Layer (4 days)

#### 2.1 Whiteboard Service

**Create `src/services/whiteboardService.ts`:**

Key methods:
- `createWhiteboard(input)` - Create new whiteboard (CONVERSATION type only for MVP)
- `getWhiteboard(whiteboardId)` - Fetch whiteboard by ID
- `updateSnapshot(whiteboardId, snapshot, userId)` - Save full snapshot (overwrites previous)
- `listWhiteboardsByConversation(conversationId)` - Get all whiteboards for a conversation
- `deleteWhiteboard(whiteboardId)` - Remove whiteboard

**Note:** Simplified for MVP - no session history, no granular permissions. Access control deferred to post-MVP.

**Pattern:** Mirror `conversationService.ts` structure with DynamoDB commands

#### 2.2 S3 Client

**Create `src/lib/s3/s3-client.ts`:**

Key methods:
- `uploadToS3(key, buffer, contentType)` - Upload file to S3
- `generatePresignedUrl(key, expiresIn)` - Generate download URL
- `deleteFromS3(key)` - Remove file

**Configuration:**
- Bucket: `pantherkolab-files-{env}`
- Region: `us-east-1`
- Use existing AWS credentials from `.env.local`

---

### Phase 3: API Routes (3 days)

#### 3.1 Create Whiteboard
**`POST /api/whiteboards/create`**
- Authenticate user
- Create whiteboard via `whiteboardService`
- Return `whiteboardId`

#### 3.2 Get Whiteboard
**`GET /api/whiteboards/[id]`**
- Authenticate user
- Verify permissions
- Return whiteboard data with snapshot

#### 3.3 Sync Changes
**`POST /api/whiteboards/sync`**
- Authenticate user
- Verify user is conversation participant
- Update full snapshot in DynamoDB (overwrite previous)
- Publish `WHITEBOARD_CHANGE` event to all collaborators via `publishToUsers()`
- Use debouncing on client-side (sync max every 2 seconds to reduce API calls)

#### 3.4 Export Whiteboard
**`POST /api/whiteboards/export`**
- Authenticate user
- Verify permissions
- Receive base64 image data from client
- Upload to S3 under `whiteboards/{whiteboardId}_timestamp.{format}`
- Return S3 URL

**Pattern:** Mirror `src/app/api/messages/send/route.ts` authentication and AppSync publishing patterns

---

### Phase 4: React Components (5 days)

#### 4.1 Custom Hook: useWhiteboard

**Create `src/hooks/useWhiteboard.ts`:**

State management:
- `isConnected: boolean` - AppSync connection status
- `activeUsers: Set<string>` - Currently active collaborators

Methods:
- `syncChanges(changes, snapshot?)` - Send changes to API
- Subscribe to `/whiteboards/{userId}` channel
- Handle incoming events (WHITEBOARD_CHANGE, USER_JOINED, USER_LEFT)

**Pattern:** Mirror `src/hooks/useMessages.ts` subscription and state management

#### 4.2 LaTeX Shape Component

**Create `src/components/whiteboard/LatexShape.tsx`:**

Custom tldraw shape:
- Extend `BaseBoxShapeUtil<LatexShape>`
- Render LaTeX using KaTeX in `HTMLContainer`
- Editable via double-click (opens enhanced dialog)
- Default equation: `f(x) = x^2`

Custom tool:
- Extend `BaseBoxShapeTool`
- Add to tldraw toolbar as "LaTeX" button
- Keyboard shortcut: `L`

**Create `src/components/whiteboard/LatexEditorDialog.tsx`:**

Enhanced LaTeX editor with:
- Text input field for direct LaTeX entry
- Live preview panel showing rendered equation (updates on keypress)
- Helper button toolbar with common symbols:
  - Superscript: `x^{}`
  - Subscript: `x_{}`
  - Fraction: `\frac{}{}`
  - Square Root: `\sqrt{}`
  - Nth Root: `\sqrt[n]{}`
  - Sum: `\sum`
  - Integral: `\int`
  - Greek letters: α, β, θ, π, etc. (insert `\alpha`, `\beta`, etc.)
  - Operators: ×, ÷, ±, ≤, ≥ (insert `\times`, `\div`, etc.)
- "Insert LaTeX" link to cheat sheet reference
- Cancel/Insert buttons

User flow:
1. Click LaTeX tool or double-click existing LaTeX shape
2. Dialog opens with current equation (if editing)
3. User can type directly OR click helper buttons to insert syntax
4. Live preview updates in real-time
5. Click "Insert" to add to canvas

#### 4.3 Main Whiteboard Canvas

**Create `src/components/whiteboard/WhiteboardCanvas.tsx`:**

Props:
- `whiteboardId: string`
- `currentUserId: string`
- `initialSnapshot?: string`
- `isReadOnly?: boolean`

Features:
- Initialize tldraw with custom shapes and tools
- Load initial snapshot on mount
- Listen to store changes and sync via `useWhiteboard`
- Display active users indicator
- Connection status badge

#### 4.4 Export Dialog

**Create `src/components/whiteboard/ExportDialog.tsx`:**

Features:
- Format selection: PNG, SVG, PDF
- Export logic:
  - PNG/SVG: Use tldraw's `editor.getSvg()` method
  - PDF: Convert SVG → Canvas → jsPDF
- Upload to S3 via API
- Download file automatically

---

### Phase 5: Chat Integration (3 days)

#### 5.1 Whiteboard Page Route

**Create `src/app/(protected)/whiteboard/[id]/page.tsx`:**

Features:
- Protected route (requires authentication)
- Fetch whiteboard data from API
- Render `WhiteboardCanvas` with full screen
- Export button (bottom right, fixed position)
- Handle loading/error states

#### 5.2 Add Whiteboard Access from Chat

**Modify `src/components/chat/mainChatArea.tsx`:**

Add button in chat header:
- Icon: `FileText` from lucide-react
- Action: Create/open whiteboard for conversation
- API call to `/api/whiteboards/create` with `conversationId`
- Navigate to `/whiteboard/[id]` on success

**Modify `src/hooks/useChat.ts`:**

Add methods:
- `createWhiteboard(name)` - Create whiteboard for active conversation
- `listWhiteboards()` - Fetch whiteboards for conversation

---

### Phase 6: File Storage & Export (3 days)

#### 6.1 S3 Bucket Setup

**AWS CLI Commands:**
```bash
# Create bucket
aws s3api create-bucket \
  --bucket pantherkolab-files-dev \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket pantherkolab-files-dev \
  --versioning-configuration Status=Enabled

# Set CORS policy
aws s3api put-bucket-cors \
  --bucket pantherkolab-files-dev \
  --cors-configuration file://cors-config.json
```

#### 6.2 Environment Variables

Add to `.env.local`:
```bash
S3_BUCKET_NAME=pantherkolab-files-dev
DYNAMODB_WHITEBOARDS_TABLE=PantherKolab-Whiteboards-dev
DYNAMODB_WHITEBOARD_SESSIONS_TABLE=PantherKolab-WhiteboardSessions-dev
```

#### 6.3 Export Implementation

Client-side:
1. Use tldraw's `editor.getSvg()` to get SVG of all shapes
2. Convert SVG → Canvas → PNG/PDF using html2canvas/jsPDF
3. Convert to base64
4. Send to `/api/whiteboards/export`

Server-side:
1. Decode base64 to buffer
2. Upload to S3 with appropriate content-type
3. Return public URL
4. Client triggers download

---

### Phase 7: Testing & Optimization (4 days)

#### 7.1 Performance Optimizations

1. **Throttle Sync Events**
   - Debounce sync calls to 2-second intervals
   - Only sync when user makes changes (not on cursor movement)

2. **Lazy Load tldraw**
   - Use dynamic import: `const Tldraw = dynamic(() => import('tldraw'), { ssr: false })`
   - Reduces initial page load and prevents SSR issues

3. **Snapshot Compression**
   - Compress snapshots before storing in DynamoDB (use gzip or lz-string)
   - DynamoDB item size limit: 400KB (compressed snapshots should stay well under this)

4. **Cursor Position Throttling**
   - Limit cursor broadcasts to 30fps (every 33ms)
   - Use requestAnimationFrame for smooth updates
   - Consider disabling cursor sync for MVP if not critical

#### 7.2 Testing Strategy

**Unit Tests:**
- `whiteboardService` CRUD operations
- Permission verification logic
- LaTeX shape rendering

**Integration Tests:**
- API route authentication
- AppSync event publishing
- S3 upload/download

**E2E Tests:**
- Create whiteboard from chat
- Multi-user collaborative editing
- Export to PDF/PNG/SVG
- Permission enforcement

---

## Key Technical Decisions

### Why tldraw over Excalidraw?

1. **Built-in collaboration infrastructure** - tldraw has multiplayer primitives; Excalidraw requires custom CRDT implementation
2. **Better TypeScript support** - tldraw is TypeScript-first with comprehensive types
3. **Official Next.js template** - Proven integration path with App Router
4. **Plugin architecture** - Easier to extend with LaTeX and custom tools
5. **Active development** - More recent releases and better maintenance

### Why user-centric channels?

Consistent with existing architecture:
- Users already subscribe to `/chats/{userId}` and `/calls/{userId}`
- Adding `/whiteboards/{userId}` maintains pattern
- Scales better than per-whiteboard channels (reduces connection overhead)
- Server handles fan-out to all collaborators

### Why store only current snapshot (no history)?

**MVP Decision:**
- **Simpler implementation** - No version control complexity
- **Faster development** - No session tracking, no delta storage
- **Sufficient for use case** - Real-time collaboration is primary goal
- **DynamoDB item size** - Single snapshot field stays under 400KB limit with compression
- **Page refresh behavior** - Loads latest saved snapshot (auto-saves every 2 seconds)

**Post-MVP:** Can add version history later if users request it

---

## Critical Files to Modify

1. **src/types/database.ts** - Add Whiteboard and WhiteboardSession interfaces
2. **src/types/appsync-events.ts** - Add WhiteboardEvent types
3. **src/lib/appSync/appsync-client.ts** - May need to add `subscribeToUserWhiteboards()` helper
4. **src/components/chat/mainChatArea.tsx** - Add whiteboard button in header

**Files to Create:**
- Service: `src/services/whiteboardService.ts`
- Hook: `src/hooks/useWhiteboard.ts`
- Components:
  - `src/components/whiteboard/WhiteboardCanvas.tsx`
  - `src/components/whiteboard/LatexShape.tsx`
  - `src/components/whiteboard/LatexEditorDialog.tsx` (enhanced with helper buttons)
  - `src/components/whiteboard/ExportDialog.tsx`
- API Routes:
  - `src/app/api/whiteboards/create/route.ts`
  - `src/app/api/whiteboards/[id]/route.ts` (GET)
  - `src/app/api/whiteboards/sync/route.ts`
  - `src/app/api/whiteboards/export/route.ts`
- S3 Client: `src/lib/s3/s3-client.ts`
- Page: `src/app/(protected)/whiteboard/[id]/page.tsx`

---

## Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Foundation | 3 days | Database schema, dependencies, types |
| Phase 2: Service Layer | 3 days | whiteboardService (simplified), S3 client |
| Phase 3: API Routes | 3 days | Create, get, sync, export endpoints |
| Phase 4: Components | 6 days | Canvas, LaTeX shape with enhanced editor, export dialog |
| Phase 5: Chat Integration | 3 days | Whiteboard page, chat button |
| Phase 6: File Storage | 3 days | S3 setup, export implementation |
| Phase 7: Testing | 4 days | Unit/integration/E2E tests, optimization |
| **Total** | **~4.5 weeks** | Production-ready collaborative whiteboard |

**Note:** Enhanced LaTeX editor (Option B) adds 1 day to Phase 4

---

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Large bundle size affects load time | Medium | High | Lazy load tldraw, implement code splitting |
| LaTeX rendering performance issues | Low | Medium | Render to image on server for complex equations |
| Real-time sync conflicts | Medium | Medium | Use tldraw's CRDT-like store, implement optimistic updates |
| S3 upload failures | Medium | Low | Implement retry logic, client-side caching |
| tldraw API breaking changes | Low | Low | Pin to specific version, test before upgrades |

---

## Success Metrics

### Functional Requirements (Must-Have)
- ✅ Freeform drawing with pen, highlighter, shapes
- ✅ Text editing with formatting
- ✅ LaTeX equation rendering
- ✅ Export to PDF and PNG
- ✅ Real-time collaboration (2+ users)

### Performance Targets
- Initial load: <3 seconds
- Sync latency: <200ms
- Support 10+ concurrent users per whiteboard
- Export generation: <5 seconds
- 60fps drawing performance

### User Experience
- Intuitive toolbar (tldraw native)
- Smooth drawing without lag
- Clear active user indicators
- Auto-save (no manual save button)
- Graceful offline handling

---

## Future Enhancements (Post-MVP)

1. **Version History** - Browse and restore previous snapshots with session tracking
2. **Granular Access Control** - View-only vs edit permissions, private whiteboards
3. **Mobile/Tablet Support** - Touch-optimized drawing on tablets and phones
4. **Advanced LaTeX Features** - Syntax highlighting, more symbol categories, templates
5. **Shape Library** - Pre-built shapes for chemistry, circuits, math diagrams
6. **Voice Chat Integration** - Combine whiteboard with audio calls
7. **Templates** - Pre-designed whiteboard templates (study guides, problem sets)
8. **AI Features** - Convert handwritten math to LaTeX, diagram recognition

---

## Alternative Considered: Build from Scratch

**Pros:**
- Smaller bundle (~400KB vs 1MB)
- Complete control over features
- No licensing concerns

**Cons:**
- 4-6 weeks longer development time
- Higher maintenance burden
- More bugs to fix
- Limited features initially
- Need to implement own CRDT or OT for collaboration

**Verdict:** Not recommended unless bundle size is critical (<500KB hard requirement)
