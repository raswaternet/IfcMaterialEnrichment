import { useEffect, useRef, useState } from 'react';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as THREE from 'three';
import type { ViewerCore } from '../types/viewer.types';

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
      OBF.PostproductionRenderer
    >();
    world.name = 'Main';

    // Configure scene
    world.scene = new OBC.SimpleScene(components);
    world.scene.setup();

    // Create skybox using CubeTexture
    const createSolidCanvas = (color: string, size = 512): HTMLCanvasElement => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      return canvas;
    };

    const skyTop = '#B8E3FF';
    const skyHorizon = '#E8F4FA';
    const groundHorizon = '#EBEBEB';
    const groundBottom = '#D8D8D8';

    const createSideGradient = (): HTMLCanvasElement => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 512);

      gradient.addColorStop(0, skyTop);
      gradient.addColorStop(0.4, '#D0EDFF');
      gradient.addColorStop(0.5, skyHorizon);
      gradient.addColorStop(0.5, groundHorizon);
      gradient.addColorStop(0.6, '#E0E0E0');
      gradient.addColorStop(1, groundBottom);

      ctx.clearRect(0, 0, 512, 512);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
      return canvas;
    };

    const px = createSideGradient();
    const nx = createSideGradient();
    const py = createSolidCanvas(skyTop);
    const ny = createSolidCanvas(groundBottom);
    const pz = createSideGradient();
    const nz = createSideGradient();

    const cubeTexture = new THREE.CubeTexture();
    cubeTexture.images = [px, nx, py, ny, pz, nz];
    cubeTexture.needsUpdate = true;
    cubeTexture.minFilter = THREE.LinearFilter;
    cubeTexture.magFilter = THREE.LinearFilter;
    cubeTexture.format = THREE.RGBAFormat;
    cubeTexture.colorSpace = THREE.SRGBColorSpace;
    world.scene.three.background = cubeTexture;

    // Configure renderer with post-processing support
    const renderer = new OBF.PostproductionRenderer(components, containerRef.current);
    world.renderer = renderer;

    // Configure camera
    const camera = new OBC.SimpleCamera(components);
    world.camera = camera;
    camera.controls.setLookAt(10, 10, 10, 0, 0, 0);

    if (camera.three instanceof THREE.PerspectiveCamera) {
      camera.three.near = 0.5;
      camera.three.far = 20000;
      camera.three.updateProjectionMatrix();
    }

    // Camera controls: middle=orbit, right=pan, scroll=zoom
    camera.controls.mouseButtons.left = 0;
    camera.controls.mouseButtons.middle = 1;
    camera.controls.mouseButtons.right = 2;
    camera.controls.mouseButtons.wheel = 16;
    camera.controls.touches.one = 32;
    camera.controls.touches.two = 512;
    camera.controls.maxPolarAngle = Math.PI / 2;
    camera.controls.maxDistance = 500;
    camera.controls.minDistance = 0.5;
    camera.controls.dollyToCursor = true;

    // Initialize the world
    components.init();

    // Enable post-processing with GTAO ambient occlusion
    const pp = renderer.postproduction;
    pp.enabled = true;
    pp.style = 4 as OBF.PostproductionAspect; // COLOR_SHADOWS

    pp.defaultAoParameters = {
      radius: 4,
      distanceExponent: 1,
      thickness: 2,
      scale: 1,
      samples: 16,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    };
    pp.aoPass.updateGtaoMaterial(pp.defaultAoParameters);
    pp.aoPass.blendIntensity = 1;

    // Tone mapping
    renderer.three.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.three.toneMappingExposure = 1.0;

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xB8E3FF, 0x888888, 1.2);
    world.scene.three.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 7.5);
    world.scene.three.add(dirLight);

    // Resize handling
    function resizeRendererToDisplaySize(renderer: OBF.PostproductionRenderer) {
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
