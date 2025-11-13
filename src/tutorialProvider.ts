import * as vscode from 'vscode';
import { TutorialService } from './tutorialService';
import { PDFProcessor } from './pdfProcessor';
import { SessionState } from './types';

export class TutorialProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private tutorialService: TutorialService;
    private pdfProcessor: PDFProcessor;
    private sessions: Map<string, SessionState> = new Map();

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.tutorialService = new TutorialService();
        this.pdfProcessor = new PDFProcessor();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView | vscode.Webview,
        context: vscode.WebviewViewResolveContext | vscode.ExtensionContext,
        _token?: vscode.CancellationToken
    ) {
        const webview = 'webview' in webviewView ? webviewView.webview : webviewView;
        this._view = 'webview' in webviewView ? webviewView : undefined;

        webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webview.html = this._getHtmlForWebview(webview);

        // Handle messages from the webview
        webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'startTutorial':
                    await this.handleStartTutorial(data, webview);
                    break;
                case 'continueTutorial':
                    await this.handleContinueTutorial(data, webview);
                    break;
                case 'uploadPDF':
                    await this.handleUploadPDF(data, webview);
                    break;
            }
        });
    }

    private async handleStartTutorial(data: any, webview: vscode.Webview) {
        try {
            const config = vscode.workspace.getConfiguration('timmyTutorial');
            const apiKey = config.get<string>('openaiApiKey');

            if (!apiKey) {
                webview.postMessage({
                    type: 'error',
                    message: 'OpenAI API key not configured'
                });
                return;
            }

            const result = await this.tutorialService.startTutorial(
                data.prompt,
                data.pdfText || '',
                apiKey
            );

            const sessionId = this.generateSessionId();
            this.sessions.set(sessionId, result.state);

            webview.postMessage({
                type: 'tutorialStarted',
                sessionId,
                message: result.assistant_message
            });
        } catch (error: any) {
            webview.postMessage({
                type: 'error',
                message: error.message
            });
        }
    }

    private async handleContinueTutorial(data: any, webview: vscode.Webview) {
        try {
            const config = vscode.workspace.getConfiguration('timmyTutorial');
            const apiKey = config.get<string>('openaiApiKey');

            if (!apiKey) {
                webview.postMessage({
                    type: 'error',
                    message: 'OpenAI API key not configured'
                });
                return;
            }

            const state = this.sessions.get(data.sessionId);
            if (!state) {
                webview.postMessage({
                    type: 'error',
                    message: 'Session not found'
                });
                return;
            }

            const result = await this.tutorialService.continueTutorial(
                state,
                data.userMessage,
                apiKey
            );

            this.sessions.set(data.sessionId, result.state);

            webview.postMessage({
                type: 'tutorialContinued',
                message: result.assistant_message
            });
        } catch (error: any) {
            webview.postMessage({
                type: 'error',
                message: error.message
            });
        }
    }

    private async handleUploadPDF(data: any, webview: vscode.Webview) {
        try {
            // In VS Code, we'll use file picker instead
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'PDF files': ['pdf']
                }
            });

            if (uris && uris[0]) {
                const pdfText = await this.pdfProcessor.extractText(uris[0].fsPath);
                webview.postMessage({
                    type: 'pdfProcessed',
                    text: pdfText
                });
            }
        } catch (error: any) {
            webview.postMessage({
                type: 'error',
                message: error.message
            });
        }
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
        );

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Timmy Tutorial</title>
        </head>
        <body>
            <div class="container">
                <h1>Timmy Tutorial</h1>
                
                <div id="start-view">
                    <textarea 
                        id="prompt-input" 
                        placeholder="Teach me how to build a Flask CRUD API with SQLite"
                        rows="4"
                    ></textarea>
                    
                    <button id="upload-pdf-btn">Upload PDF</button>
                    <button id="start-btn">Start Tutorial</button>
                </div>

                <div id="tutorial-view" style="display: none;">
                    <div id="code-container">
                        <pre><code id="code-content"></code></pre>
                    </div>
                    
                    <div id="explanation-history"></div>
                    
                    <div id="controls">
                        <input type="text" id="question-input" placeholder="Ask a question...">
                        <button id="next-step-btn">Next Step</button>
                        <button id="send-question-btn">Send</button>
                    </div>
                </div>

                <div id="error-message" style="display: none;"></div>
            </div>

            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}