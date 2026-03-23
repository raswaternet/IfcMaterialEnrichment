import '@mantine/core/styles.css';
import { MantineProvider, AppShell, Burger, Group, Title, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Toolbar } from './components/Toolbar';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ViewerCanvas } from './components/ViewerCanvas';
import { ClassificationPanel } from './components/ClassificationPanel';
import { ViewerProvider } from './contexts/ViewerContext';
import * as OBC from '@thatopen/components';
import { useViewerCore } from './hooks/useViewerCore';
import { useFragmentsManager } from './hooks/useFragmentsManager';
import { useSelection } from './hooks/useSelection';
import { useBGTGroundPlane } from './hooks/useBGTGroundPlane';
import { FRAGMENTS_BASE_PATH } from './constants/models';
import { AVAILABLE_MODELS } from './config/scene';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize viewer at App level so context is available to all children
  const viewerCore = useViewerCore(containerRef);
  const fragmentsManager = useFragmentsManager(viewerCore);
  const { highlighter, selection, selectionInfo } = useSelection(viewerCore);
  
  const groundPlane = useBGTGroundPlane(viewerCore?.world ?? null);

  // Auto-load fragment model on startup
  useEffect(() => {
    if (!fragmentsManager.fragments) return;
    if (fragmentsManager.models.length > 0) return;
    if (fragmentsManager.isLoading) return;

    const autoLoadModels = async () => {
      // Load first model from configuration
      const firstModel = AVAILABLE_MODELS[0];
      if (!firstModel) return;

      const fragmentUrl = `${FRAGMENTS_BASE_PATH}/${encodeURIComponent(firstModel.fileName)}`;
      await fragmentsManager.loadFragmentFromUrl(fragmentUrl, firstModel.fileName);

      if (viewerCore && fragmentsManager.models.length > 0) {
        await viewerCore.camera.setOrbitToItems();
      }
    };

    autoLoadModels();
  }, [fragmentsManager.fragments, fragmentsManager.models.length, fragmentsManager.isLoading, fragmentsManager.loadFragmentFromUrl, viewerCore]);

  // Update camera orbit and boundary whenever models change
  useEffect(() => {
    if (!viewerCore || fragmentsManager.models.length === 0 || fragmentsManager.isLoading) {
      return;
    }

    const controls = viewerCore.camera.controls;
    const fragments = fragmentsManager.fragments;

    // Use BoundingBoxer to compute combined bbox (same as setOrbitToItems internally)
    const boxer = viewerCore.components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    if (fragments) {
      for (const [, model] of fragments.list) {
        boxer.list.add((model as any).box);
      }
    }
    const bbox = boxer.get();
    boxer.list.clear();

    if (!bbox.isEmpty()) {
      const size = bbox.getSize(new THREE.Vector3());

      // Expand boundary so user can orbit freely around the model
      const expanded = bbox.clone().expandByScalar(size.length() * 0.5);
      expanded.min.y = Math.max(expanded.min.y, 0);

      controls.setBoundary(expanded);
      controls.boundaryEnclosesCamera = false;
    }

    viewerCore.camera.setOrbitToItems();
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
          groundPlane,
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
