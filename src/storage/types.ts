export interface Point {
    x: number;  // Normalized 0-1
    y: number;  // Normalized 0-1
}

export interface Polygon {
    id: string;
    points: Point[];
    color: string;
    label?: string;
    closed: boolean;
}

export interface ROIData {
    version: string;
    imageUri: string;
    imageDimensions: {
        width: number;
        height: number;
    };
    polygons: Polygon[];
    metadata?: {
        createdAt: string;
        modifiedAt: string;
    };
}

export interface EditorState {
    roiData: ROIData;
    currentPolygonId: string | null;
    selectedPolygonId: string | null;
    mode: 'draw' | 'edit' | 'select';
}
