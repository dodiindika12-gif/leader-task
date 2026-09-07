import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export const maxDuration = 30;

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages } = body;
    
    // Extract custom configuration from headers or use Hermes defaults
    const apiKey = req.headers.get('x-api-key') || process.env.HERMES_API_KEY;
    const baseURL = req.headers.get('x-endpoint-url') || process.env.NEXT_PUBLIC_HERMES_URL || 'https://hermes.absgroup.biz.id';
    const modelName = req.headers.get('x-model-name') || 'default';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key is missing. Please configure it in settings.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a dynamically configured OpenAI-compatible provider
    const customOpenAI = createOpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });

    // Initiate the streaming text request
    const result = streamText({
      model: customOpenAI.chat(modelName),
      messages: messages,
    });

    // Return the appropriate stream response based on AI SDK version
    if (typeof result.toUIMessageStreamResponse === 'function') {
      return result.toUIMessageStreamResponse();
    } else if (typeof result.toTextStreamResponse === 'function') {
      return result.toTextStreamResponse();
    } else if (typeof result.toDataStreamResponse === 'function') {
      return result.toDataStreamResponse();
    } else {
      // Fallback for very new SDK versions
      return new Response(result.textStream || result.stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred during the request.' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
