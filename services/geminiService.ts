import { GoogleGenAI, Type } from '@google/genai';
import { PttPost, AiAnalysisResult } from '../types';

export const analyzeComments = async (
  post: PttPost,
  apiKey: string
): Promise<AiAnalysisResult> => {
  const ai = new GoogleGenAI({
    apiKey: 'AIzaSyDd4wJEWP5_LS5FK-2IEtzLsfJ1AagNOwo',
  });

  // Prepare data for prompt (limit to prevent huge payloads, though 2.5 flash is capable)
  // We focus on the comments for "Stock" sentiment.
  const commentsText = post.comments
    .map((c) => `${c.type} ${c.user}: ${c.content}`)
    .join('\n');

  const prompt = `
    You are an expert stock market sentiment analyst. Analyze the following comments from a PTT (Taiwanese Reddit) Stock board post.
    
    Post Title: ${post.title}
    Post Content (Summary): ${post.mainContent.slice(0, 500)}...
    
    Comments:
    ${commentsText.slice(0, 30000)} 
    
    (Truncated if too long)

    Please output a JSON object with the following structure:
    1. sentiment: "bullish" (看多), "bearish" (看空), or "neutral" (中立/觀望).
    2. summary: A short paragraph (in Traditional Chinese) summarizing the overall atmosphere of the discussion (max 100 words).
    3. keyPoints: An array of 3 strings (in Traditional Chinese), highlighting the main arguments or jokes discussed.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: {
              type: Type.STRING,
              enum: ['bullish', 'bearish', 'neutral'],
            },
            summary: { type: Type.STRING },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
        // Add safety settings to prevent blocking typical stock market slang (e.g., "die", "kill", "panic")
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
        ],
      },
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI');

    return JSON.parse(text) as AiAnalysisResult;
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    throw new Error('AI 分析失敗，請檢查 API Key 是否正確或稍後再試。');
  }
};
