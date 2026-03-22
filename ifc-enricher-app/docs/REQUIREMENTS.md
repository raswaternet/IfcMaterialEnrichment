# IFC Material Enrichment — Requirements Specification

> **Project:** raswaternet/IfcMaterialEnrichment  
> **Event:** openBIM Hackathon Porto 2026 (Mar 22–24, 48h)  
> **Version:** 1.1  
> **Last updated:** 2026-03-22

---

## 1. Overview

A web application that enriches IFC building models with standardized material data from the buildingSMART Data Dictionary (bSDD). Users upload an IFC file, view the 3D model, search for materials in bSDD, assign them to elements, export an enriched IFC file, and generate material reports — enabling Digital Material Passports for the construction industry.

### Core User Flow
```
Upload IFC → View 3D Model → Select Element → Search bSDD → Assign Material → Export Enriched IFC → View Report
```

---

## 2. Architecture

### 2.1 System Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Frontend (React)                     │
│                                                      │
│  ┌─────────────────────────┐  ┌───────────────────┐  │
│  │   IFC Viewer (iframe)   │  │   UI Panels       │  │
│  │   Pre-built bundle      │  │   - Upload        │  │
│  │   (Three.js + web-ifc   │  │   - Element info  │  │
│  │    + @thatopen/*)       │  │   - bSDD search   │  │
│  │                         │  │   - Draft mgmt    │  │
│  │   Communicates via      │  │   - Report        │  │
│  │   penpal (RPC over      │  │                   │  │
│  │   postMessage)          │  │                   │  │
│  └────────────┬────────────┘  └────────┬──────────┘  │
│               │ penpal                 │ REST        │
│               └────────────────────────┘             │
├──────────────────────────────────────────────────────┤
│                                                      │
│              Backend (FastAPI + Python)               │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ IfcOpenShell                                  │    │
│  │ - Parse IFC files                             │    │
│  │ - Read elements, properties, materials        │    │
│  │ - Add/assign materials                        │    │
│  │ - Add property sets                           │    │
│  │ - Export modified IFC                         │    │
│  │ - Calculate quantities                        │    │
│  ├──────────────────────────────────────────────┤    │
│  │ bSDD API Client (proxy to avoid CORS)         │    │
│  ├──────────────────────────────────────────────┤    │
│  │ File serving: uploaded IFC files accessible   │    │
│  │ via URL so the iframe viewer can fetch them   │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.2 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18+ / TypeScript / Vite | UI framework + build tool |
| **3D Viewer** | Pre-built iframe app (Three.js + web-ifc + @thatopen/*) | IFC 3D rendering, selection, highlighting |
| **Viewer RPC** | penpal 7.x | Parent↔iframe communication |
| **Styling** | Tailwind CSS | Rapid UI development |
| **State** | Zustand or React Context | Client-side draft state |
| **Backend** | Python 3.11+ / FastAPI | REST API for IFC operations |
| **IFC Engine** | IfcOpenShell 0.8.x | Read, write, modify IFC files |
| **bSDD** | bSDD REST API (proxied through backend) | Material search + properties |
| **Container** | Docker + Docker Compose | Deployment |

### 2.3 Why This Architecture?

- **IFC Viewer as iframe:** The 3D viewer is a separate, pre-built application based on `@thatopen/components`, `@thatopen/components-front`, `web-ifc`, and `Three.js`. It is embedded as an iframe in the main app and communicates via **penpal** (a typed RPC layer over `postMessage`). The viewer's source code is proprietary and ships only as a minified build. The main app never touches IFC geometry directly.
- **penpal for viewer↔app communication:** The viewer already uses penpal for parent-iframe RPC. We extend its API to support element selection notifications, highlighting, and IFC loading.
- **IfcOpenShell (backend):** The industry standard for IFC data manipulation in Python. Has a mature, well-documented API for material operations (`ifcopenshell.api.material.*`). Reliable for reading properties, assigning materials, adding property sets, and exporting valid IFC files.
- **Backend serves uploaded IFC files:** After upload, the backend makes the IFC file accessible via a URL. The main app passes this URL to the viewer iframe via penpal `setIfcUrls()`, and the viewer fetches + renders it.
- **bSDD proxy on backend:** Avoids CORS issues and allows caching/transformation of bSDD responses.

### 2.4 IFC Viewer Integration

The IFC viewer is a **pre-built static web app** included as a directory of compiled assets (`/public/viewer/`). It is NOT part of the main app's source tree. Its source code is proprietary.

#### Viewer Tech Stack (for reference, not editable)
- `@thatopen/components` ~3.3.3
- `@thatopen/components-front` ~3.3.0
- `@thatopen/fragments` ~3.3.6
- `@thatopen/ui` ~3.3.3 / `@thatopen/ui-obc` ~3.3.3
- `web-ifc` 0.0.74
- `three` 0.175.0
- `penpal` ^7.0.6

#### Viewer Existing Capabilities
- Loads IFC files from URLs (via `setIfcUrls(urls: string[])`)
- Renders 3D geometry with postprocessing (AO, edge highlighting)
- Element selection via raycasting + Highlighter component
- Camera controls (orbit, pan, zoom)
- Clipping planes, length/area measurement tools

#### Viewer Integration: How the Main App Uses It

1. Main app renders an `<iframe src="/viewer/index.html">` in the viewer area
2. Main app establishes a penpal connection to the iframe
3. After IFC upload, backend returns a file URL → main app calls `viewer.setIfcUrls([url])`
4. When user clicks an element in the viewer, viewer calls `parent.onElementSelected(data)`
5. Main app can call `viewer.highlightElements(ids)` to color-code enriched elements

---

## 2.5 Penpal API Contract

This defines the RPC interface between the main React app (parent) and the IFC viewer (iframe child).

### Parent → Viewer (IFrameApi — methods exposed BY the viewer)

```typescript
interface IFrameApi {
  /**
   * Load IFC model(s) by URL. Replaces currently loaded models.
   * URLs must be accessible to the iframe (same origin or CORS-enabled).
   * Already implemented in the viewer.
   */
  setIfcUrls(urls: string[]): Promise<void>;

  /**
   * Highlight specific elements in the 3D view (e.g., enriched elements).
   * Uses a custom color to distinguish them from default appearance.
   * NEW — needs to be added to the viewer.
   */
  highlightElements(expressIds: number[], color?: string): Promise<void>;

  /**
   * Clear all custom highlights (reset to default appearance).
   * NEW — needs to be added to the viewer.
   */
  clearHighlights(): Promise<void>;

  /**
   * Zoom/fit the camera to a specific element.
   * NEW — needs to be added to the viewer.
   */
  zoomToElement(expressId: number): Promise<void>;

  /**
   * Existing handshake method.
   */
  helloWorldFromIframe(): void;
}
```

### Viewer → Parent (ParentApi — methods exposed BY the main app)

```typescript
interface ParentApi {
  /**
   * Called when user clicks/selects an element in the 3D viewer.
   * The main app uses this to fetch element details from the backend
   * and show them in the sidebar.
   * NEW — needs to be added to the viewer.
   */
  onElementSelected(data: {
    modelKey: string;          // key used in fragments.list (the URL)
    expressIds: number[];      // selected element express IDs
  }): void;

  /**
   * Called when user clears selection (clicks empty space).
   * NEW — needs to be added to the viewer.
   */
  onSelectionCleared(): void;

  /**
   * Called when a model finishes loading.
   * NEW — needs to be added to the viewer.
   */
  onModelLoaded(data: {
    modelKey: string;
  }): void;

  /**
   * Existing handshake method.
   */
  helloWorldFromWistor(): void;
}
```

### Implementation Notes for Viewer Updates

The viewer needs these additions to `wistor-connection.ts` and `viewer-app.ts`:

**1. Wire highlighter selection events → parent callback:**
```typescript
// In viewer: when highlighter fires select event, notify parent
highlighter.events.select.onHighlight.add((modelIdMap) => {
  // modelIdMap is Record<string, Set<number>> (modelKey → expressIds)
  for (const [modelKey, expressIds] of Object.entries(modelIdMap)) {
    parentApi.onElementSelected({
      modelKey,
      expressIds: Array.from(expressIds)
    });
  }
});

highlighter.events.select.onClear.add(() => {
  parentApi.onSelectionCleared();
});
```

**2. Expose highlightElements method:**
```typescript
// In viewer: add to IFrameApi methods in penpal connect()
highlightElements: async (expressIds: number[], color?: string) => {
  // Use fragments highlighter or custom material override
  // to color specific elements
},
clearHighlights: async () => {
  highlighter.clear("select");
},
zoomToElement: async (expressId: number) => {
  // Use camera.controls.fitToSphere on element bounding box
}
```

**3. Notify parent when model loads:**
```typescript
// In viewer: extend onModelLoaded callback
fragments.list.onItemSet.add(async ({ key, value: model }) => {
  // ... existing loading logic ...
  parentApi?.onModelLoaded({ modelKey: key });
});
```

---

## 3. Backend API Specification

### 3.1 Endpoints

#### File Management

```
POST /api/upload
  - Accepts: multipart/form-data (IFC file)
  - Returns: { fileId, fileName, schema, elementCount, elementTypes[] }
  - Stores file in temp directory with unique ID
  - Parses IFC and returns summary

GET /api/files/{fileId}/raw
  - Returns: the raw IFC file as binary (for the viewer iframe to fetch)
  - Content-Type: application/octet-stream
  - This URL is passed to the viewer via penpal setIfcUrls()

GET /api/files/{fileId}/elements
  - Returns: list of elements with basic info
  - Each element: { expressId, globalId, name, ifcType, hasGeometry, hasMaterial }
  - Supports query param: ?type=IfcWall (filter by IFC class)

GET /api/files/{fileId}/elements/{expressId}
  - Returns: full element details
  - { expressId, globalId, name, ifcType, properties: {}, quantities: {}, material: {} }

GET /api/files/{fileId}/tree
  - Returns: spatial hierarchy tree
  - IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → elements
```

#### bSDD Proxy

```
GET /api/bsdd/dictionaries
  - Returns: list of bSDD dictionaries (cached)
  - Each: { uri, name, version }

GET /api/bsdd/search?q={query}&dictionary={uri}&lang=EN&limit=20
  - Returns: { classes: [{ uri, name, dictionaryName, description }], totalCount }

GET /api/bsdd/class?uri={classUri}&lang=EN
  - Returns: full class details with properties
  - { name, description, uri, classProperties: [{ name, dataType, description, unit }] }
```

#### Enrichment

```
POST /api/files/{fileId}/enrich
  - Accepts: JSON body with enrichment assignments
  - Body: {
      assignments: [
        {
          elementExpressIds: [123, 456],     // elements to assign material to
          materialName: "C30/37 Concrete",   // material name for IFC
          materialCategory: "concrete",       // IFC material category
          materialDescription: "...",         // optional description
          bsddClassUri: "https://...",        // bSDD class URI for traceability
          properties: {                       // optional: material properties to store
            "MassDensity": { value: 2400, unit: "kg/m3" },
            "CO2Content": { value: 0.12, unit: "kg CO2/kg" }
          }
        }
      ]
    }
  - Returns: { enrichedFileId, summary: { materialsAdded, elementsEnriched } }

GET /api/files/{fileId}/download
  - Returns: IFC file as binary download
  - Content-Disposition: attachment; filename="{original}_enriched.ifc"
```

#### Report

```
GET /api/files/{fileId}/report
  - Returns: material report for the (enriched) model
  - {
      totalElements: 342,
      enrichedElements: 45,
      completeness: 0.13,
      materials: [
        {
          name: "C30/37 Concrete",
          category: "concrete",
          elementCount: 28,
          elementTypes: ["IfcWall", "IfcSlab"],
          totalVolume: 847.3,       // m³ (from BaseQuantities if available)
          estimatedMass: 2033520,   // kg (volume × density if density known)
          co2Estimate: 244022       // kg CO₂ (mass × co2 factor if known)
        }
      ],
      unenrichedElements: [
        { expressId: 789, globalId: "...", name: "Wall-003", ifcType: "IfcWall" }
      ]
    }
```

### 3.2 IfcOpenShell Usage

#### Reading Elements
```python
import ifcopenshell
import ifcopenshell.util.element

model = ifcopenshell.open(filepath)

# Get all products (physical elements)
products = model.by_type("IfcProduct")

# Get element details
element = model.by_id(express_id)
info = element.get_info()

# Get properties and quantities
psets = ifcopenshell.util.element.get_psets(element)
qtos = ifcopenshell.util.element.get_psets(element, qtos_only=True)

# Get existing material
material = ifcopenshell.util.element.get_material(element)
```

#### Writing Materials
```python
import ifcopenshell.api

# Create a material
concrete = ifcopenshell.api.material.add_material(
    model,
    name="C30/37 Concrete",
    category="concrete",
    description="Structural concrete C30/37"
)

# Assign material to element(s)
ifcopenshell.api.material.assign_material(
    model,
    products=[element],
    material=concrete
)

# Add properties to the material
pset = ifcopenshell.api.pset.add_pset(
    model,
    product=concrete,
    name="Pset_MaterialCommon"
)
ifcopenshell.api.pset.edit_pset(
    model,
    pset=pset,
    properties={
        "MassDensity": 2400.0,
        "Porosity": 0.15
    }
)

# Add bSDD external reference
# (store the bSDD URI as a classification reference for traceability)
ifcopenshell.api.classification.add_classification(
    model,
    classification="buildingSMART Data Dictionary"
)
ref = ifcopenshell.api.classification.add_reference(
    model,
    products=[concrete],
    identification="IfcMaterial",
    name="C30/37 Concrete",
    location="https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/IfcMaterial"
)

# Save enriched model
model.write(output_filepath)
```

#### Calculating Quantities
```python
import ifcopenshell.util.element

def get_element_volume(element):
    """Extract volume from element's BaseQuantities if available."""
    qtos = ifcopenshell.util.element.get_psets(element, qtos_only=True)
    for qto_name, qto_props in qtos.items():
        for prop_name in ["NetVolume", "GrossVolume", "Volume"]:
            if prop_name in qto_props:
                return qto_props[prop_name]
    return None
```

---

## 4. Frontend Specification

### 4.1 Application Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: "IFC Material Enrichment"    [Upload][Enrich][Report]  │
├──────────────────────────────────┬───────────────────────────────┤
│                                  │  Context Panel (right side)   │
│                                  │                               │
│         3D Viewer                │  When nothing selected:       │
│     (always visible)             │    Model summary info         │
│                                  │                               │
│   - Click to select element      │  When element selected:       │
│   - Highlighted elements shown   │    Element properties         │
│   - Color-coded enrichment       │    + "Search bSDD" button     │
│     status (enriched=green,      │                               │
│     unenriched=default)          │  When in bSDD search mode:    │
│                                  │    Search bar + results       │
│                                  │    + Material details          │
│                                  │    + "Assign" button          │
│                                  │                               │
├──────────────────────────────────┴───────────────────────────────┤
│  Status bar: filename | 342 elements | 12 enriched (3.5%)       │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Pages / Views

#### Upload View (landing page)
- Drag-and-drop zone + file picker for `.ifc` files
- Accepts `.ifc` files only
- Shows upload progress → sends to `POST /api/upload`
- On success → navigates to Viewer with model loaded

#### Viewer + Enrich View (main workspace)
- **Left panel (65%):** 3D model viewer
- **Right panel (35%):** Context-dependent sidebar
- **Top tabs/buttons:** switch between element info, bSDD search, draft list

#### Report View
- Material inventory table
- Summary statistics
- Export buttons (CSV, enriched IFC download)

### 4.3 3D Viewer (iframe — pre-built, not editable by the main app)

The 3D viewer is embedded as an iframe. The main app does NOT build or modify viewer code. It communicates solely through the penpal API defined in section 2.5.

| ID | Requirement | Owner | Priority |
|----|-------------|-------|----------|
| V1 | Embed viewer iframe in main app layout | Main app | Must |
| V2 | Establish penpal connection on iframe load | Main app | Must |
| V3 | Call `setIfcUrls([url])` after backend upload completes | Main app | Must |
| V4 | Listen for `onElementSelected` → show element info in sidebar | Main app | Must |
| V5 | Listen for `onSelectionCleared` → clear sidebar | Main app | Must |
| V6 | Call `highlightElements(ids)` to color enriched elements | Main app | Nice |
| V7 | Call `zoomToElement(id)` when user clicks element in draft list | Main app | Nice |

**Note:** The viewer handles all 3D rendering, camera controls, and raycasting internally. The main app only interacts via penpal RPC. Element data (properties, materials) comes from the backend API, not from the viewer.

### 4.4 Element Info Panel

| ID | Requirement | Priority |
|----|-------------|----------|
| E1 | Show: GlobalId, Name, IFC Type (e.g., IfcWall) | Must |
| E2 | Show existing material (if any) | Must |
| E3 | Show quantities (volume, area, length from BaseQuantities) | Must |
| E4 | Show property sets (collapsible sections) | Nice |
| E5 | "Search Material in bSDD" button → opens search panel | Must |

### 4.5 bSDD Search Panel

**Reference implementation:** [bSDD-filter-UI](https://github.com/buildingsmart-community/bSDD-filter-UI) — an open-source React component library by buildingSMART community that provides dictionary selection + class/material search UI. Uses Mantine UI, Redux, and React Router. **Consider using or referencing this project's components** (`BsddSearch`, `BsddSelectionSettingsLoader`) to save development time on the bSDD search UI.

Live demo: https://buildingsmart-community.github.io/bSDD-filter-UI/main/

| ID | Requirement | Priority |
|----|-------------|----------|
| S1 | Text search input with debounce (300ms) | Must |
| S2 | Dictionary filter dropdown (IFC 4.3, LCA, Circularity, etc.) | Nice |
| S3 | Show results: name, dictionary, description snippet | Must |
| S4 | Click result → show full property list from bSDD | Must |
| S5 | "Assign to selected element" button | Must |
| S6 | Allow editing material name before assigning | Must |

### 4.6 Draft Management

| ID | Requirement | Priority |
|----|-------------|----------|
| D1 | Maintain list of material assignments in client state | Must |
| D2 | Show draft list: element name → material name (collapsible) | Must |
| D3 | Allow removing an assignment from the draft | Must |
| D4 | Show enrichment progress: "X of Y elements enriched" | Must |
| D5 | "Apply & Export" button → sends assignments to `POST /api/enrich` | Must |
| D6 | Bulk assign: select IFC type → assign material to all of that type | Nice |

### 4.7 Report View

| ID | Requirement | Priority |
|----|-------------|----------|
| R1 | Material inventory table: Material, Category, Element Count, Volume | Must |
| R2 | Completeness metric: "X% of elements have material assigned" | Must |
| R3 | Answer: "How much [material] is in this model?" (volume + mass) | Must |
| R4 | CO₂ estimate per material (if CO₂ data available from bSDD) | Nice |
| R5 | Bar/pie chart for material distribution | Nice |
| R6 | List of unenriched elements | Nice |
| R7 | Download enriched IFC file button | Must |
| R8 | Export report as CSV | Nice |

---

## 5. bSDD API Integration

### 5.1 Endpoints Used

```
Base URL: https://api.bsdd.buildingsmart.org

GET /api/Dictionary/v1?Limit=100
  → List all dictionaries

GET /api/Class/search/v1?SearchText={query}&LanguageCode=EN&DictionaryUris={uri}&Limit=20
  → Search for material classes

GET /api/Class/v1?uri={classUri}&LanguageCode=EN&IncludeClassProperties=true
  → Get class details with all properties
```

### 5.2 Relevant Dictionaries

| Dictionary | URI | Use |
|-----------|-----|-----|
| IFC 4.3 | `https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3` | Standard materials + physical properties |
| D4CC LCA & Circularity | `https://identifier.buildingsmart.org/uri/bw/D4C-LCA/0.2` | Environmental impact |
| Circularity | `https://identifier.buildingsmart.org/uri/Al-Qazzaz/Circularity/0.0.1` | Circular economy properties |
| LCA Indicators | `https://identifier.buildingsmart.org/uri/LCA/LCA/3.0` | Life cycle assessment |

### 5.3 Key Material Properties from bSDD (IfcMaterial class)

These properties are available on the IfcMaterial class in bSDD and relevant for enrichment:

- **MassDensity** (Real) — kg/m³
- **CO2Content** (Real) — CO₂ ratio
- **CompressiveStrength** (Real) — MPa
- **Porosity** (Real) — ratio
- **SpecificHeatCapacity** (Real)
- **MolecularWeight** (Real)

### 5.4 Auth

No authentication needed. All read endpoints are public. No API key required.

---

## 6. Docker Deployment

### 6.1 Docker Compose Structure

```yaml
# docker-compose.yml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - upload_data:/app/uploads
    environment:
      - UPLOAD_DIR=/app/uploads
      - MAX_FILE_SIZE_MB=100

volumes:
  upload_data:
```

### 6.2 Backend Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend dependencies (package.json):**
```
react, react-dom (18+)
typescript (5.x)
vite (5+)
tailwindcss (3+)
penpal (^7.0.6)          ← MUST match viewer's penpal version
zustand (4+)             ← state management
recharts or chart.js     ← for report charts (nice to have)
```

**Backend dependencies (requirements.txt):**
```
fastapi>=0.110.0
uvicorn>=0.27.0
python-multipart>=0.0.6
ifcopenshell>=0.8.0
httpx>=0.27.0
```

### 6.3 Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### 6.4 Nginx Config (frontend → backend proxy)

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        client_max_body_size 100M;
    }
}
```

---

## 7. Project Structure

```
IfcMaterialEnrichment/
├── docker-compose.yml
├── README.md
├── docs/
│   ├── CONCEPT.md
│   └── REQUIREMENTS.md          # ← this file
├── models/                       # sample IFC files (Git LFS)
│   ├── 23434-DO-Civiel_v2.0_20250428.ifc
│   ├── Roads.ifc
│   ├── BT-test.ifc
│   └── ...
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   # FastAPI app entry
│   ├── routers/
│   │   ├── files.py              # /api/upload, /api/files/*, /api/files/*/download
│   │   ├── bsdd.py               # /api/bsdd/*
│   │   ├── enrich.py             # /api/files/*/enrich
│   │   └── report.py             # /api/files/*/report
│   ├── services/
│   │   ├── ifc_service.py        # IfcOpenShell wrapper
│   │   ├── bsdd_service.py       # bSDD API client
│   │   └── report_service.py     # quantity calculations
│   └── models/
│       └── schemas.py            # Pydantic models
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── index.html
    ├── public/
    │   └── viewer/                        # Pre-built IFC viewer (DO NOT EDIT)
    │       ├── index.html                 #   Built from proprietary source
    │       ├── assets/                    #   Minified JS + CSS + WASM
    │       └── ...                        #   Loaded as iframe
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── components/
        │   ├── viewer/
        │   │   └── ViewerIframe.tsx       # iframe embed + penpal connection
        │   ├── panels/
        │   │   ├── ElementInfo.tsx         # Selected element properties
        │   │   ├── BsddSearch.tsx          # bSDD search + results
        │   │   ├── MaterialDetail.tsx      # Material properties display
        │   │   └── DraftList.tsx           # List of pending enrichments
        │   ├── report/
        │   │   ├── ReportDashboard.tsx     # Material inventory + charts
        │   │   └── MaterialTable.tsx       # Tabular breakdown
        │   └── common/
        │       ├── FileUpload.tsx          # Drag-and-drop upload
        │       └── StatusBar.tsx           # Bottom status bar
        ├── services/
        │   ├── api.ts                      # Backend API client (fetch wrapper)
        │   └── viewer-bridge.ts           # penpal connection to viewer iframe
        ├── store/
        │   └── enrichment-store.ts         # Draft state (Zustand)
        └── types/
            ├── index.ts                    # App TypeScript interfaces
            └── viewer-api.ts              # IFrameApi + ParentApi types (shared contract)
```

---

## 8. Viewer Build Integration

### How to include the pre-built viewer in the project

The viewer source code is proprietary. Only the built output is included.

**Setup (one-time, done by Keon):**
1. In the viewer project, run `yarn build` (or `npm run build`)
2. This produces a `dist/` directory with: `index.html`, `assets/*.js`, `assets/*.css`, WASM files
3. Copy the `dist/` contents into `frontend/public/viewer/`
4. The viewer is now served at `/viewer/index.html` by the frontend

**Important config change for the viewer build:**
The viewer's `vite.config.ts` currently outputs to a different directory. For this project, build it with:
```typescript
// vite.config.ts override for this project
export default defineConfig({
  base: "./",    // relative paths so it works in any subfolder
  build: {
    outDir: 'dist'  // standard output
  }
});
```

**The viewer's `penpal` connection needs updates** (see section 2.5 for the full API contract):
- Add `onElementSelected` and `onSelectionCleared` callbacks to parent
- Add `highlightElements`, `clearHighlights`, `zoomToElement` methods to iframe API
- Wire the highlighter's `onHighlight`/`onClear` events to penpal parent calls
- Add `onModelLoaded` callback to parent

**The main app connects to the viewer like this:**
```typescript
// frontend/src/services/viewer-bridge.ts
import { WindowMessenger, connect } from "penpal";
import type { IFrameApi, ParentApi } from "../types/viewer-api";

export function connectToViewer(
  iframe: HTMLIFrameElement,
  callbacks: ParentApi
) {
  const messenger = new WindowMessenger({
    localWindow: window,
    remoteWindow: iframe.contentWindow!,
    allowedOrigins: [window.location.origin],
  });

  return connect<IFrameApi>({
    messenger,
    methods: callbacks,  // ParentApi methods the viewer can call
  });
}
```

**Usage in React:**
```tsx
// ViewerIframe.tsx (simplified)
const ViewerIframe = ({ onElementSelected, onSelectionCleared, fileUrl }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewerRef = useRef<RemoteProxy<IFrameApi>>();

  useEffect(() => {
    if (!iframeRef.current) return;
    const conn = connectToViewer(iframeRef.current, {
      onElementSelected,
      onSelectionCleared,
      onModelLoaded: ({ modelKey }) => console.log("Model loaded:", modelKey),
      helloWorldFromWistor: () => console.log("Viewer connected!"),
    });
    conn.promise.then((api) => { viewerRef.current = api; });
    return () => conn.destroy();
  }, []);

  useEffect(() => {
    if (fileUrl && viewerRef.current) {
      viewerRef.current.setIfcUrls([fileUrl]);
    }
  }, [fileUrl]);

  return <iframe ref={iframeRef} src="/viewer/index.html" style={{ width: "100%", height: "100%" }} />;
};
```

---

## 9. Priority & Scope

### Must Have (MVP — ship this)
- [ ] Upload IFC file → parse on backend
- [ ] 3D viewer with object selection
- [ ] Element info panel (name, type, properties, existing material)
- [ ] bSDD material search (at least IFC 4.3 dictionary)
- [ ] Assign material from bSDD to element(s)
- [ ] Draft management (view, remove assignments)
- [ ] Apply enrichments via backend (IfcOpenShell writes IfcMaterial + IfcRelAssociatesMaterial)
- [ ] Export/download enriched IFC file
- [ ] Basic report: material inventory table + completeness %
- [ ] Docker Compose deployment

### Nice to Have
- [ ] Bulk assign by IFC type
- [ ] Multiple bSDD dictionaries (LCA, Circularity)
- [ ] Material property sets written to IFC (Pset_MaterialCommon)
- [ ] bSDD URI stored as external reference in IFC
- [ ] CO₂ estimate in report
- [ ] Visual color-coding: enriched (green) vs unenriched (default) in 3D
- [ ] Charts (pie/bar) in report
- [ ] CSV export of report

### Won't Do (post-hackathon)
- User accounts / persistence / database
- IDS validation
- Full LCA calculation pipeline
- Integration with BIM authoring tools
- Mobile responsive design

---

## 10. Sample Workflow (Demo Script)

1. Open app → see upload screen
2. Upload `23434-DO-Civiel_v2.0_20250428.ifc` (civil infrastructure model)
3. 3D model appears → orbit around to explore
4. Click on a concrete wall element → sidebar shows: "IfcWall, Name: W-001, No material assigned"
5. Click "Search Material in bSDD" → type "concrete"
6. Results appear → select "C30/37 Concrete" → see properties (density: 2400 kg/m³, CO₂: 0.12)
7. Click "Assign" → element turns green in viewer
8. Repeat for a few more elements (or bulk assign all IfcWall → concrete)
9. Go to Draft panel → see all assignments listed
10. Click "Apply & Export" → backend enriches IFC → download `Civiel_enriched.ifc`
11. Switch to Report tab → see: "Total concrete: 847 m³, estimated mass: 2,033 tonnes"
12. See completeness: "13% of elements have material data"

**Pitch question answered:** *"How much concrete is in this bridge?"* → 847 m³

---

## 11. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| web-ifc can't render some IFC models | High | Test with all sample models early; have fallback simple viewer |
| IfcOpenShell write creates invalid IFC | High | Test export + re-import early; IfcOpenShell is mature, low risk |
| Large IFC files slow in browser | Medium | Set file size warning at 50MB; test with largest sample model |
| bSDD API down during demo | Medium | Cache common search results locally; have offline fallback data |
| CORS issues with bSDD from frontend | Low | Proxied through backend, not an issue |
| Docker build fails | Medium | Test Docker build early; keep dependencies minimal |
