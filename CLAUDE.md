# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run compile          # Build extension with webpack
npm run watch           # Watch mode for development
npm run package         # Production build with source maps
npm run lint            # Run ESLint on src/
npm run test            # Run tests (requires compile-tests first)
npm run compile-tests   # Compile TypeScript tests to out/
```

To debug the extension: Press F5 in VS Code to launch Extension Development Host.

## Architecture Overview

This is a VS Code extension for drawing and editing polygon ROI (Region of Interest) annotations on images. All polygon coordinates are stored normalized (0-1 range) for resolution independence.

### Core Data Flow

```
User Interaction (Webview) → MessageFromWebview → ROIEditorProvider → ROIManager → StateManager
                          ← MessageToWebview   ←                    ←           ←
```

### Key Components

**Extension Layer** (`src/extension.ts`)
- Registers the `roi-draw.openEditor` command
- Supports right-click context menu on image files

**WebviewProvider** (`src/webview/WebviewProvider.ts`)
- Manages webview panel lifecycle (one panel per image)
- Handles bidirectional message passing between extension and webview
- Creates ROIManager instance per editor

**ROIManager** (`src/core/ROIManager.ts`)
- Business logic for polygon operations (add point, close, delete, move)
- All coordinate operations clamp to 0-1 range
- Delegates state history to StateManager

**StateManager** (`src/core/StateManager.ts`)
- Immutable state pattern with undo/redo stacks
- `pushState()` for undoable changes
- `updateCurrentState()` for real-time updates during drag (no history)

**ROIStorage** (`src/storage/ROIStorage.ts`)
- Saves ROI data as `{imagename}.roi.json` alongside the image
- Version `1.0.0` format

**Message Types** (`src/webview/messages.ts`)
- `MessageToWebview`: init, stateUpdated, error
- `MessageFromWebview`: addPoint, closePolygon, updatePoint, movePolygon, undo/redo, save/export

### Webview Assets

Located in `media/webview/`:
- `main.js` - UI logic and message handling
- `canvas.js` - Canvas rendering for polygons
- `styles.css` - Editor styling

### Editor Modes

Three modes: `draw`, `edit`, `select` (controlled via `EditorState.mode`)
- Draw: Click to add points, double-click or close to finish polygon
- Edit: Drag vertices to modify polygon shape
- Select: Click polygons to select, view/copy JSON data
