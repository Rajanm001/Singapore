/**
 * Mock LLM Service
 * Simulates LLM responses for development and testing
 */

import type { LLMService, LLMCompletionRequest, LLMCompletionResponse } from './llmService.ts';

export class MockLLMService implements LLMService {
  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 400));

    // Generate mock response based on prompt content
    const text = this.generateMockResponse(request.prompt, request.systemPrompt);

    const promptTokens = this.estimateTokens(request.prompt);
    const completionTokens = this.estimateTokens(text);

    return {
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      model: request.model,
      finishReason: 'stop',
    };
  }

  private generateMockResponse(prompt: string, _systemPrompt?: string): string {
    const lowerPrompt = prompt.toLowerCase();

    // Refund policy responses
    if (lowerPrompt.includes('refund') && lowerPrompt.includes('digital')) {
      return `Based on our refund policy, digital products are eligible for a full refund within 14 days of purchase, provided the product has not been downloaded or accessed. Once a digital product is downloaded, it becomes non-refundable due to the nature of digital goods.

If you need assistance with a refund, please contact our support team at support@example.com with your order number.`;
    }

    if (lowerPrompt.includes('refund')) {
      return `Our refund policy varies by product type:

- **Digital Products**: 14-day refund window if not downloaded
- **Physical Products**: 30-day return window with original packaging

To process a refund, please reach out to our support team with your order details.`;
    }

    // Confidence/quality responses
    if (lowerPrompt.includes('quality') || lowerPrompt.includes('confidence')) {
      // Simulate confidence score
      const hasContext = lowerPrompt.length > 200;
      const confidence = hasContext ? 0.85 : 0.45;
      
      return `Confidence: ${confidence}. ${
        confidence > 0.7
          ? 'I have sufficient information to answer this question.'
          : 'I do not have enough information to provide a confident answer.'
      }`;
    }

    // Generic fallback response
    return `Thank you for your question. Based on the information provided, here is my response:

${this.generateGenericAnswer(prompt)}

If you need more specific information, please provide additional details or contact our support team.`;
  }

  private generateGenericAnswer(prompt: string): string {
    const topics = [
      'products and services',
      'policies and procedures',
      'account management',
      'technical support',
      'billing and payments',
    ];

    // Try to infer topic from prompt
    const promptLower = prompt.toLowerCase();
    const matchedTopic = topics.find(topic => promptLower.includes(topic.split(' ')[0] || ''));
    const topicToUse = matchedTopic || topics[Math.floor(Math.random() * topics.length)];
    
    return `I understand you're asking about ${topicToUse}. While I don't have specific details in the current context, our team can assist you further. Please reach out to support@example.com for personalized help.`;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Add custom mock responses for testing
   */
  private mockResponses = new Map<string, string>();

  addMockResponse(promptPattern: string, response: string): void {
    this.mockResponses.set(promptPattern, response);
  }

  clearMockResponses(): void {
    this.mockResponses.clear();
  }
}
