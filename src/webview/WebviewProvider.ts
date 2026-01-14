import * as vscode from 'vscode';
import * as path from 'path';
import { ROIManager } from '../core/ROIManager';
import { ROIStorage } from '../storage/ROIStorage';
import { EditorState } from '../storage/types';
import { MessageFromWebview, MessageToWebview } from './messages';

export class ROIEditorProvider {
    private panels: Map<string, vscode.WebviewPanel> = new Map();
    private roiManagers: Map<string, ROIManager> = new Map();
    private roiStorage: ROIStorage;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.roiStorage = new ROIStorage();
    }

    public async openEditor(imageUri: vscode.Uri): Promise<void> {
        const panelKey = imageUri.toString();

        // If panel already exists, reveal it
        if (this.panels.has(panelKey)) {
            this.panels.get(panelKey)!.reveal();
            return;
        }

        // Create new webview panel
        const panel = vscode.window.createWebviewPanel(
            'roiEditor',
            `ROI Editor - ${path.basename(imageUri.fsPath)}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
                    vscode.Uri.file(path.dirname(imageUri.fsPath))
                ]
            }
        );

        // Set HTML content
        panel.webview.html = this.getHtmlForWebview(panel.webview, imageUri);

        // Store panel
        this.panels.set(panelKey, panel);

        // Load existing ROI data or create new
        const existingData = await this.roiStorage.load(imageUri);
        const imageData = await this.getImageDimensions(imageUri);

        const initialState: EditorState = existingData ? {
            roiData: existingData,
            currentPolygonId: null,
            selectedPolygonId: null,
            mode: 'draw'
        } : {
            roiData: {
                version: '1.0.0',
                imageUri: imageUri.toString(),
                imageDimensions: imageData,
                polygons: []
            },
            currentPolygonId: null,
            selectedPolygonId: null,
            mode: 'draw'
        };

        // Create ROI manager
        const config = vscode.workspace.getConfiguration('roiDraw');
        const maxHistory = config.get<number>('maxUndoHistory', 50);
        const roiManager = new ROIManager(initialState, maxHistory);
        this.roiManagers.set(panelKey, roiManager);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async (message: MessageFromWebview) => {
                await this.handleMessage(panelKey, imageUri, message, panel.webview);
            },
            undefined,
            this.context.subscriptions
        );

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            this.panels.delete(panelKey);
            this.roiManagers.delete(panelKey);
        }, undefined, this.context.subscriptions);

        // Send initialization message
        const imageUriForWebview = panel.webview.asWebviewUri(imageUri);
        const initMessage: MessageToWebview = {
            type: 'init',
            imageUri: imageUriForWebview.toString(),
            roiData: existingData,
            imageDimensions: imageData
        };
        panel.webview.postMessage(initMessage);
    }

    private async handleMessage(
        panelKey: string,
        imageUri: vscode.Uri,
        message: MessageFromWebview,
        webview: vscode.Webview
    ): Promise<void> {
        const roiManager = this.roiManagers.get(panelKey);
        if (!roiManager) {
            return;
        }

        try {
            let newState: EditorState | null = null;

            switch (message.type) {
                case 'ready':
                    // Webview is ready
                    break;

                case 'addPoint':
                    newState = roiManager.addPoint(message.x, message.y);
                    break;

                case 'closePolygon':
                    newState = roiManager.closePolygon();
                    break;

                case 'cancelCurrentPolygon':
                    newState = roiManager.cancelCurrentPolygon();
                    break;

                case 'selectPolygon':
                    newState = roiManager.selectPolygon(message.polygonId);
                    break;

                case 'deletePolygon':
                    newState = roiManager.deletePolygon(message.polygonId);
                    break;

                case 'updatePoint':
                    newState = roiManager.updatePoint(message.polygonId, message.pointIndex, message.x, message.y, message.isDragging);
                    break;

                case 'movePolygon':
                    newState = roiManager.movePolygon(message.polygonId, message.deltaX, message.deltaY, message.isDragging);
                    break;

                case 'finalizeDrag':
                    newState = roiManager.finalizeDrag();
                    break;

                case 'undo':
                    newState = roiManager.undo();
                    break;

                case 'redo':
                    newState = roiManager.redo();
                    break;

                case 'setMode':
                    newState = roiManager.setMode(message.mode);
                    break;

                case 'save':
                    await this.roiStorage.save(imageUri, roiManager.getState().roiData);
                    vscode.window.showInformationMessage('ROI data saved successfully');
                    break;

                case 'export':
                    await this.roiStorage.exportToClipboard(roiManager.getState().roiData);
                    break;
            }

            // Send updated state to webview
            if (newState) {
                const stateMessage: MessageToWebview = {
                    type: 'stateUpdated',
                    state: newState
                };
                webview.postMessage(stateMessage);
            }

        } catch (error) {
            const errorMessage: MessageToWebview = {
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            };
            webview.postMessage(errorMessage);
            vscode.window.showErrorMessage(`ROI Editor Error: ${error}`);
        }
    }

    private async getImageDimensions(_imageUri: vscode.Uri): Promise<{ width: number; height: number }> {
        // For now, return default dimensions
        // In a real implementation, you might want to read the actual image dimensions
        return { width: 1920, height: 1080 };
    }

    private getHtmlForWebview(webview: vscode.Webview, _imageUri: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'main.js'));
        const canvasScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'canvas.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'styles.css'));

        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
    <link href="${styleUri}" rel="stylesheet">
    <title>ROI Editor</title>
</head>
<body>
    <div id="container">
        <div id="toolbar">
            <button id="drawBtn" class="toolbar-btn active">Draw</button>
            <button id="editBtn" class="toolbar-btn">Edit</button>
            <button id="selectBtn" class="toolbar-btn">Select</button>
            <div class="separator"></div>
            <button id="undoBtn" class="toolbar-btn">Undo</button>
            <button id="redoBtn" class="toolbar-btn">Redo</button>
            <div class="separator"></div>
            <button id="saveBtn" class="toolbar-btn">Save</button>
            <button id="exportBtn" class="toolbar-btn">Export</button>
        </div>

        <div id="main-content">
            <div id="canvas-container">
                <canvas id="canvas"></canvas>
            </div>

            <div id="sidebar">
                <div id="polygons-section">
                    <h3>Polygons</h3>
                    <div id="polygons-list"></div>
                </div>

                <div id="coordinates-section">
                    <h3>Current Point</h3>
                    <div id="coordinates">
                        <div>X: <span id="coord-x">-</span></div>
                        <div>Y: <span id="coord-y">-</span></div>
                    </div>
                </div>

                <div id="info-section">
                    <h3>Info</h3>
                    <div id="info-text">Click on canvas to add points. Double-click to close polygon.</div>
                </div>

                <div id="polygon-data-section">
                    <h3>Selected Polygon Data</h3>
                    <div id="polygon-data-wrapper">
                        <textarea id="polygon-data" readonly></textarea>
                        <button id="copy-polygon-btn" class="toolbar-btn">Copy JSON</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="${canvasScriptUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public dispose(): void {
        this.panels.forEach(panel => panel.dispose());
        this.panels.clear();
        this.roiManagers.clear();
    }
}
