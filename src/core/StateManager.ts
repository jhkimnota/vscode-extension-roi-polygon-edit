import { EditorState } from '../storage/types';

export class StateManager {
    private undoStack: EditorState[] = [];
    private redoStack: EditorState[] = [];
    private currentState: EditorState;
    private maxHistorySize: number;

    constructor(initialState: EditorState, maxHistorySize: number = 50) {
        this.currentState = initialState;
        this.maxHistorySize = maxHistorySize;
    }

    public getCurrentState(): EditorState {
        return this.currentState;
    }

    public pushState(newState: EditorState): void {
        // Deep clone current state and add to undo stack
        this.undoStack.push(this.cloneState(this.currentState));

        // Clear redo stack when new change is made
        this.redoStack = [];

        // Update current state
        this.currentState = newState;

        // Limit stack size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
    }

    public updateCurrentState(newState: EditorState): void {
        // Update current state without pushing to history
        // Used for real-time updates like dragging
        this.currentState = newState;
    }

    public undo(): EditorState | null {
        if (this.undoStack.length === 0) {
            return null;
        }

        // Move current state to redo stack
        this.redoStack.push(this.cloneState(this.currentState));

        // Pop from undo stack
        const previousState = this.undoStack.pop();
        if (previousState) {
            this.currentState = previousState;
            return this.currentState;
        }

        return null;
    }

    public redo(): EditorState | null {
        if (this.redoStack.length === 0) {
            return null;
        }

        // Move current state to undo stack
        this.undoStack.push(this.cloneState(this.currentState));

        // Pop from redo stack
        const nextState = this.redoStack.pop();
        if (nextState) {
            this.currentState = nextState;
            return this.currentState;
        }

        return null;
    }

    public canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    private cloneState(state: EditorState): EditorState {
        // Deep clone using JSON serialization
        // For production, consider using structuredClone if available
        return JSON.parse(JSON.stringify(state));
    }
}
