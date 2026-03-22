import './index.css';
import './App.css';
import * as THREE from "three";
import Stats from "stats.js";
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as Classification from "./classification";

// Getting the container
const container = document.getElementById("container")!;

// Creating a components instance
const components = new OBC.Components();

// Setting up the world
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

components.init();

// Force renderer to use full viewport
world.renderer.three.setSize(window.innerWidth, window.innerHeight);

// Handle window resize
window.addEventListener('resize', () => {
    world.renderer?.three.setSize(window.innerWidth, window.innerHeight);
    world.camera?.updateAspect();
});

// Setup the scene
world.scene.setup();

// Make the background transparent
world.scene.three.background = null;

// Highlighter for selection
let highlighter: OBF.Highlighter;
let selectDiv: HTMLDivElement | null = null;
let startX = 0;
let startY = 0;

// Selection state management
let selectedProperties: Record<string, unknown> | null = null;

// Placeholder for UI update function (will be defined after panel creation)
let updateSelectionPanelUI: (() => void) | undefined;

// Initialize IFC loader and fragments
const initializeViewer = async () => {
    // Setup fragments manager
    const githubUrl = "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
    const fetchedUrl = await fetch(githubUrl);
    const workerBlob = await fetchedUrl.blob();
    const workerFile = new File([workerBlob], "worker.mjs", {
        type: "text/javascript",
    });
    const workerUrl = URL.createObjectURL(workerFile);
    const fragments = components.get(OBC.FragmentsManager);
    fragments.init(workerUrl);

    // Setup IFC loader
    const ifcLoader = components.get(OBC.IfcLoader);
    await ifcLoader.setup({
        autoSetWasm: false,
        wasm: {
            path: "https://unpkg.com/web-ifc@0.0.71/",
            absolute: true,
        },
    });

    world.camera.controls.addEventListener("rest", () =>
        fragments.core.update(true),
    );

    fragments.list.onItemSet.add(({ value: model }) => {
        model.useCamera(world.camera.three);
        world.scene.three.add(model.object);
        fragments.core.update(true);
    });

    // Initialize Highlighter for selection (Raycasters must be initialized first)
    components.get(OBC.Raycasters).get(world);
    highlighter = components.get(OBF.Highlighter);
    highlighter.setup({ world });
    
    // Initialize classification system
    Classification.initClassification(fragments, () => {
        updateSelectionPanelUI?.();
    });
    
    highlighter.events.select.onHighlight.add(() => {
        updateSelectionFromHighlighter();
    });
    highlighter.events.select.onClear.add(() => {
        selectedProperties = null;
        updateSelectionPanelUI?.();
    });

    // Rubber-band selection overlay
    selectDiv = document.createElement('div');
    selectDiv.style.cssText = 'position:fixed;pointer-events:none;display:none;z-index:500;';
    document.body.appendChild(selectDiv);

    // Setup rectangular selection (with delay to ensure world is ready)
    setTimeout(() => {
        if (!world.renderer?.three.domElement) {
            console.warn('Canvas not ready for selection setup');
            return;
        }
        
        const canvas = world.renderer.three.domElement;
        let isDragging = false;

        // Mouse down: start potential drag
        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;  // Only left button
            console.log('Mouse down', e.clientX, e.clientY);
            startX = e.clientX;
            startY = e.clientY;
            isDragging = false;
        });

        // Mouse move: show rubber band if dragging
        canvas.addEventListener('mousemove', (e) => {
            if (!(e.buttons & 1)) return;  // Check if left button is pressed
            const dx = Math.abs(e.clientX - startX);
            const dy = Math.abs(e.clientY - startY);
            
            if (!isDragging && (dx > 5 || dy > 5)) {
                isDragging = true;
                // Disable camera controls during rectangular selection
                world.camera.controls.enabled = false;
                selectDiv!.style.display = 'block';
            }
            
            if (isDragging) {
                updateSelectDiv(startX, startY, e.clientX, e.clientY);
            }
        });

        // Mouse up: apply selection
        canvas.addEventListener('mouseup', async (e) => {
            if (e.button !== 0) return;
            
            if (!isDragging) {
                // Single click - selection handled by highlighter automatically
                console.log('Single click detected');
                return;
            }
            
            console.log('Rectangle selection:', startX, startY, 'to', e.clientX, e.clientY);
            isDragging = false;
            selectDiv!.style.display = 'none';
            
            // Re-enable camera controls after rectangular selection
            world.camera.controls.enabled = true;
            
            // Left→right = crossing selection, right→left = window selection
            const windowMode = e.clientX < startX;
            console.log('Selection mode:', windowMode ? 'window' : 'crossing');
            try {
                await applyRectSelection(
                    startX, startY, e.clientX, e.clientY,
                    windowMode, e.ctrlKey
                );
            } catch (error) {
                console.error('Rectangle selection error:', error);
            }
        });

        // Mouse leave: cancel selection if dragging
        canvas.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                selectDiv!.style.display = 'none';
                world.camera.controls.enabled = true;
            }
        });

        // Keyboard: Escape clears selection
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                highlighter.clear('select');
            }
        });
    }, 100);

    // Load IFC models from the models folder
    await loadModelsFromFolder();

    // Set camera position
    await world.camera.controls.setLookAt(68, 23, -8.5, 21.5, -5.5, 23);
    await fragments.core.update(true);
    
    // Add fragments list listener
    fragments.list.onItemSet.add(() => updateSelectionPanelUI?.());
};

// Helper: Update rubber-band selection visual
const updateSelectDiv = (x1: number, y1: number, x2: number, y2: number) => {
    if (!selectDiv) return;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    const isCrossing = x2 >= x1;
    Object.assign(selectDiv.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: isCrossing
            ? '1px dashed rgba(0,200,100,0.9)'
            : '1px solid rgba(50,130,255,0.9)',
        background: isCrossing ? 'rgba(0,200,100,0.06)' : 'rgba(50,130,255,0.06)',
    });
};

// Apply rectangular selection
const applyRectSelection = async (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    windowMode: boolean,
    additive: boolean,
) => {
    console.log('applyRectSelection called', { x1, y1, x2, y2, windowMode, additive });
    
    const fragmentsManager = components.get(OBC.FragmentsManager);
    const modelIdMap: Record<string, Set<number>> = {};
    
    // Normalize coordinates: rectangleRaycast expects min to max
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    
    // For each model, use the built-in rectangleRaycast
    for (const [modelId, model] of fragmentsManager.list) {
        console.log(`Checking model: ${modelId}`);
        
        try {
            // rectangleRaycast expects a RectangleRaycastData object
            const result = await model.rectangleRaycast({
                camera: world.camera.three,
                dom: world.renderer!.three.domElement,
                topLeft: new THREE.Vector2(minX, minY),
                bottomRight: new THREE.Vector2(maxX, maxY),
                fullyIncluded: windowMode // true = window mode (fully inside), false = crossing mode
            });
            
            if (result && result.localIds.length > 0) {
                console.log(`  Selected ${result.localIds.length} items from ${modelId}`);
                modelIdMap[modelId] = new Set(result.localIds);
            }
        } catch (error) {
            console.warn(`  rectangleRaycast failed for ${modelId}:`, error);
        }
    }
    
    console.log(`Total: ${Object.keys(modelIdMap).length} models with selections`);
    if (Object.keys(modelIdMap).length > 0) {
        await highlighter.highlightByID('select', modelIdMap, !additive);
    } else if (!additive) {
        await highlighter.clear('select');
    }
};

// Update selection info from highlighter
const updateSelectionFromHighlighter = () => {
    const selection = highlighter?.selection?.select as Record<string, Set<number>> | undefined;
    
    if (!selection || Object.keys(selection).length === 0) {
        selectedProperties = null;
        updateSelectionPanelUI?.();
        return;
    }

    // Count total selected objects
    let totalSelected = 0;
    const modelInfo: Record<string, number> = {};
    
    for (const [modelId, ids] of Object.entries(selection)) {
        const count = ids.size;
        totalSelected += count;
        modelInfo[modelId] = count;
    }

    selectedProperties = {
        'Selection Status': 'Objects Selected',
        'Total Selected': totalSelected,
        'Models': Object.keys(selection).length,
        'Details': modelInfo,
    };
    
    updateSelectionPanelUI?.();
};

// Fallback function to try loading known IFC files directly
const loadKnownIfcFiles = async (): Promise<boolean> => {
    const knownIfcFiles = [
        '3D-omgeving.nl-3DBAG.ifc',
        '3D-omgeving.nl-BAG-Pand.ifc',
        '3D-omgeving.nl-BGT.ifc',
        '3D-omgeving.nl-BRK-Perceel.ifc',
        '3D-omgeving.nl-DSO-Enkelbestemming.ifc',
        '3D-omgeving.nl-DSO-Maatvoering.ifc',
        '3D-omgeving.nl-GEO-Nulpunt.ifc'
    ];
    
    let modelsLoaded = false;
    const ifcLoader = components.get(OBC.IfcLoader);
    
    for (const fileName of knownIfcFiles) {
        try {
            const fileResponse = await fetch(`/models/${fileName}`);
            
            if (fileResponse.ok) {
                const buffer = await fileResponse.arrayBuffer();
                const uint8Array = new Uint8Array(buffer);
                await ifcLoader.load(uint8Array, false, fileName, {
                    processData: {
                        progressCallback: (progress) => console.log(`Loading ${fileName}: ${progress}%`),
                    },
                });
                console.log(`Successfully loaded IFC model: ${fileName}`);
                modelsLoaded = true;
            }
        } catch (error) {
            console.warn(`Error loading ${fileName}:`, error);
        }
    }
    
    return modelsLoaded;
};

// Function to load IFC models from the models folder
const loadModelsFromFolder = async (): Promise<boolean> => {
    let modelsLoaded = false;
    try {
        const response = await fetch('/models/');
        
        if (response.ok) {
            const html = await response.text();
            const ifcFiles = extractIfcFiles(html);
            
            if (ifcFiles.length > 0) {
                const ifcLoader = components.get(OBC.IfcLoader);
                
                for (const fileName of ifcFiles) {
                    try {
                        const fileResponse = await fetch(`/models/${fileName}`);
                        
                        if (fileResponse.ok) {
                            const buffer = await fileResponse.arrayBuffer();
                            const uint8Array = new Uint8Array(buffer);
                            await ifcLoader.load(uint8Array, false, fileName, {
                                processData: {
                                    progressCallback: (progress) => console.log(`Loading ${fileName}: ${progress}%`),
                                },
                            });
                            console.log(`Successfully loaded IFC model: ${fileName}`);
                            modelsLoaded = true;
                        }
                    } catch (error) {
                        console.warn(`Failed to load IFC model ${fileName}:`, error);
                    }
                }
            } else {
                modelsLoaded = await loadKnownIfcFiles();
            }
        } else {
            modelsLoaded = await loadKnownIfcFiles();
        }
    } catch (error) {
        console.warn('Error accessing models directory:', error);
        modelsLoaded = await loadKnownIfcFiles();
    }
    return modelsLoaded;
};

// Extract IFC file names from directory listing HTML
const extractIfcFiles = (html: string): string[] => {
    const ifcFiles: string[] = [];
    const linkRegex = /<a[^>]+href="([^"]+\.ifc)"[^>]*>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
        ifcFiles.push(match[1]);
    }
    
    return ifcFiles;
};

// Main initialization function
const init = async () => {
    // Initialize UI
    BUI.Manager.init();

    // Create file upload functionality
    const createFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ifc';
    input.multiple = true;
    input.style.display = 'none';
    
    input.addEventListener('change', async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (!files) return;
        
        const ifcLoader = components.get(OBC.IfcLoader);
        
        for (const file of Array.from(files)) {
            if (file.name.toLowerCase().endsWith('.ifc')) {
                try {
                    const buffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(buffer);
                    await ifcLoader.load(uint8Array, false, file.name, {
                        processData: {
                            progressCallback: (progress) => console.log(`Loading ${file.name}: ${progress}%`),
                        },
                    });
                    console.log(`Loaded IFC file: ${file.name}`);
                    updateSelectionPanelUI?.();
                } catch (error) {
                    console.error(`Failed to load ${file.name}:`, error);
                }
            }
        }
    });
    
    document.body.appendChild(input);
    return input;
};

    const fileUploadInput = createFileUpload();

    // Initialize the viewer first (this initializes FragmentsManager)
    await initializeViewer();

    // Download fragments functionality
    const downloadFragments = async () => {
    const fragments = components.get(OBC.FragmentsManager);
    const [model] = fragments.list.values();
    if (!model) return;
    const fragsBuffer = await model.getBuffer(false);
    const file = new File([fragsBuffer], "model.frag");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
};

// Create UI panel
const panelResult = BUI.Component.create<BUI.PanelSection, Record<string, never>>(() => {
    const fragments = components.get(OBC.FragmentsManager);
    
    let downloadBtn: BUI.TemplateResult | undefined;
    if (fragments.list.size > 0) {
        downloadBtn = BUI.html`
            <bim-button label="Download Fragments" @click=${downloadFragments}></bim-button>
        `;
    }
    
    return BUI.html`
    <bim-panel active label="IFC Viewer" class="options-menu">
      <bim-panel-section label="Models">
        <bim-button 
          label="Load IFC Files" 
          @click="${() => fileUploadInput.click()}">
        </bim-button>
        
        ${downloadBtn}
        
        <bim-button 
          label="Clear All Models" 
          @click="${async () => {
            const fragments = components.get(OBC.FragmentsManager);
            fragments.dispose();
            // Reinitialize fragments
            const githubUrl = "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
            const fetchedUrl = await fetch(githubUrl);
            const workerBlob = await fetchedUrl.blob();
            const workerFile = new File([workerBlob], "worker.mjs", {
                type: "text/javascript",
            });
            const workerUrl = URL.createObjectURL(workerFile);
            fragments.init(workerUrl);
            updateSelectionPanelUI?.();
          }}">
        </bim-button>
      </bim-panel-section>
      
      <bim-panel-section label="View Controls">
        <bim-color-input 
          label="Background Color" color="#202932" 
          @input="${({ target }: { target: BUI.ColorInput }) => {
            world.scene.config.backgroundColor = new THREE.Color(target.color);
        }}">
        </bim-color-input>
        
        <bim-number-input 
          slider step="0.1" label="Directional lights intensity" value="1.5" min="0.1" max="10"
          @change="${({ target }: { target: BUI.NumberInput }) => {
            world.scene.config.directionalLight.intensity = target.value;
        }}">
        </bim-number-input>
        
        <bim-number-input 
          slider step="0.1" label="Ambient light intensity" value="1" min="0.1" max="5"
          @change="${({ target }: { target: BUI.NumberInput }) => {
            world.scene.config.ambientLight.intensity = target.value;
        }}">
        </bim-number-input>
      </bim-panel-section>
      
      <bim-panel-section label="Selection & Properties">
        <div id="selection-info">
          ${selectedProperties ? BUI.html`
            <bim-label>Selection Info:</bim-label>
            <div style="max-height: 200px; overflow-y: auto; font-size: 12px; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; margin-top: 8px;">
              <pre>${JSON.stringify(selectedProperties, null, 2)}</pre>
            </div>
            <bim-button 
              label="Clear Selection (Esc)" 
              @click="${() => highlighter.clear('select')}">
            </bim-button>
          ` : BUI.html`
            <bim-label style="margin-bottom: 8px;">Selection Modes:</bim-label>
            <div style="font-size: 11px; line-height: 1.5; color: rgba(255,255,255,0.7);">
              <div>• <strong>Click</strong>: Select single object</div>
              <div>• <strong>Drag left→right</strong>: Crossing selection (any touch, green dashed)</div>
              <div>• <strong>Drag right→left</strong>: Window selection (fully inside, blue solid)</div>
              <div>• <strong>Ctrl+Drag</strong>: Add to selection</div>
              <div>• <strong>Esc</strong>: Clear selection</div>
            </div>
          `}
        </div>
      </bim-panel-section>
      
      <bim-panel-section label="Classification">
        ${(() => {
          const labels = Classification.getLabels();
          const activeLabel = Classification.getActiveLabel();
          const store = Classification.getStore();
          const hasSelection = selectedProperties !== null;
          
          const openClassificationFile = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.csv,.txt';
            input.onchange = async () => {
              if (input.files?.[0]) {
                await Classification.loadClassificationsFromFile(input.files[0]);
                updatePanel({});
              }
            };
            input.click();
          };
          
          if (labels.length === 0) {
            return BUI.html`
              <bim-button 
                label="Load Classification Labels..." 
                icon="solar:file-text-bold"
                @click="${openClassificationFile}">
              </bim-button>
              <bim-label style="opacity:0.6;font-size:11px;white-space:normal;margin-top:8px;">
                Load a JSON array (["Label1","Label2"]) or a line-separated text/CSV file
              </bim-label>
            `;
          }
          
          return BUI.html`
            <bim-button 
              label="Load Classification Labels..." 
              icon="solar:file-text-bold"
              @click="${openClassificationFile}">
            </bim-button>
            
            <bim-label style="font-size:11px;margin-top:12px;margin-bottom:4px;">
              Active: <strong>${activeLabel ?? 'none selected'}</strong>
            </bim-label>
            
            <div style="display:flex;flex-direction:column;gap:2px;max-height:140px;overflow-y:auto;margin-bottom:8px;">
              ${labels.map((label) => {
                const count = store.get(label)?.size ?? 0;
                return BUI.html`
                  <bim-button
                    label="${label} (${count})"
                    style="${activeLabel === label ? 'outline:2px solid #4caf50;border-radius:4px;' : ''}"
                    @click="${() => {
                      Classification.setActiveLabel(label);
                      updatePanel({});
                    }}">
                  </bim-button>
                `;
              })}
            </div>
            
            <bim-button
              label="Assign selected → ${activeLabel ?? '?'}"
              icon="solar:tag-horizontal-bold"
              ?disabled="${!activeLabel || !hasSelection}"
              @click="${async () => {
                const selection = highlighter.selection.select;
                await Classification.assignToActive(selection);
                updatePanel({});
              }}">
            </bim-button>
            
            <bim-button
              label="Select by classification"
              icon="solar:cursor-bold"
              ?disabled="${!activeLabel}"
              @click="${async () => {
                if (!activeLabel) return;
                const items = await Classification.getItemsByLabel(activeLabel);
                await highlighter.highlightByID('select', items, true);
                updateSelectionFromHighlighter();
              }}">
            </bim-button>
            
            <bim-button
              label="Export Classifications JSON"
              icon="solar:download-bold"
              @click="${Classification.exportClassificationsJSON}">
            </bim-button>
          `;
        })()}
      </bim-panel-section>
    </bim-panel>
    `;
}, {});

const panel = panelResult[0];
const updatePanel = panelResult[1];

// Assign the updatePanel function to our selection UI updater
updateSelectionPanelUI = updatePanel;

document.body.append(panel);

const button = BUI.Component.create<BUI.PanelSection>(() => {
    return BUI.html`
      <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
        @click="${() => {
          if (panel.classList.contains("options-menu-visible")) {
            panel.classList.remove("options-menu-visible");
          } else {
            panel.classList.add("options-menu-visible");
          }
        }}">
      </bim-button>
    `;
});

document.body.append(button);

// Performance stats
const stats = new Stats();
stats.showPanel(2);
stats.dom.classList.add('stats');
document.body.append(stats.dom);
    stats.dom.style.left = "0px";
    stats.dom.style.top = "0px";
    stats.dom.style.zIndex = "1000";
    world.renderer?.onBeforeUpdate.add(() => stats.begin());
    world.renderer?.onAfterUpdate.add(() => stats.end());
};

// Start the application
init().catch(console.error);
