export interface SessionState {
    user_prompt: string;
    pdf_context: string;
    history: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}

export interface TutorialResult {
    state: SessionState;
    assistant_message: string;
}

export interface CodeBlock {
    label: string;
    code: string;
    language: string;
}