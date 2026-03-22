import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useViewerCore } from '../../hooks/useViewerCore';
import { useRef } from 'react';

/**
 * NOTE: These are minimal smoke tests for useViewerCore.
 * 
 * We don't mock the full 3D rendering stack (Three.js/WebGL) because:
 * - Mocks become complex and fragile
 * - They don't validate real 3D behavior
 * - 3D initialization is better tested via manual browser testing
 * 
 * Unit tests focus on business logic (data transforms, state management).
 * Visual/rendering features are tested manually or with E2E tests.
 */
describe('useViewerCore', () => {
  it('should return null when container ref is not set', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useViewerCore(ref);
    });

    // Basic null check - this should work without 3D mocking
    expect(result.current).toBeNull();
  });

  // Additional 3D initialization tests are skipped in unit tests.
  // They should be verified through:
  // 1. Manual testing in dev server (yarn dev)
  // 2. E2E tests with real browser (Playwright/Cypress) if needed
  // 3. Visual regression tests for production builds
});
