// Canvas drawing and interaction logic

class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.image = null;
        this.imageLoaded = false;
        this.imageDimensions = { width: 0, height: 0 };
        this.displayDimensions = { width: 0, height: 0 };
        this.state = null;
        this.currentMousePos = null;
        this.hoveredVertex = null;
        this.draggedVertex = null;
        this.draggedPolygon = null;
        this.dragStartPos = null;
        this.vertexSize = 6;
        this.lineWidth = 2;
    }

    async loadImage(imageUri, imageDimensions) {
        return new Promise((resolve, reject) => {
            this.image = new Image();
            this.imageDimensions = imageDimensions;

            this.image.onload = () => {
                this.imageLoaded = true;
                this.resizeCanvas();
                this.render();
                resolve();
            };

            this.image.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            this.image.src = imageUri;
        });
    }

    resizeCanvas() {
        if (!this.image) return;

        const containerWidth = this.canvas.parentElement.clientWidth - 40;
        const containerHeight = this.canvas.parentElement.clientHeight - 40;

        // Calculate aspect ratio
        const imageAspect = this.imageDimensions.width / this.imageDimensions.height;
        const containerAspect = containerWidth / containerHeight;

        if (containerAspect > imageAspect) {
            // Container is wider
            this.displayDimensions.height = Math.min(containerHeight, this.imageDimensions.height);
            this.displayDimensions.width = this.displayDimensions.height * imageAspect;
        } else {
            // Container is taller
            this.displayDimensions.width = Math.min(containerWidth, this.imageDimensions.width);
            this.displayDimensions.height = this.displayDimensions.width / imageAspect;
        }

        this.canvas.width = this.displayDimensions.width;
        this.canvas.height = this.displayDimensions.height;
    }

    screenToNormalized(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (screenX - rect.left) / this.displayDimensions.width;
        const y = (screenY - rect.top) / this.displayDimensions.height;

        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
        };
    }

    normalizedToScreen(point) {
        return {
            x: point.x * this.displayDimensions.width,
            y: point.y * this.displayDimensions.height
        };
    }

    updateState(state) {
        this.state = state;
        this.render();
    }

    render() {
        if (!this.imageLoaded || !this.state) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw image
        this.ctx.drawImage(this.image, 0, 0, this.displayDimensions.width, this.displayDimensions.height);

        // Draw polygons
        this.state.roiData.polygons.forEach(polygon => {
            this.drawPolygon(polygon, polygon.id === this.state.selectedPolygonId);
        });

        // Draw preview line if in draw mode
        if (this.state.mode === 'draw' && this.currentMousePos) {
            const currentPolygon = this.state.roiData.polygons.find(p => p.id === this.state.currentPolygonId);
            if (currentPolygon && currentPolygon.points.length > 0 && !currentPolygon.closed) {
                const lastPoint = this.normalizedToScreen(currentPolygon.points[currentPolygon.points.length - 1]);

                this.ctx.beginPath();
                this.ctx.moveTo(lastPoint.x, lastPoint.y);
                this.ctx.lineTo(this.currentMousePos.x, this.currentMousePos.y);
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.lineWidth = 1;
                this.ctx.setLineDash([5, 5]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        }
    }

    drawPolygon(polygon, isSelected) {
        if (polygon.points.length === 0) return;

        const alpha = isSelected ? 0.3 : 0.2;
        const strokeAlpha = isSelected ? 1.0 : 0.8;

        // Draw filled polygon if closed
        if (polygon.closed && polygon.points.length >= 3) {
            this.ctx.beginPath();
            const firstPoint = this.normalizedToScreen(polygon.points[0]);
            this.ctx.moveTo(firstPoint.x, firstPoint.y);

            for (let i = 1; i < polygon.points.length; i++) {
                const point = this.normalizedToScreen(polygon.points[i]);
                this.ctx.lineTo(point.x, point.y);
            }

            this.ctx.closePath();

            // Fill
            const fillColor = this.hexToRgba(polygon.color, alpha);
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();
        }

        // Draw edges
        this.ctx.beginPath();
        const firstPoint = this.normalizedToScreen(polygon.points[0]);
        this.ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < polygon.points.length; i++) {
            const point = this.normalizedToScreen(polygon.points[i]);
            this.ctx.lineTo(point.x, point.y);
        }

        if (polygon.closed) {
            this.ctx.closePath();
        }

        const strokeColor = this.hexToRgba(polygon.color, strokeAlpha);
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.stroke();

        // Draw vertices
        polygon.points.forEach((point, index) => {
            const screenPoint = this.normalizedToScreen(point);
            this.drawVertex(screenPoint.x, screenPoint.y, polygon.color, isSelected);
        });
    }

    drawVertex(x, y, color, isSelected) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.vertexSize, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();

        if (isSelected) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    findVertexAtPosition(x, y) {
        if (!this.state) return null;

        const threshold = this.vertexSize + 3;

        for (const polygon of this.state.roiData.polygons) {
            for (let i = 0; i < polygon.points.length; i++) {
                const screenPoint = this.normalizedToScreen(polygon.points[i]);
                const distance = Math.sqrt(
                    Math.pow(screenPoint.x - x, 2) + Math.pow(screenPoint.y - y, 2)
                );

                if (distance <= threshold) {
                    return { polygonId: polygon.id, pointIndex: i };
                }
            }
        }

        return null;
    }

    findPolygonAtPosition(x, y) {
        if (!this.state) return null;

        const normalizedPoint = this.screenToNormalized(x, y);

        // Check polygons in reverse order (top to bottom)
        for (let i = this.state.roiData.polygons.length - 1; i >= 0; i--) {
            const polygon = this.state.roiData.polygons[i];
            if (polygon.closed && this.isPointInPolygon(normalizedPoint, polygon.points)) {
                return polygon.id;
            }
        }

        return null;
    }

    isPointInPolygon(point, vertices) {
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i].x, yi = vertices[i].y;
            const xj = vertices[j].x, yj = vertices[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    setCurrentMousePos(x, y) {
        this.currentMousePos = { x, y };
    }

    clearCurrentMousePos() {
        this.currentMousePos = null;
    }

    startDraggingVertex(vertex) {
        this.draggedVertex = vertex;
    }

    startDraggingPolygon(polygonId, startX, startY) {
        this.draggedPolygon = polygonId;
        this.dragStartPos = this.screenToNormalized(startX, startY);
    }

    updatePolygonDrag(currentX, currentY) {
        if (!this.draggedPolygon || !this.dragStartPos) return null;

        const currentPos = this.screenToNormalized(currentX, currentY);
        const deltaX = currentPos.x - this.dragStartPos.x;
        const deltaY = currentPos.y - this.dragStartPos.y;

        this.dragStartPos = currentPos;

        return { deltaX, deltaY };
    }

    stopDragging() {
        this.draggedVertex = null;
        this.draggedPolygon = null;
        this.dragStartPos = null;
    }

    isDraggingVertex() {
        return this.draggedVertex !== null;
    }

    isDraggingPolygon() {
        return this.draggedPolygon !== null;
    }
}
