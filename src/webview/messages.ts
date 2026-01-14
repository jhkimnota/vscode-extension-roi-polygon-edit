import { EditorState, ROIData } from '../storage/types';

export type MessageToWebview =
    | { type: 'init'; imageUri: string; roiData: ROIData | null; imageDimensions: { width: number; height: number } }
    | { type: 'stateUpdated'; state: EditorState }
    | { type: 'error'; message: string };

export type MessageFromWebview =
    | { type: 'ready' }
    | { type: 'addPoint'; x: number; y: number }
    | { type: 'closePolygon' }
    | { type: 'cancelCurrentPolygon' }
    | { type: 'selectPolygon'; polygonId: string | null }
    | { type: 'deletePolygon'; polygonId: string }
    | { type: 'updatePoint'; polygonId: string; pointIndex: number; x: number; y: number; isDragging?: boolean }
    | { type: 'movePolygon'; polygonId: string; deltaX: number; deltaY: number; isDragging?: boolean }
    | { type: 'finalizeDrag' }
    | { type: 'undo' }
    | { type: 'redo' }
    | { type: 'save' }
    | { type: 'export' }
    | { type: 'setMode'; mode: 'draw' | 'edit' | 'select' };
