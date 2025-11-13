import * as vscode from 'vscode';
import { TutorialProvider } from './tutorialProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Timmy Tutorial extension is now active');

    // Register the tutorial provider
    const provider = new TutorialProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'timmy-tutorial.tutorialView',
            provider
        )
    );

    // Register command to start tutorial
    context.subscriptions.push(
        vscode.commands.registerCommand('timmy-tutorial.start', async () => {
            // Check if API key is configured
            const config = vscode.workspace.getConfiguration('timmyTutorial');
            const apiKey = config.get<string>('openaiApiKey');

            if (!apiKey) {
                const choice = await vscode.window.showErrorMessage(
                    'OpenAI API key not configured. Please set it in settings.',
                    'Open Settings'
                );
                if (choice === 'Open Settings') {
                    vscode.commands.executeCommand(
                        'workbench.action.openSettings',
                        'timmyTutorial.openaiApiKey'
                    );
                }
                return;
            }

            // Create and show tutorial panel
            const panel = vscode.window.createWebviewPanel(
                'timmyTutorial',
                'Timmy Tutorial',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            provider.resolveWebviewView(panel.webview, context);
        })
    );
}

export function deactivate() {}