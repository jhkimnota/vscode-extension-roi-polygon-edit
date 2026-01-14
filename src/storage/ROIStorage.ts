import * as vscode from 'vscode';
import * as path from 'path';
import { ROIData } from './types';

export class ROIStorage {
    public async save(imageUri: vscode.Uri, roiData: ROIData): Promise<void> {
        const roiFilePath = this.getROIFilePath(imageUri);

        // Update metadata
        const dataToSave: ROIData = {
            ...roiData,
            metadata: {
                createdAt: roiData.metadata?.createdAt || new Date().toISOString(),
                modifiedAt: new Date().toISOString()
            }
        };

        const json = JSON.stringify(dataToSave, null, 2);

        try {
            await vscode.workspace.fs.writeFile(roiFilePath, Buffer.from(json, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to save ROI data: ${error}`);
        }
    }

    public async load(imageUri: vscode.Uri): Promise<ROIData | null> {
        const roiFilePath = this.getROIFilePath(imageUri);

        try {
            const content = await vscode.workspace.fs.readFile(roiFilePath);
            const data = JSON.parse(content.toString()) as ROIData;

            // Validate version
            if (!data.version || data.version !== '1.0.0') {
                vscode.window.showWarningMessage('ROI file version mismatch. Data may not load correctly.');
            }

            return data;
        } catch (error) {
            // File doesn't exist or couldn't be read
            return null;
        }
    }

    public async exists(imageUri: vscode.Uri): Promise<boolean> {
        const roiFilePath = this.getROIFilePath(imageUri);

        try {
            await vscode.workspace.fs.stat(roiFilePath);
            return true;
        } catch {
            return false;
        }
    }

    public getROIFilePath(imageUri: vscode.Uri): vscode.Uri {
        const dir = path.dirname(imageUri.fsPath);
        const baseName = path.basename(imageUri.fsPath, path.extname(imageUri.fsPath));
        const roiFileName = `${baseName}.roi.json`;

        return vscode.Uri.file(path.join(dir, roiFileName));
    }

    public async exportToClipboard(roiData: ROIData): Promise<void> {
        const json = JSON.stringify(roiData, null, 2);
        await vscode.env.clipboard.writeText(json);
        vscode.window.showInformationMessage('ROI data copied to clipboard');
    }
}
