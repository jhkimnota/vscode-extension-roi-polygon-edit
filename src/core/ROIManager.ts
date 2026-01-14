import { EditorState, Polygon, Point } from '../storage/types';
import { StateManager } from './StateManager';
import { v4 as uuidv4 } from 'uuid';

export class ROIManager {
    private stateManager: StateManager;
    private colors = [
        '#FF5733', '#33FF57', '#3357FF', '#FF33F5',
        '#F5FF33', '#33FFF5', '#FF8C33', '#8C33FF'
    ];
    private colorIndex = 0;

    constructor(initialState: EditorState, maxHistorySize: number = 50) {
        this.stateManager = new StateManager(initialState, maxHistorySize);
    }

    public getState(): EditorState {
        return this.stateManager.getCurrentState();
    }

    public addPoint(x: number, y: number): EditorState {
        const currentState = this.stateManager.getCurrentState();
        const newState = this.cloneState(currentState);

        // Clamp coordinates to 0-1 range
        const point: Point = {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
        };

        // Check if current polygon exists and is open
        let currentPolygon = newState.currentPolygonId
            ? newState.roiData.polygons.find(p => p.id === newState.currentPolygonId)
            : null;

        // If no current polygon, or current polygon is closed, create a new one
        if (!currentPolygon || currentPolygon.closed) {
            const newPolygon: Polygon = {
                id: uuidv4(),
                points: [point],
                color: this.getNextColor(),
                closed: false
            };
            newState.roiData.polygons.push(newPolygon);
            newState.currentPolygonId = newPolygon.id;
        } else {
            // Add point to current polygon (only if it's open)
            currentPolygon.points.push(point);
        }

        this.stateManager.pushState(newState);
        return newState;
    }

    public closePolygon(): EditorState {
        const currentState = this.stateManager.getCurrentState();
        const newState = this.cloneState(currentState);

        if (newState.currentPolygonId) {
            const currentPolygon = newState.roiData.polygons.find(p => p.id === newState.currentPolygonId);
            if (currentPolygon && currentPolygon.points.length >= 3) {
                currentPolygon.closed = true;
                newState.currentPolygonId = null;
            }
        }

        this.stateManager.pushState(newState);
        return newState;
    }

    public cancelCurrentPolygon(): EditorState {
        const currentState = this.stateManager.getCurrentState();
        const newState = this.cloneState(currentState);

        if (newState.currentPolygonId) {
            // Remove the incomplete polygon
            newState.roiData.polygons = newState.roiData.polygons.filter(p => p.id !== newState.currentPolygonId);
            newState.currentPolygonId = null;
        }

        this.stateManager.pushState(newState);
        return newState;
    }

    public deletePolygon(polygonId: string): EditorState {
        const currentState = this.stateManager.getCurrentState();
        const newState = this.cloneState(currentState);

        newState.roiData.polygons = newState.roiData.polygons.filter(p => p.id !== polygonId);

        if (newState.currentPolygonId === polygonId) {
            newState.currentPolygonId = null;
        }

        if (newState.selectedPolygonId === polygonId) {
            newState.selectedPolygonId = null;
        }

        this.stateManager.pushState(newState);
        return newState;
    }

    public updatePoint(polygonId: string, pointIndex: number, x: number, y: number, isDragging: boolean = false): EditorState {
        const currentState = this.stateManager.getCurrentState();
        const newState = this.cloneState(currentState);

        const polygon = newState.roiData.polygons.find(p => p.id === polygonId);
        if (polygon && pointIndex >= 0 && pointIndex < polygon.points.length) {
            polygon.points[pointIndex] = {
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y))
            };
        }

        // Only push to history when drag is complete
        if (isDragging) {
            this.stateManager.updateCurrentState(newState);
        } else {
            this.stateManager.pushState(newState);
        }
        return newState;
    }

    public movePolygon(polygonId: string, deltaX: number, deltaY: number, isDragging: boolean = false): EditorState {
        const currentState = this.stateManager.getCurrentState();
        const newState = this.cloneState(currentState);

        const polygon = newState.roiData.polygons.find(p => p.id === polygonId);
        if (polygon) {
            polygon.points = polygon.points.map(point => ({
                x: Math.max(0, Math.min(1, point.x + deltaX)),
                y: Math.max(0, Math.min(1, point.y + deltaY))
            }));
        }

        // Only push to history when drag is complete
        if (isDragging) {
            this.stateManager.updateCurrentState(newState);
        } else {
            this.stateManager.pushState(newState);
        }
        return newState;
    }

    public finalizeDrag(): EditorState {
        // Push current state to history when drag is complete
        // Current state already has the final positions from isDragging updates
        const currentState = this.stateManager.getCurrentState();
        this.stateManager.pushState(this.cloneState(currentState));
        return currentState;
    }

    public selectPolygon(polygonId: string | null): EditorState {
        const currentState = this.stateManager.getCurrentState();
        const newState = this.cloneState(currentState);

        newState.selectedPolygonId = polygonId;

        // Don't push to history for selection changes
        // Just update the current state
        return newState;
    }

    public setMode(mode: 'draw' | 'edit' | 'select'): EditorState {
        const currentState = this.stateManager.getCurrentState();
        const newState = this.cloneState(currentState);

        newState.mode = mode;

        return newState;
    }

    public undo(): EditorState | null {
        return this.stateManager.undo();
    }

    public redo(): EditorState | null {
        return this.stateManager.redo();
    }

    public canUndo(): boolean {
        return this.stateManager.canUndo();
    }

    public canRedo(): boolean {
        return this.stateManager.canRedo();
    }

    private getNextColor(): string {
        const color = this.colors[this.colorIndex];
        this.colorIndex = (this.colorIndex + 1) % this.colors.length;
        return color;
    }

    private cloneState(state: EditorState): EditorState {
        return JSON.parse(JSON.stringify(state));
    }
}
