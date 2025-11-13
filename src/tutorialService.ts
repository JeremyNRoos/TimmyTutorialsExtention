import OpenAI from 'openai';
import { SessionState, TutorialResult } from './types';

const TUTOR_SYSTEM_PROMPT = `
You are a friendly coding tutor, like a YouTube instructor.
Teach step-by-step.

Rules:
- The user gives you a project or PDF context.
- First decide a sequence of steps.
- At each response, output ONLY ONE step.
- For that step:
    - Show a single code block with language fences (e.g. \`\`\`python).
    - Then provide a clear explanation.
- End with: 'Ask questions about this block, or say "next" to continue.'
- Do NOT output all steps at once.
`;

export class TutorialService {
    private clients: Map<string, OpenAI> = new Map();

    private getClient(apiKey: string): OpenAI {
        if (!this.clients.has(apiKey)) {
            this.clients.set(apiKey, new OpenAI({ apiKey }));
        }
        return this.clients.get(apiKey)!;
    }

    private buildMessages(state: SessionState): any[] {
        const base = [
            { role: 'system', content: TUTOR_SYSTEM_PROMPT },
            {
                role: 'user',
                content: `User prompt:\n${state.user_prompt}\n\nPDF context (may be truncated):\n${state.pdf_context.substring(0, 8000)}`
            }
        ];
        return [...base, ...state.history];
    }

    async startTutorial(
        userPrompt: string,
        pdfText: string,
        apiKey: string
    ): Promise<TutorialResult> {
        const client = this.getClient(apiKey);
        
        const state: SessionState = {
            user_prompt: userPrompt,
            pdf_context: pdfText,
            history: []
        };

        const messages = this.buildMessages(state);

        const completion = await client.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: messages as any,
            temperature: 0.3
        });

        const content = completion.choices[0].message.content || '';

        state.history.push({ role: 'assistant', content });

        return {
            state,
            assistant_message: content
        };
    }

    async continueTutorial(
        state: SessionState,
        userMessage: string,
        apiKey: string
    ): Promise<TutorialResult> {
        const client = this.getClient(apiKey);

        state.history.push({ role: 'user', content: userMessage });
        const messages = this.buildMessages(state);

        const completion = await client.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: messages as any,
            temperature: 0.3
        });

        const content = completion.choices[0].message.content || '';
        state.history.push({ role: 'assistant', content });

        return {
            state,
            assistant_message: content
        };
    }
}