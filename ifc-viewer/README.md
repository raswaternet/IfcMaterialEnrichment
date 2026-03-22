# IFC Viewer

A web-based IFC (Industry Foundation Classes) viewer built with TypeScript, Three.js, and ThatOpen components. This viewer allows you to load, visualize, and interact with IFC BIM models directly in your browser.

## Features

- **IFC Model Loading**: Load multiple IFC files simultaneously
- **3D Visualization**: Powered by Three.js and ThatOpen's rendering engine
- **Interactive Selection**: Click on objects to view their properties
- **View Controls**: 
  - Adjustable background color
  - Configurable directional and ambient lighting
  - Orthographic and perspective camera modes
- **Fragment Management**: Export models as optimized fragments for faster loading
- **Auto-load**: Automatically loads IFC models from the `/public/models/` directory

## Tech Stack

- **Frontend Framework**: React + TypeScript
- **Build Tool**: Vite 7.1.9
- **3D Engine**: Three.js 0.180.0
- **BIM Components**: 
  - @thatopen/components 3.3.2
  - @thatopen/components-front 3.3.1
  - @thatopen/ui 3.3.3
- **IFC Processing**: web-ifc 0.0.71 (via CDN)

## Getting Started

### Installation

```bash
# Install dependencies
yarn install
```

### Development

```bash
# Start development server
yarn dev

# Server will run on http://localhost:5174
```

### Building

```bash
# Build for production
yarn build

# Preview production build
yarn preview
```

## Architecture

The application follows a monolithic pattern with plans for modularization:

- **Components Initialization**: Sets up ThatOpen components system
- **World Setup**: Creates 3D scene, camera, renderer
- **Fragments Manager**: Handles IFC model loading and fragment storage
- **Selection System**: Raycasting-based object selection with property display
- **UI System**: BUI (Building UI) panels for controls and information display

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## IFC Loader Workflow

The IFC loader uses web-ifc to process IFC files:

1. **File Input**: IFC files are loaded as ArrayBuffer (from file upload or fetch)
2. **Parsing**: web-ifc parses the IFC structure and geometry
3. **Fragment Generation**: The loader generates optimized fragments on-the-fly
4. **Fragment Storage**: FragmentsManager stores and indexes the fragments
5. **Scene Integration**: Fragments are added to the Three.js scene as meshes

### Fragment Generation

Fragments are **generated dynamically** during IFC loading. The process:

- **Web-IFC Processing**: `IfcLoader.load()` uses web-ifc WASM to parse the IFC file
- **Geometry Extraction**: Extracts mesh data (vertices, normals, indices)
- **Fragment Creation**: Creates lightweight fragment objects optimized for rendering
- **Material Assignment**: Applies materials based on IFC properties
- **Indexing**: Stores fragments with references to IFC elements

This on-the-fly generation allows:
- Selective loading (load only specific geometry)
- Progressive rendering (display as fragments are created)
- Memory optimization (fragments can be disposed when not needed)

### CDN-based WASM Loading

The viewer uses CDN-hosted WASM files for reliability:

```typescript
await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
        path: "https://unpkg.com/web-ifc@0.0.71/",
        absolute: true,
    },
});
```

**Why CDN?**
- Handles multi-threaded WASM worker scripts automatically
- Proper MIME types and CORS headers
- No local server configuration needed
- Consistent behavior across environments

## Project Structure

```
ifc-viewer.nl/
├── src/
│   ├── main.tsx           # Main application entry point
│   ├── App.tsx            # React root component (currently minimal)
│   ├── index.css          # Global styles
│   └── App.css            # Component styles
├── public/
│   ├── models/            # IFC model files (auto-loaded)
│   └── wasm/              # Local WASM files (fallback, not used)
├── tests/                 # Unit tests
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Usage

### Loading IFC Files

**Method 1: Auto-load from /models/**
- Place `.ifc` files in `/public/models/`
- Files are automatically loaded on startup

**Method 2: Manual Upload**
- Click "Load IFC Files" button in the UI panel
- Select one or more `.ifc` files
- Files are loaded and displayed immediately

### Interacting with Models

- **Rotate**: Left-click drag
- **Pan**: Right-click drag or middle-click drag
- **Zoom**: Scroll wheel
- **Select**: Left-click on object to view properties
- **View Controls**: Click settings icon to open control panel

### Exporting Fragments

Fragments can be exported for faster re-loading:
1. Load an IFC file
2. Click "Download Fragments" button
3. Save the `.frag` file
4. Load `.frag` files instead of IFC for instant loading

## Development

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Functional programming patterns where possible

### Testing

```bash
# Run unit tests
yarn test

# Run tests in watch mode
yarn test:watch

# Generate coverage report
yarn test:coverage
```

See [tests/README.md](./tests/README.md) for testing guidelines.

## Future Plans

- Modular architecture refactoring
- Property tree view
- Classification and labeling
- Measurement tools
- Section planes
- Clash detection
- BIM data editing

## License

MIT

## Acknowledgments

- [ThatOpen Platform](https://thatopen.com/) for BIM components
- [Three.js](https://threejs.org/) for 3D rendering
- [web-ifc](https://github.com/tomvandig/web-ifc) for IFC parsing
