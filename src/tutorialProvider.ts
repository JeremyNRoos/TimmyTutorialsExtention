import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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
                case 'reset':
                    this.handleReset(webview);
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
                    message: 'OpenAI API key not configured. Please set it in VS Code settings.'
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
                message: error.message || 'An error occurred while starting the tutorial'
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
                    message: 'Session not found. Please start a new tutorial.'
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
                message: error.message || 'An error occurred during the tutorial'
            });
        }
    }

    private async handleUploadPDF(data: any, webview: vscode.Webview) {
        try {
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
                message: `Failed to process PDF: ${error.message}`
            });
        }
    }

    private handleReset(webview: vscode.Webview) {
        webview.postMessage({
            type: 'reset'
        });
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

        // Try to read the HTML template, fallback to inline HTML if not found
        const htmlPath = path.join(this._extensionUri.fsPath, 'webview', 'index.html');
        let html: string;

        try {
            html = fs.readFileSync(htmlPath, 'utf8');
            // Replace placeholders
            html = html.replace(/{{cspSource}}/g, webview.cspSource);
            // Inject styles and scripts
            html = html.replace('</head>', `<link href="${styleUri}" rel="stylesheet"></head>`);
            html = html.replace('</body>', `<script src="${scriptUri}"></script></body>`);
        } catch (error) {
            console.error('Could not read webview/index.html, using fallback:', error);
            // Fallback inline HTML
            html = this._getFallbackHtml(scriptUri, styleUri, webview.cspSource);
        }

        return html;
    }

    private _getFallbackHtml(scriptUri: vscode.Uri, styleUri: vscode.Uri, cspSource: string): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">
            <link href="${styleUri}" rel="stylesheet">
            <title>Timmy Tutorial</title>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎓 Timmy Tutorial</h1>
                    <p class="subtitle">Your interactive coding tutor</p>
                </div>
                
                <div id="start-view">
                    <div class="input-section">
                        <label for="prompt-input">What would you like to learn?</label>
                        <textarea 
                            id="prompt-input" 
                            placeholder="Example: Teach me how to build a Flask CRUD API with SQLite"
                            rows="4"
                        ></textarea>
                        
                        <div class="button-group">
                            <button id="upload-pdf-btn" class="secondary-btn">📄 Upload PDF</button>
                            <button id="start-btn" class="primary-btn">▶️ Start Tutorial</button>
                        </div>
                        
                        <div class="info-box">
                            <p>💡 <strong>Tip:</strong> You can upload a PDF document to provide additional context.</p>
                        </div>
                    </div>
                </div>

                <div id="tutorial-view" style="display: none;">
                    <div class="tutorial-header">
                        <h2>📚 Tutorial in Progress</h2>
                        <button id="reset-btn" class="icon-btn" title="Start new tutorial">🔄 Reset</button>
                    </div>

                    <div id="code-container">
                        <div class="code-header">
                            <span class="code-label">💻 Code</span>
                            <button id="copy-code-btn" class="icon-btn" title="Copy code">📋 Copy</button>
                        </div>
                        <pre><code id="code-content">// Code will appear here...</code></pre>
                    </div>
                    
                    <div id="explanation-section">
                        <div class="section-header">
                            <span>📖 Explanation & History</span>
                        </div>
                        <div id="explanation-history"></div>
                    </div>
                    
                    <div id="controls">
                        <input type="text" id="question-input" placeholder="Ask a question...">
                        <button id="next-step-btn" class="primary-btn">➡️ Next Step</button>
                        <button id="send-question-btn" class="secondary-btn">💬 Ask</button>
                    </div>
                </div>

                <div id="error-message" style="display: none;">
                    <span class="error-icon">⚠️</span>
                    <span id="error-text"></span>
                </div>

                <div id="loading" style="display: none;">
                    <div class="spinner"></div>
                    <p>Timmy is thinking...</p>
                </div>
            </div>

            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}