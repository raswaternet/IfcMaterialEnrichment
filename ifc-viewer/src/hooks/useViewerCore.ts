import { useEffect, useRef, useState } from 'react';
import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import type { ViewerCore } from '../types/viewer.types';

/**
 * Hook to initialize and manage core ThatOpen viewer components
 * 
 * @param containerRef - Ref to the DOM element where the viewer should render
 * @returns ViewerCore instance or null if not initialized
 * 
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const viewerCore = useViewerCore(containerRef);
 * ```
 */
export function useViewerCore(
  containerRef: React.RefObject<HTMLDivElement | null>
): ViewerCore | null {
  const [viewerCore, setViewerCore] = useState<ViewerCore | null>(null);
  const componentsRef = useRef<OBC.Components | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize ThatOpen components
    const components = new OBC.Components();
    componentsRef.current = components;

    // Set up the 3D world
    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<
      OBC.SimpleScene,
      OBC.SimpleCamera,
      OBC.SimpleRenderer
    >();
    world.name = 'Main';

    // Configure scene
    world.scene = new OBC.SimpleScene(components);
    world.scene.setup();

    // Create skybox using CubeTexture
    // Helper function to create a canvas with solid color
    const createSolidCanvas = (color: string, size = 512): HTMLCanvasElement => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      return canvas;
    };

    // Sky colors - lighter for a brighter appearance
    const skyTop = '#B8E3FF';      // Light sky blue
    const skyHorizon = '#E8F4FA';  // Very light horizon
    
    // Ground colors - lighter for a brighter appearance
    const groundHorizon = '#EBEBEB'; // Light gray horizon
    const groundBottom = '#D8D8D8';  // Light ground

    // Create textures for all 6 faces of the cube
    // Side faces (px, nx, pz, nz): gradient from ground (bottom) to sky (top) with horizon at 50%
    // Top face (py): pure sky gradient
    // Bottom face (ny): pure ground gradient
    
    const createSideGradient = (): HTMLCanvasElement => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 512);
      
      // Sky portion (top 50%)
      gradient.addColorStop(0, skyTop);           // 0% - top sky
      gradient.addColorStop(0.4, '#D0EDFF');      // 40% - light blue
      gradient.addColorStop(0.5, skyHorizon);     // 50% - horizon light
      
      // Ground portion (bottom 50%)
      gradient.addColorStop(0.5, groundHorizon);  // 50% - horizon gray
      gradient.addColorStop(0.6, '#E0E0E0');      // 60% - mid ground
      gradient.addColorStop(1, groundBottom);     // 100% - bottom ground
      
      ctx.clearRect(0, 0, 512, 512);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
      return canvas;
    };
    
    // Generate the 6 face canvases
    const px = createSideGradient(); // positive x (right) - sky to ground gradient
    const nx = createSideGradient(); // negative x (left) - sky to ground gradient
    const py = createSolidCanvas(skyTop);         // positive y (top) - solid sky color
    const ny = createSolidCanvas(groundBottom);   // negative y (bottom) - solid ground color
    const pz = createSideGradient(); // positive z (front) - sky to ground gradient
    const nz = createSideGradient(); // negative z (back) - sky to ground gradient

    // Create cube texture from canvases using standard Three.js approach
    const cubeTexture = new THREE.CubeTexture();
    
    // Set each face's canvas directly - Three.js can handle HTMLCanvasElement
    cubeTexture.images = [px, nx, py, ny, pz, nz];

    cubeTexture.needsUpdate = true;
    cubeTexture.minFilter = THREE.LinearFilter;
    cubeTexture.magFilter = THREE.LinearFilter;
    cubeTexture.format = THREE.RGBAFormat;
    cubeTexture.colorSpace = THREE.SRGBColorSpace;

    // Set as scene background - this will render as a skybox
    world.scene.three.background = cubeTexture;

    // Configure renderer
    const renderer = new OBC.SimpleRenderer(components, containerRef.current);
    world.renderer = renderer;

    // Configure camera
    const camera = new OBC.SimpleCamera(components);
    world.camera = camera;
    camera.controls.setLookAt(10, 10, 10, 0, 0, 0);

    // Configure camera controls for industry-standard behavior
    // Middle mouse button: orbit
    // Right mouse button + drag: truck (pan)
    // Scroll wheel: dolly (zoom)
    camera.controls.mouseButtons.left = 0; // Disable left button orbit (used for selection)
    camera.controls.mouseButtons.middle = 1; // Middle button for orbit
    camera.controls.mouseButtons.right = 2; // Right button for pan
    camera.controls.mouseButtons.wheel = 16; // Scroll wheel for zoom
    camera.controls.touches.one = 32; // Touch: rotate
    camera.controls.touches.two = 512; // Touch: zoom and truck

    // Initialize the world
    components.init();

    // Add basic lighting for visualization
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    world.scene.three.add(light);
    world.scene.three.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Resize handling
    function resizeRendererToDisplaySize(renderer: OBC.SimpleRenderer) {
      const canvas = renderer.three.domElement;
      const pixelRatio = window.devicePixelRatio;
      const width = Math.floor(canvas.clientWidth * pixelRatio);
      const height = Math.floor(canvas.clientHeight * pixelRatio);
      const needResize = canvas.width !== width || canvas.height !== height;

      if (needResize) {
        renderer.three.setSize(canvas.clientWidth, canvas.clientHeight, false);
      }
      return needResize;
    }

    // Animation loop
    let animationId: number;
    function animate() {
      animationId = requestAnimationFrame(animate);

      if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.three.domElement;
        if (camera.three instanceof THREE.PerspectiveCamera) {
          camera.three.aspect = canvas.clientWidth / canvas.clientHeight;
          camera.three.updateProjectionMatrix();
        }
      }

      world.renderer?.update();
    }
    animate();

    // Handle window resize
    const handleResize = () => {
      renderer.three.setSize(
        containerRef.current!.clientWidth,
        containerRef.current!.clientHeight,
        false
      );
      if (camera.three instanceof THREE.PerspectiveCamera) {
        const canvas = renderer.three.domElement;
        camera.three.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.three.updateProjectionMatrix();
      }
    };

    window.addEventListener('resize', handleResize);

    // Set viewer core state
    setViewerCore({ components, world, renderer, camera });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      components.dispose();
    };
  }, [containerRef]);

  return viewerCore;
}
