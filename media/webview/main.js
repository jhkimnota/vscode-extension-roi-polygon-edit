// Main webview script

(function() {
    const vscode = acquireVsCodeApi();
    const canvas = document.getElementById('canvas');
    const renderer = new CanvasRenderer(canvas);

    let currentState = null;

    // UI Elements
    const drawBtn = document.getElementById('drawBtn');
    const editBtn = document.getElementById('editBtn');
    const selectBtn = document.getElementById('selectBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const saveBtn = document.getElementById('saveBtn');
    const exportBtn = document.getElementById('exportBtn');
    const polygonsList = document.getElementById('polygons-list');
    const coordX = document.getElementById('coord-x');
    const coordY = document.getElementById('coord-y');
    const infoText = document.getElementById('info-text');
    const polygonData = document.getElementById('polygon-data');
    const copyPolygonBtn = document.getElementById('copy-polygon-btn');

    // Mode buttons
    drawBtn.addEventListener('click', () => setMode('draw'));
    editBtn.addEventListener('click', () => setMode('edit'));
    selectBtn.addEventListener('click', () => setMode('select'));

    // Action buttons
    undoBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'undo' });
    });

    redoBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'redo' });
    });

    saveBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'save' });
    });

    exportBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'export' });
    });

    copyPolygonBtn.addEventListener('click', () => {
        if (polygonData.value) {
            navigator.clipboard.writeText(polygonData.value).then(() => {
                // Visual feedback
                const originalText = copyPolygonBtn.textContent;
                copyPolygonBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyPolygonBtn.textContent = originalText;
                }, 1500);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }
    });

    // Canvas events
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('dblclick', handleCanvasDblClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

    // Keyboard events
    window.addEventListener('keydown', handleKeyDown);

    // Message handling
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
            case 'init':
                handleInit(message);
                break;

            case 'stateUpdated':
                handleStateUpdate(message.state);
                break;

            case 'error':
                console.error('Error from extension:', message.message);
                break;
        }
    });

    async function handleInit(message) {
        try {
            await renderer.loadImage(message.imageUri, message.imageDimensions);

            // Always create initial state
            const initialState = {
                roiData: message.roiData || {
                    version: '1.0.0',
                    imageUri: message.imageUri,
                    imageDimensions: message.imageDimensions,
                    polygons: []
                },
                currentPolygonId: null,
                selectedPolygonId: null,
                mode: 'draw'
            };
            handleStateUpdate(initialState);

            vscode.postMessage({ type: 'ready' });
        } catch (error) {
            console.error('Failed to initialize:', error);
        }
    }

    function handleStateUpdate(state) {
        currentState = state;
        renderer.updateState(state);
        updateUI();
    }

    let dragStarted = false;
    let lastMouseUpTime = 0;
    let lastClickTime = 0;
    let lastClickPos = null;

    function handleCanvasClick(event) {
        if (!currentState) return;

        // Prevent click immediately after mouseup (within 100ms)
        const timeSinceMouseUp = Date.now() - lastMouseUpTime;
        if (timeSinceMouseUp < 100) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // Prevent click after drag
        if (dragStarted) {
            event.preventDefault();
            event.stopPropagation();
            dragStarted = false;
            return;
        }

        // Ignore clicks in edit mode (handled by mousedown/mouseup)
        if (currentState.mode === 'edit') {
            event.preventDefault();
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        // Prevent second click of double-click from adding extra point
        const now = Date.now();
        const currentPos = { x: x, y: y };

        if (lastClickTime && (now - lastClickTime) < 300 && lastClickPos) {
            const distance = Math.sqrt(
                Math.pow(currentPos.x - lastClickPos.x, 2) +
                Math.pow(currentPos.y - lastClickPos.y, 2)
            );

            // If clicking at same location within 300ms, it's a double-click
            if (distance < 5) {
                event.preventDefault();
                event.stopPropagation();
                lastClickTime = 0;  // Reset to allow next click
                lastClickPos = null;
                return;
            }
        }

        lastClickTime = now;
        lastClickPos = currentPos;

        if (currentState.mode === 'draw') {
            const normalized = renderer.screenToNormalized(x, y);
            vscode.postMessage({
                type: 'addPoint',
                x: normalized.x,
                y: normalized.y
            });
        } else if (currentState.mode === 'select') {
            const polygonId = renderer.findPolygonAtPosition(x, y);
            vscode.postMessage({
                type: 'selectPolygon',
                polygonId: polygonId
            });
        }
    }

    function handleCanvasDblClick(event) {
        if (!currentState || currentState.mode !== 'draw') return;

        event.preventDefault();

        vscode.postMessage({ type: 'closePolygon' });
    }

    function handleCanvasMouseMove(event) {
        if (!currentState) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        // Update coordinates display
        const normalized = renderer.screenToNormalized(x, y);
        coordX.textContent = normalized.x.toFixed(4);
        coordY.textContent = normalized.y.toFixed(4);

        // Update preview
        renderer.setCurrentMousePos(x - rect.left, y - rect.top);

        // Handle vertex dragging
        if (renderer.isDraggingVertex()) {
            vscode.postMessage({
                type: 'updatePoint',
                polygonId: renderer.draggedVertex.polygonId,
                pointIndex: renderer.draggedVertex.pointIndex,
                x: normalized.x,
                y: normalized.y,
                isDragging: true
            });
        }
        // Handle polygon dragging
        else if (renderer.isDraggingPolygon()) {
            const delta = renderer.updatePolygonDrag(x, y);
            if (delta) {
                vscode.postMessage({
                    type: 'movePolygon',
                    polygonId: renderer.draggedPolygon,
                    deltaX: delta.deltaX,
                    deltaY: delta.deltaY,
                    isDragging: true
                });
            }
        }
        // Update cursor on hover in edit mode
        else if (currentState.mode === 'edit') {
            const vertex = renderer.findVertexAtPosition(x - rect.left, y - rect.top);
            if (vertex) {
                canvas.style.cursor = 'grab';
            } else {
                const polygonId = renderer.findPolygonAtPosition(x, y);
                if (polygonId) {
                    canvas.style.cursor = 'move';
                } else {
                    canvas.style.cursor = 'default';
                }
            }
        }

        renderer.render();
    }

    function handleCanvasMouseDown(event) {
        if (!currentState || currentState.mode !== 'edit') return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        // First check if clicking on a vertex
        const vertex = renderer.findVertexAtPosition(x - rect.left, y - rect.top);
        if (vertex) {
            dragStarted = true;
            renderer.startDraggingVertex(vertex);
            canvas.style.cursor = 'grabbing';
            event.preventDefault();
            return;
        }

        // If not on vertex, check if clicking inside a polygon
        const polygonId = renderer.findPolygonAtPosition(x, y);
        if (polygonId) {
            dragStarted = true;
            renderer.startDraggingPolygon(polygonId, x, y);
            canvas.style.cursor = 'grabbing';
            event.preventDefault();
        }
    }

    function handleCanvasMouseUp(event) {
        if (renderer.isDraggingVertex() || renderer.isDraggingPolygon()) {
            // Mark the time of mouseup to prevent immediate click
            lastMouseUpTime = Date.now();

            // Finalize drag - push to history
            vscode.postMessage({ type: 'finalizeDrag' });

            renderer.stopDragging();

            // Reset cursor based on mode and position
            if (currentState.mode === 'draw') {
                canvas.style.cursor = 'crosshair';
            } else if (currentState.mode === 'edit') {
                // Check what's under the cursor after releasing
                const rect = canvas.getBoundingClientRect();
                const x = event.clientX;
                const y = event.clientY;
                const vertex = renderer.findVertexAtPosition(x - rect.left, y - rect.top);
                if (vertex) {
                    canvas.style.cursor = 'grab';
                } else {
                    const polygonId = renderer.findPolygonAtPosition(x, y);
                    canvas.style.cursor = polygonId ? 'move' : 'default';
                }
            } else {
                canvas.style.cursor = 'default';
            }

            event.preventDefault();
            event.stopPropagation();
        }
    }

    function handleCanvasMouseLeave(event) {
        // If dragging when leaving, finalize the drag
        if (renderer.isDraggingVertex() || renderer.isDraggingPolygon()) {
            vscode.postMessage({ type: 'finalizeDrag' });
            renderer.stopDragging();
            dragStarted = false;
        }

        renderer.clearCurrentMousePos();
        renderer.render();
        coordX.textContent = '-';
        coordY.textContent = '-';
    }

    function handleKeyDown(event) {
        if (!currentState) return;

        // Ctrl+Z / Cmd+Z - Undo
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            vscode.postMessage({ type: 'undo' });
        }
        // Ctrl+Shift+Z / Cmd+Shift+Z - Redo
        else if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
            event.preventDefault();
            vscode.postMessage({ type: 'redo' });
        }
        // Ctrl+S / Cmd+S - Save
        else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            vscode.postMessage({ type: 'save' });
        }
        // Delete / Backspace - Delete selected polygon
        else if ((event.key === 'Delete' || event.key === 'Backspace') && currentState.selectedPolygonId) {
            event.preventDefault();
            vscode.postMessage({
                type: 'deletePolygon',
                polygonId: currentState.selectedPolygonId
            });
        }
        // Escape - Cancel current operation
        else if (event.key === 'Escape') {
            if (currentState.currentPolygonId) {
                // In draw mode, cancel the current polygon being drawn
                vscode.postMessage({ type: 'cancelCurrentPolygon' });
            } else if (currentState.selectedPolygonId) {
                vscode.postMessage({ type: 'selectPolygon', polygonId: null });
            }
        }
    }

    function setMode(mode) {
        vscode.postMessage({ type: 'setMode', mode });

        // Update button states
        drawBtn.classList.toggle('active', mode === 'draw');
        editBtn.classList.toggle('active', mode === 'edit');
        selectBtn.classList.toggle('active', mode === 'select');

        // Update cursor
        if (mode === 'draw') {
            canvas.style.cursor = 'crosshair';
        } else {
            canvas.style.cursor = 'default';
        }

        // Update info text
        if (mode === 'draw') {
            infoText.textContent = 'Click to add points. Double-click to close polygon.';
        } else if (mode === 'edit') {
            infoText.textContent = 'Click and drag vertices to move them.';
        } else {
            infoText.textContent = 'Click on a polygon to select it.';
        }
    }

    function updateUI() {
        if (!currentState) return;

        // Update polygons list
        polygonsList.innerHTML = '';

        currentState.roiData.polygons.forEach((polygon, index) => {
            const item = document.createElement('div');
            item.className = 'polygon-item';
            if (polygon.id === currentState.selectedPolygonId) {
                item.classList.add('selected');
            }

            const colorDiv = document.createElement('div');
            colorDiv.className = 'polygon-color';
            colorDiv.style.backgroundColor = polygon.color;

            const label = document.createElement('div');
            label.className = 'polygon-label';
            label.textContent = polygon.label || `Polygon ${index + 1}`;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'polygon-delete';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Delete polygon';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                vscode.postMessage({
                    type: 'deletePolygon',
                    polygonId: polygon.id
                });
            };

            item.onclick = () => {
                vscode.postMessage({
                    type: 'selectPolygon',
                    polygonId: polygon.id
                });
            };

            item.appendChild(colorDiv);
            item.appendChild(label);
            item.appendChild(deleteBtn);
            polygonsList.appendChild(item);
        });

        // Update mode buttons
        drawBtn.classList.toggle('active', currentState.mode === 'draw');
        editBtn.classList.toggle('active', currentState.mode === 'edit');
        selectBtn.classList.toggle('active', currentState.mode === 'select');

        // Update cursor based on mode (only if not dragging)
        if (!renderer.isDraggingVertex() && !renderer.isDraggingPolygon()) {
            if (currentState.mode === 'draw') {
                canvas.style.cursor = 'crosshair';
            } else {
                canvas.style.cursor = 'default';
            }
        }

        // Update info text based on mode
        if (currentState.mode === 'draw') {
            infoText.textContent = 'Click to add points. Double-click to close polygon.';
        } else if (currentState.mode === 'edit') {
            infoText.textContent = 'Click and drag vertices or polygons to move them.';
        } else {
            infoText.textContent = 'Click on a polygon to select it.';
        }

        // Update polygon data display
        updatePolygonDataDisplay();
    }

    function updatePolygonDataDisplay() {
        if (!currentState || !currentState.selectedPolygonId) {
            polygonData.value = '';
            copyPolygonBtn.disabled = true;
            return;
        }

        const selectedPolygon = currentState.roiData.polygons.find(
            p => p.id === currentState.selectedPolygonId
        );

        if (selectedPolygon) {
            polygonData.value = JSON.stringify(selectedPolygon, null, 2);
            copyPolygonBtn.disabled = false;
        } else {
            polygonData.value = '';
            copyPolygonBtn.disabled = true;
        }
    }

    // Window resize handler
    window.addEventListener('resize', () => {
        renderer.resizeCanvas();
        renderer.render();
    });
})();
