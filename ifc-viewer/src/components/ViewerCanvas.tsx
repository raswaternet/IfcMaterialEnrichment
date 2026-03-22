import './ViewerCanvas.css';

/**
 * ViewerCanvas component - 3D viewer container
 * 
 * Simple container div for the Three.js renderer.
 * Canvas automatically created by ThatOpen renderer.
 * 
 * Note: The ref is passed from parent (App.tsx) where
 * viewer initialization happens to provide context to all components.
 */
export function ViewerCanvas({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="viewer-container" ref={containerRef}>
      {/* Canvas will be automatically created by ThatOpen renderer */}
    </div>
  );
}

