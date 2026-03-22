import { Button, Group, FileButton, Text, Loader, Divider } from '@mantine/core';
import { IconUpload, IconTrash, IconDownload } from '@tabler/icons-react';
import { useViewerContext } from '../contexts/ViewerContext';
import { KNOWN_IFC_FILES, MODELS_BASE_PATH } from '../constants/models';

/**
 * Toolbar component - File operations and controls
 * 
 * Provides:
 * - Load sample models button
 * - IFC file upload
 * - Model list display
 * - Clear all models button
 * - Loading state indicator
 */
export function Toolbar() {
  const { fragmentsManager } = useViewerContext();

  if (!fragmentsManager) {
    return (
      <Group gap="sm" p="md">
        <Text size="sm" c="dimmed">
          Initializing viewer...
        </Text>
      </Group>
    );
  }

  const { models, isLoading, loadIFC, loadMultipleFromUrls, clearAll, error } = fragmentsManager;

  const handleFileChange = async (file: File | null) => {
    if (file) {
      try {
        await loadIFC(file);
      } catch (err) {
        console.error('Failed to load file:', err);
      }
    }
  };

  const handleLoadSamples = async () => {
    const urls = KNOWN_IFC_FILES.map((fileName) => ({
      url: `${MODELS_BASE_PATH}/${fileName}`,
      fileName,
    }));

    try {
      await loadMultipleFromUrls(urls);
    } catch (err) {
      console.error('Failed to load sample models:', err);
    }
  };

  return (
    <Group gap="sm" p="md" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      {/* Load sample models button */}
      {models.length === 0 && !isLoading && (
        <>
          <Button
            onClick={handleLoadSamples}
            leftSection={<IconDownload size={16} />}
            variant="filled"
            fullWidth
          >
            Load Sample Models
          </Button>
          <Divider label="or" labelPosition="center" />
        </>
      )}

      {/* File upload button */}
      <FileButton
        onChange={handleFileChange}
        accept=".ifc"
        disabled={isLoading}
      >
        {(props) => (
          <Button
            {...props}
            leftSection={isLoading ? <Loader size="xs" /> : <IconUpload size={16} />}
            disabled={isLoading}
            variant={models.length === 0 ? 'light' : 'filled'}
            fullWidth
          >
            {isLoading ? 'Loading...' : 'Upload IFC File'}
          </Button>
        )}
      </FileButton>

      {/* Error display */}
      {error && (
        <Text size="sm" c="red">
          Error: {error}
        </Text>
      )}

      {/* Model count */}
      <Text size="sm" c="dimmed">
        {models.length} model{models.length !== 1 ? 's' : ''} loaded
      </Text>

      {/* Clear all button */}
      {models.length > 0 && (
        <Button
          onClick={clearAll}
          leftSection={<IconTrash size={16} />}
          variant="light"
          color="red"
          disabled={isLoading}
          fullWidth
        >
          Clear All
        </Button>
      )}

      {/* Model list */}
      {models.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <Text size="xs" fw={600} mb="xs">
            Loaded Models:
          </Text>
          {models.map((model) => (
            <Text key={model.id} size="xs" c="dimmed" truncate>
              {model.name}
            </Text>
          ))}
        </div>
      )}
    </Group>
  );
}
