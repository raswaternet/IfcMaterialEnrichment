import '@mantine/core/styles.css';
import { MantineProvider, AppShell, Burger, Group, Title, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useRef, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ViewerCanvas } from './components/ViewerCanvas';
import { ClassificationPanel } from './components/ClassificationPanel';
import { ViewerProvider } from './contexts/ViewerContext';
import { useViewerCore } from './hooks/useViewerCore';
import { useFragmentsManager } from './hooks/useFragmentsManager';
import { useSelection } from './hooks/useSelection';
import { MODELS_BASE_PATH } from './constants/models';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize viewer at App level so context is available to all children
  const viewerCore = useViewerCore(containerRef);
  const fragmentsManager = useFragmentsManager(viewerCore);
  const { highlighter, selection, selectionInfo } = useSelection(viewerCore);

  // Auto-load 3DBAG and BGT models on startup
  useEffect(() => {
    console.log('[App] Auto-load check:', {
      hasFragments: !!fragmentsManager.fragments,
      modelsCount: fragmentsManager.models.length,
      isLoading: fragmentsManager.isLoading,
    });

    if (!fragmentsManager.fragments) {
      console.log('[App] Skipping: fragments not ready');
      return; // Skip if not ready
    }

    if (fragmentsManager.models.length > 0) {
      console.log('[App] Skipping: models already loaded');
      return; // Skip if models already loaded
    }

    if (fragmentsManager.isLoading) {
      console.log('[App] Skipping: already loading');
      return; // Skip if already loading
    }

    console.log('[App] Starting auto-load of 3DBAG and BGT');

    const autoLoadModels = async () => {
      const modelsToLoad = [
        { url: `${MODELS_BASE_PATH}/3D-omgeving.nl-3DBAG.ifc`, fileName: '3D-omgeving.nl-3DBAG.ifc' },
        { url: `${MODELS_BASE_PATH}/3D-omgeving.nl-BGT.ifc`, fileName: '3D-omgeving.nl-BGT.ifc' },
      ];
      
      console.log('[App] Calling loadMultipleFromUrls with:', modelsToLoad);
      await fragmentsManager.loadMultipleFromUrls(modelsToLoad);
      console.log('[App] Auto-load complete');
      
      // Set camera orbit point to model center after loading
      if (viewerCore && fragmentsManager.models.length > 0) {
        console.log('[App] Setting camera orbit to models center');
        await viewerCore.camera.setOrbitToItems();
      }
    };

    autoLoadModels();
  }, [fragmentsManager.fragments, fragmentsManager.models.length, fragmentsManager.isLoading, fragmentsManager.loadMultipleFromUrls, viewerCore]);
  // Update camera orbit point whenever models change (e.g., manual loading)
  useEffect(() => {
    if (!viewerCore || fragmentsManager.models.length === 0 || fragmentsManager.isLoading) {
      return;
    }

    console.log('[App] Models changed, updating camera orbit point');
    const updateOrbitPoint = async () => {
      await viewerCore.camera.setOrbitToItems();
      console.log('[App] Camera orbit point updated to models center');
    };

    updateOrbitPoint();
  }, [viewerCore, fragmentsManager.models.length, fragmentsManager.isLoading]);
  return (
    <MantineProvider>
      <ViewerProvider
        value={{
          components: viewerCore?.components ?? null,
          world: viewerCore?.world ?? null,
          fragments: fragmentsManager.fragments,
          fragmentsManager,
          highlighter,
          selection,
          selectionInfo,
        }}
      >
        <AppShell
          header={{ height: 60 }}
          navbar={{
            width: 300,
            breakpoint: 'sm',
            collapsed: { mobile: !opened },
          }}
          padding={0}
        >
          <AppShell.Header>
            <Group h="100%" px="md">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <Title order={3}>IFC-Viewer.nl</Title>
            </Group>
          </AppShell.Header>

          <AppShell.Navbar p="md" style={{ overflowY: 'auto' }}>
            <Toolbar />
            <Divider my="md" />
            <ClassificationPanel />
          </AppShell.Navbar>

          <AppShell.Main>
            {/* 3D Viewer fills the main content area with no margins */}
            <ViewerCanvas containerRef={containerRef} />
            {/* Loading overlay appears on top when loading */}
            <LoadingOverlay />
          </AppShell.Main>
        </AppShell>
      </ViewerProvider>
    </MantineProvider>
  );
}
