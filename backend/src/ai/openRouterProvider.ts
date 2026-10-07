import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AppError } from '../errors/AppError';
import { extractionDraftSchema, extractionJsonSchema, type ExtractionDraft } from './extraction.schema';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';
import type { AiProvider, ExtractionRequest } from './types';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const SCHEMA_NAME = 'meeting_plan';
const MAX_ATTEMPTS = 2; // one retry when the model's output doesn't match the schema

const aiUnavailable = (message: string) => new AppError(502, 'AI_UNAVAILABLE', message);

// OpenRouter through its OpenAI-compatible API. Prefers `json_schema` structured output; if the
// selected model/route rejects that, falls back to a forced tool call with the same schema.
export class OpenRouterProvider implements AiProvider {
  readonly name = 'openrouter';
  private readonly client: OpenAI;
  private mode: 'json_schema' | 'tool' = 'json_schema';

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      timeout: 90_000,
      maxRetries: 1,
      defaultHeaders: { 'X-Title': 'NovaWorks CRM' },
    });
  }

  async extract(request: ExtractionRequest): Promise<ExtractionDraft> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(request) },
    ];

    let problem = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const raw = await this.complete(messages);
      const parsed = parseDraft(raw);
      if (parsed.ok) return parsed.draft;

      problem = parsed.problem;
      messages.push(
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content: `That output was invalid (${problem}). Reply again with only a JSON object that matches the schema.`,
        },
      );
    }
    throw new AppError(502, 'AI_INVALID_OUTPUT', `The AI returned output in an unexpected format: ${problem}`);
  }

  private async complete(messages: ChatCompletionMessageParam[]): Promise<string> {
    if (this.mode === 'json_schema') {
      try {
        return await this.completeWithJsonSchema(messages);
      } catch (err) {
        // Model/route doesn't support response_format json_schema: switch to tool calling.
        if (!(err instanceof OpenAI.BadRequestError)) throw toAppError(err);
        this.mode = 'tool';
      }
    }
    try {
      return await this.completeWithTool(messages);
    } catch (err) {
      throw toAppError(err);
    }
  }

  private async completeWithJsonSchema(messages: ChatCompletionMessageParam[]): Promise<string> {
    const completion = await this.client.chat.completions.create(
      this.params(messages, {
        response_format: {
          type: 'json_schema',
          json_schema: { name: SCHEMA_NAME, strict: true, schema: extractionJsonSchema },
        },
      }),
    );
    return completion.choices[0]?.message?.content ?? '';
  }

  private async completeWithTool(messages: ChatCompletionMessageParam[]): Promise<string> {
    const completion = await this.client.chat.completions.create(
      this.params(messages, {
        tools: [
          {
            type: 'function',
            function: {
              name: SCHEMA_NAME,
              description: 'Save the projects and tasks agreed in the meeting.',
              parameters: extractionJsonSchema,
              strict: true,
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: SCHEMA_NAME } },
      }),
    );
    const message = completion.choices[0]?.message;
    const call = message?.tool_calls?.find((c) => c.type === 'function');
    return call?.type === 'function' ? call.function.arguments : (message?.content ?? '');
  }

  private params(
    messages: ChatCompletionMessageParam[],
    extra: Partial<ChatCompletionCreateParamsNonStreaming>,
  ): ChatCompletionCreateParamsNonStreaming {
    return {
      model: this.model,
      temperature: 0,
      messages,
      ...extra,
      // OpenRouter extension: only route to providers that support the requested parameters
      // (structured output / tools), instead of silently ignoring them.
      ...({ provider: { require_parameters: true } } as object),
    };
  }
}

function parseDraft(raw: string): { ok: true; draft: ExtractionDraft } | { ok: false; problem: string } {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
  if (!text) return { ok: false, problem: 'empty response' };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'response is not valid JSON' };
  }

  const result = extractionDraftSchema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, problem: `${first.path.join('.') || 'root'}: ${first.message}` };
  }
  return { ok: true, draft: result.data };
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof OpenAI.APIConnectionTimeoutError) return aiUnavailable('The AI service timed out. Please try again.');
  if (err instanceof OpenAI.APIConnectionError) return aiUnavailable('Could not reach the AI service. Please try again.');
  if (err instanceof OpenAI.AuthenticationError) return aiUnavailable('The AI service rejected the API key (check OPENROUTER_API_KEY).');
  if (err instanceof OpenAI.RateLimitError) return aiUnavailable('The AI service is rate-limited. Wait a moment and try again.');
  if (err instanceof OpenAI.APIError) return aiUnavailable(`The AI service returned an error: ${err.message}`);
  console.error(err);
  return aiUnavailable('The AI service failed unexpectedly.');
}
