import { Overlay, Center, Stack, Text, Progress, Loader } from '@mantine/core';
import { useViewerContext } from '../contexts/ViewerContext';

/**
 * LoadingOverlay component - Shows loading progress for initial models
 * 
 * Displays:
 * - Semi-transparent overlay
 * - Loading animation
 * - Current file being loaded
 * - Progress bar
 */
export function LoadingOverlay() {
  const { fragmentsManager } = useViewerContext();

  if (!fragmentsManager?.isLoading || !fragmentsManager.loadingProgress) {
    return null;
  }

  const { currentFile, currentIndex, totalFiles, percentage } = fragmentsManager.loadingProgress;

  return (
    <Overlay color="#000" backgroundOpacity={0.7} blur={2}>
      <Center style={{ width: '100%', height: '100%' }}>
        <Stack align="center" gap="lg" style={{ maxWidth: '400px', width: '90%' }}>
          <Loader size="xl" />
          
          <Stack align="center" gap="xs" style={{ width: '100%' }}>
            <Text size="xl" fw={600} c="white">
              Loading IFC Models
            </Text>
            
            {currentFile && (
              <Text size="sm" c="gray.3" ta="center" style={{ wordBreak: 'break-all' }}>
                {currentFile}
              </Text>
            )}
            
            <Text size="sm" c="gray.4">
              {currentIndex} of {totalFiles} files
            </Text>
          </Stack>

          <Progress 
            value={percentage} 
            size="lg" 
            radius="md" 
            style={{ width: '100%' }}
            animated
          />
          
          <Text size="xs" c="gray.5">
            {percentage}%
          </Text>
        </Stack>
      </Center>
    </Overlay>
  );
}
