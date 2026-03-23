import { Text, Slider, Stack } from '@mantine/core';
import { useViewerContext } from '../contexts/ViewerContext';

export function Toolbar() {
  const { groundPlane } = useViewerContext();

  if (!groundPlane) return null;

  return (
    <Stack gap="sm" p="md">
      <Text size="xs" mb={4}>
        Map opacity: {Math.round(groundPlane.opacity * 100)}%
      </Text>
      <Slider
        value={groundPlane.opacity * 100}
        onChange={(value) => {
          const newOpacity = value / 100;
          groundPlane.setOpacity(newOpacity);
          groundPlane.setVisible(newOpacity > 0);
        }}
        min={0}
        max={100}
        step={5}
        marks={[
          { value: 0, label: '0%' },
          { value: 50, label: '50%' },
          { value: 100, label: '100%' },
        ]}
      />
    </Stack>
  );
}
