import { NextResponse } from 'next/server';
import { publishEvent, testAppSyncConnection } from '@/lib/appsync-events';

export async function GET() {
  try {
    console.log('Testing AppSync connection...');
    
    // Check environment variables
    const endpoint = process.env.NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT;
    
    if (!endpoint) {
      return NextResponse.json({
        success: false,
        error: 'NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT not found in environment'
      }, { status: 500 });
    }
    
    // Test connection
    const isHealthy = await testAppSyncConnection();
    
    if (!isHealthy) {
      return NextResponse.json({
        success: false,
        error: 'AppSync health check failed'
      }, { status: 500 });
    }
    
    // Publish test event
    await publishEvent({
      channel: '/test/api-route',
      event: {
        type: 'MESSAGE_SENT',
        data: {
          message: 'Test from Next.js API route',
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'AppSync is working!',
      endpoint: endpoint,
    });
    
  } catch (error) {
    console.error('AppSync test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}