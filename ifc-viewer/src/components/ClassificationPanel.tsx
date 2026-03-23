import { Stack, Title, FileButton, Button, Tree, Group, ActionIcon, Tooltip, Text, Badge } from '@mantine/core';
import { IconFileUpload, IconPlus, IconReplace, IconMinus, IconLink, IconDownload, IconX } from '@tabler/icons-react';
import { useViewerContext } from '../contexts/ViewerContext';
import { useClassifier } from '../hooks/useClassifier';
import { useState, useEffect } from 'react';

interface TreeNode {
  value: string;
  label: string;
  count?: number;
}

export function ClassificationPanel() {
  const { 
    fragmentsManager, 
    highlighter, 
    selection, 
    selectionInfo 
  } = useViewerContext();

  const classifier = useClassifier(
    fragmentsManager?.fragments ?? null
  );

  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [demoLoaded, setDemoLoaded] = useState(false);

  // Auto-load demo classifications on startup
  useEffect(() => {
    if (!fragmentsManager?.fragments || demoLoaded) return;
    
    classifier.loadFromUrl('/classifications-demo.json');
    setDemoLoaded(true);
  }, [fragmentsManager?.fragments, classifier, demoLoaded]);

  // Update tree data when labels or store change
  useEffect(() => {
    const updateCounts = async () => {
      if (classifier.labels.length === 0) {
        setTreeData([]);
        return;
      }

      const nodes: TreeNode[] = [];
      
      for (const label of classifier.labels) {
        const count = await classifier.getLabelCountInFragments(label);
        nodes.push({
          value: label,
          label: label,
          count: count,
        });
      }
      
      setTreeData(nodes);
    };

    updateCounts();
  }, [classifier.labels, classifier.store, fragmentsManager?.models.length, classifier.getLabelCountInFragments]);

  // Handle file upload
  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    await classifier.loadFromFile(file);
  };

  // Add current selection to label
  const handleAddToLabel = async (label: string) => {
    if (!selection || Object.keys(selection).length === 0) {
      return;
    }

    await classifier.addSelectionToLabel(label, selection);
    
    // Force re-render of tree to show updated counts
    const count = await classifier.getLabelCountInFragments(label);
    setTreeData(prev => prev.map(node => 
      node.value === label ? { ...node, count } : node
    ));
  };

  // Replace selection with items from label
  const handleReplaceSelection = async (label: string) => {
    if (!highlighter) return;
    
    const items = await classifier.getItemsByLabel(label);
    if (Object.keys(items).length === 0) {
      console.warn(`No items in label: ${label}`);
      return;
    }

    // Clear current selection and highlight new items
    highlighter.clear();
    highlighter.highlightByID('select', items, true);
  };

  // Add items from label to current selection
  const handleAddToSelection = async (label: string) => {
    if (!highlighter) return;
    
    const items = await classifier.getItemsByLabel(label);
    if (Object.keys(items).length === 0) {
      console.warn(`No items in label: ${label}`);
      return;
    }

    // Add to existing selection (don't replace)
    highlighter.highlightByID('select', items, false);
  };

  // Subtract items from label from current selection
  const handleSubtractFromSelection = async (label: string) => {
    if (!highlighter || !selection) return;
    
    const itemsToRemove = await classifier.getItemsByLabel(label);
    if (Object.keys(itemsToRemove).length === 0) {
      console.warn(`No items in label: ${label}`);
      return;
    }

    // Create new selection without the items from this label
    const newSelection: Record<string, Set<number>> = {};
    
    for (const [modelId, localIds] of Object.entries(selection)) {
      const removeIds = itemsToRemove[modelId] || new Set();
      const remainingIds = new Set([...localIds].filter(id => !removeIds.has(id)));
      
      if (remainingIds.size > 0) {
        newSelection[modelId] = remainingIds;
      }
    }

    // Apply new selection
    highlighter.clear();
    if (Object.keys(newSelection).length > 0) {
      highlighter.highlightByID('select', newSelection, true);
    }
    
  };

  // Remove current selection from label
  const handleRemoveFromLabel = async (label: string) => {
    if (!selection || Object.keys(selection).length === 0) {
      return;
    }

    await classifier.removeSelectionFromLabel(label, selection);
    
    // Force re-render of tree to show updated counts
    const count = await classifier.getLabelCountInFragments(label);
    setTreeData(prev => prev.map(node => 
      node.value === label ? { ...node, count } : node
    ));
  };

  // Render tree node with action buttons
  const renderTreeNode = (node: TreeNode) => {
    return (
      <Group gap="xs" wrap="nowrap" style={{ width: '100%' }}>
        <Text size="sm" style={{ flex: 1 }} truncate>
          {node.label}
        </Text>
        {node.count !== undefined && node.count > 0 && (
          <Badge size="xs" variant="light" color="blue">
            {node.count}
          </Badge>
        )}
        <Group gap={4}>
          <Tooltip label="Voeg selectie toe aan label">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="green"
              onClick={(e) => {
                e.stopPropagation();
                handleAddToLabel(node.value);
              }}
              disabled={!selection || Object.keys(selection).length === 0}
            >
              <IconLink size={14} />
            </ActionIcon>
          </Tooltip>
          
          <Tooltip label="Verwijder selectie uit label">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="orange"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFromLabel(node.value);
              }}
              disabled={!selection || Object.keys(selection).length === 0 || !classifier.getLabelCount(node.value)}
            >
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
          
          <Tooltip label="Vervang selectie door items in label">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="blue"
              onClick={(e) => {
                e.stopPropagation();
                handleReplaceSelection(node.value);
              }}
              disabled={!classifier.getLabelCount(node.value)}
            >
              <IconReplace size={14} />
            </ActionIcon>
          </Tooltip>
          
          <Tooltip label="Voeg items uit label toe aan selectie">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="cyan"
              onClick={(e) => {
                e.stopPropagation();
                handleAddToSelection(node.value);
              }}
              disabled={!classifier.getLabelCount(node.value)}
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
          
          <Tooltip label="Trek items uit label af van selectie">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                handleSubtractFromSelection(node.value);
              }}
              disabled={!selection || !classifier.getLabelCount(node.value)}
            >
              <IconMinus size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    );
  };

  return (
    <Stack gap="sm">
      <Title order={5}>Classificaties</Title>
      
      <Group gap="xs">
        <FileButton
          accept=".json,.csv,.txt"
          onChange={handleFileUpload}
        >
          {(props) => (
            <Button
              {...props}
              size="xs"
              leftSection={<IconFileUpload size={14} />}
              variant="light"
            >
              Laad labels
            </Button>
          )}
        </FileButton>
        
        <Button
          size="xs"
          leftSection={<IconDownload size={14} />}
          variant="light"
          onClick={classifier.exportClassifications}
          disabled={classifier.labels.length === 0}
        >
          Exporteer
        </Button>
      </Group>

      {selectionInfo && (
        <Text size="xs" c="dimmed">
          Selectie: {selectionInfo.totalCount} objecten
        </Text>
      )}

      {treeData.length > 0 ? (
        <Tree
          data={treeData}
          renderNode={(node) => renderTreeNode(node.node as TreeNode)}
        />
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Geen classificaties geladen
        </Text>
      )}
    </Stack>
  );
}
