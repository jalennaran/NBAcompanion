'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';

import { COURT_H, COURT_W } from './coordinate';

export type CourtCanvasRenderFn = (
  ctx: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
) => void | Promise<void>;

export type CourtTextureInput = {
  courtTextureUrl?: string;
  courtSvgString?: string;
  courtSvgElement?: ReactElement;
  widthPx?: number;
  heightPx?: number;
  renderFn?: CourtCanvasRenderFn;
};

export type CourtPlaneProps = CourtTextureInput & {
  courtWidth?: number;
  courtHeight?: number;
  y?: number;
  visible?: boolean;
};

function applyTextureDefaults(texture: THREE.Texture): THREE.Texture {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  texture.needsUpdate = true;
  return texture;
}

function loadTexture(src: string): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();

  return new Promise((resolve, reject) => {
    loader.load(src, (texture) => resolve(applyTextureDefaults(texture)), undefined, reject);
  });
}

function toSvgDataUrl(svgString: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

type ReactDomRoot = {
  render: (node: ReactElement) => void;
  unmount: () => void;
};

async function svgElementToString(svgElement: ReactElement): Promise<string> {
  const reactDomModuleName = 'react-dom/client';
  const reactDomClient = (await import(reactDomModuleName)) as {
    createRoot: (container: Element | DocumentFragment) => ReactDomRoot;
  };

  return new Promise((resolve, reject) => {
    const mount = document.createElement('div');
    mount.style.position = 'fixed';
    mount.style.left = '-10000px';
    mount.style.top = '0';
    mount.style.opacity = '0';
    document.body.appendChild(mount);

    const root = reactDomClient.createRoot(mount);
    root.render(svgElement);

    requestAnimationFrame(() => {
      try {
        const svgNode = mount.querySelector('svg');

        if (!svgNode) {
          throw new Error('courtSvgElement did not render an <svg> root.');
        }

        const xml = new XMLSerializer().serializeToString(svgNode);
        resolve(xml);
      } catch (error) {
        reject(error);
      } finally {
        root.unmount();
        mount.remove();
      }
    });
  });
}

async function textureFromRenderFn(
  renderFn: CourtCanvasRenderFn,
  widthPx: number,
  heightPx: number,
): Promise<THREE.Texture> {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create 2D canvas context for court texture.');
  }

  await renderFn(ctx, widthPx, heightPx);

  return applyTextureDefaults(new THREE.CanvasTexture(canvas));
}

export function useCourtTexture({
  courtTextureUrl,
  courtSvgString,
  courtSvgElement,
  widthPx = 1000,
  heightPx = 1880,
  renderFn,
}: CourtTextureInput): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function buildTexture() {
      try {
        let nextTexture: THREE.Texture | null = null;

        if (courtTextureUrl) {
          nextTexture = await loadTexture(courtTextureUrl);
        } else if (courtSvgString) {
          nextTexture = await loadTexture(toSvgDataUrl(courtSvgString));
        } else if (courtSvgElement) {
          const svgString = await svgElementToString(courtSvgElement);
          nextTexture = await loadTexture(toSvgDataUrl(svgString));
        } else if (renderFn) {
          nextTexture = await textureFromRenderFn(renderFn, widthPx, heightPx);
        }

        if (cancelled) {
          nextTexture?.dispose();
          return;
        }

        setTexture((previousTexture) => {
          previousTexture?.dispose();
          return nextTexture;
        });
      } catch (error) {
        console.error('[CourtPlane] Failed to build court texture', error);

        if (cancelled) {
          return;
        }

        setTexture((previousTexture) => {
          previousTexture?.dispose();
          return null;
        });
      }
    }

    void buildTexture();

    return () => {
      cancelled = true;
    };
  }, [courtTextureUrl, courtSvgString, courtSvgElement, renderFn, widthPx, heightPx]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  return texture;
}

export function CourtPlane({
  courtWidth = COURT_W,
  courtHeight = COURT_H,
  y = 0,
  visible = true,
  ...textureInput
}: CourtPlaneProps) {
  const texture = useCourtTexture(textureInput);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;

    mat.map = texture;
    mat.color.set(texture ? '#ffffff' : '#d39f6a');
    mat.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={visible}>
      <planeGeometry args={[courtWidth, courtHeight]} />
      <meshBasicMaterial
        ref={materialRef}
        side={THREE.DoubleSide}
        toneMapped={false}
        color="#d39f6a"
      />
    </mesh>
  );
}
