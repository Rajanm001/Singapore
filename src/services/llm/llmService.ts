/**
 * LLM Service Interface
 * Abstraction for language model interactions
 */

export interface LLMCompletionRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMCompletionResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export interface LLMService {
  /**
   * Generate a completion from the language model
   */
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}
