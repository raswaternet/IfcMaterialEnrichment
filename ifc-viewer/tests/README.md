# Testing Guidelines

## Overview

This project uses Vitest for unit testing. Tests focus on pure logic that doesn't require extensive 3D mocking.

## Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Generate coverage report
yarn test:coverage
```

## Test Structure

### Unit Tests (`utils.test.ts`)

Tests for utility functions and pure logic:

- **IFC File Extraction**: Tests extracting IFC filenames from HTML directory listings
- **Mouse Coordinate Conversion**: Tests converting mouse coordinates to WebGL space  
- **Property Formatting**: Tests formatting selection info
- **Known Files Validation**: Tests hardcoded file list integrity

### What We Test

✅ **Pure Functions**
- File extraction from HTML
- Coordinate conversions
- Data formatting
- Validation logic

✅ **Utility Logic**
- Regex patterns
- String manipulation
- Math calculations
- List operations

### What We Don't Test (Yet)

❌ **3D Rendering**
- Three.js scene setup
- Mesh creation
- Material assignment
- Raycasting (requires mock scene)

❌ **Component Integration**
- ThatOpen components initialization
- Fragment manager behavior
- IFC loader workflow
- Worker communication

❌ **UI Components**
- BUI panel creation
- React component rendering
- DOM interactions

## Testing Strategy

### Current Focus: Unit Tests

We focus on testing **logic without 3D dependencies**:

```typescript
// ✅ Easy to test
const extractIfcFiles = (html: string): string[] => {
  const ifcFiles: string[] = [];
  const linkRegex = /<a[^>]+href="([^"]+\.ifc)"[^>]*>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    ifcFiles.push(match[1]);
  }
  
  return ifcFiles;
};

// ❌ Hard to test without mocking
const loadIfc = async (file: File) => {
  const ifcLoader = components.get(OBC.IfcLoader);
  // ... involves WASM, workers, Three.js
};
```

### Future: Integration Tests

When architecture is modularized:

1. **Component Tests**
   - Test viewer initialization with mocked 3D
   - Test fragments manager with stub data
   - Test selection with mock raycaster

2. **Integration Tests**
   - Test full IFC loading pipeline (with small test files)
   - Test UI interactions (with React Testing Library)
   - Test event handling chain

3. **E2E Tests**
   - Test complete user workflows
   - Test multi-file loading
   - Test performance benchmarks

## Writing New Tests

### Guidelines

1. **Keep tests pure**: Test functions without side effects first
2. **Mock minimally**: Only mock what's necessary
3. **Test edge cases**: Empty inputs, invalid data, boundary conditions
4. **Use descriptive names**: Test names should explain what they verify
5. **Arrange-Act-Assert**: Follow AAA pattern

### Example Test

```typescript
describe('Feature Name', () => {
  it('should handle specific scenario', () => {
    // Arrange: Setup test data
    const input = 'test data';
    
    // Act: Execute the function
    const result = functionUnderTest(input);
    
    // Assert: Verify the outcome
    expect(result).toBe('expected output');
  });
});
```

## Test Coverage Goals

### Current Coverage

- Utility functions: 100%
- Pure logic: 100%
- Integration: 0% (difficult without modularization)
- E2E: 0% (future)

### Target Coverage

After modularization:
- Utility functions: 100%
- Core modules: 80%+
- UI components: 70%+
- Integration: 60%+

## Continuous Integration

Tests run automatically on:
- Pre-commit (if git hooks configured)
- Pull requests
- Pre-build

## Common Issues

### Issue: JSDOM not handling Canvas

**Problem**: Tests fail with "HTMLCanvasElement is not defined"

**Solution**: Mock canvas in test setup:
```typescript
HTMLCanvasElement.prototype.getContext = vitest.fn();
```

### Issue: Worker threads not supported

**Problem**: Tests fail when code tries to create Worker

**Solution**: Mock Worker API:
```typescript
global.Worker = class MockWorker {};
```

### Issue: WASM module loading

**Problem**: web-ifc WASM fails to load in tests

**Solution**: Don't test WASM-dependent code at unit level. Use integration tests with real WASM or mock the entire loader.

## Mocking Guidelines

### When to Mock

- External APIs (fetch, workers)
- Browser APIs (canvas, WebGL)
- Heavy dependencies (Three.js scenes)
- File I/O operations

### When NOT to Mock

- Pure functions
- Simple utility logic
- Data transformations
- Validation functions

### Example Mocks

```typescript
// Mock fetch
global.fetch = vitest.fn(() =>
  Promise.resolve({
    ok: true,
    text: () => Promise.resolve('<html>...</html>'),
  })
);

// Mock console (to quiet logs)
global.console.log = vitest.fn();
global.console.warn = vitest.fn();
```

## Performance Testing

Future consideration: Performance benchmarks for:
- IFC parsing speed
- Fragment generation time
- Rendering FPS
- Memory usage

Use Vitest's `bench` API:
```typescript
import { bench, describe } from 'vitest';

describe('Performance', () => {
  bench('extractIfcFiles with large HTML', () => {
    const largeHtml = '...'; // 1MB of HTML
    extractIfcFiles(largeHtml);
  });
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Three.js Testing Patterns](https://threejs.org/docs/#manual/en/introduction/How-to-run-things-locally)
