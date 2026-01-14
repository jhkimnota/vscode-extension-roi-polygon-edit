import * as vscode from 'vscode';
import { ROIEditorProvider } from './webview/WebviewProvider';

let editorProvider: ROIEditorProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('ROI Draw extension is now active');

    // Initialize the editor provider
    editorProvider = new ROIEditorProvider(context);

    // Register command to open ROI editor
    const openEditorCommand = vscode.commands.registerCommand('roi-draw.openEditor', async (uri?: vscode.Uri) => {
        // If no URI provided, ask user to select an image
        if (!uri) {
            const fileUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Images': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
                },
                title: 'Select an image to open in ROI Editor'
            });

            if (!fileUris || fileUris.length === 0) {
                return;
            }

            uri = fileUris[0];
        }

        // Validate that it's an image file
        const ext = uri.fsPath.toLowerCase().split('.').pop();
        const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

        if (!ext || !validExtensions.includes(ext)) {
            vscode.window.showErrorMessage('Please select a valid image file (jpg, png, gif, webp, bmp)');
            return;
        }

        // Open the editor
        if (editorProvider) {
            await editorProvider.openEditor(uri);
        }
    });

    context.subscriptions.push(openEditorCommand);
}

export function deactivate() {
    if (editorProvider) {
        editorProvider.dispose();
        editorProvider = undefined;
    }
}
