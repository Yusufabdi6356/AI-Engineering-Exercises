import { MockLanguageModelV2, simulateReadableStream } from 'ai/test';

type StreamPart =
  Awaited<ReturnType<MockLanguageModelV2['doStream']>>['stream'] extends ReadableStream<infer Part> ? Part : never;

export const scenario = {
  toolName: 'queryDatabase',
  toolInput: {} as object,
  answer: '',
  modelIds: [] as string[],
};

const usage = { inputTokens: 120, outputTokens: 30, totalTokens: 150 };

export const mockModel = new MockLanguageModelV2({
  doStream: async ({ prompt }) => {
    const toolFinished = prompt.some(message => message.role === 'tool');
    const chunks: StreamPart[] = toolFinished
      ? [
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: scenario.answer },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage },
        ]
      : [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: scenario.toolName,
            input: JSON.stringify(scenario.toolInput),
          },
          { type: 'finish', finishReason: 'tool-calls', usage },
        ];

    return { stream: simulateReadableStream({ chunks }) };
  },
});
