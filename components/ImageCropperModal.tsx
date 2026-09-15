import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Crop, X, Check } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  aspectRatio: '16:9' | '9:16';
  onCropComplete: (croppedBlob: Blob) => void;
  onAspectRatioChange?: (newRatio: '16:9' | '9:16') => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  aspectRatio: initialAspectRatio,
  onCropComplete,
  onAspectRatioChange,
}) => {
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>(initialAspectRatio);
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [cropMode, setCropMode] = useState<'fill' | 'fit'>('fill');

  // Keep internal aspect ratio in sync with prop if changed from outside
  useEffect(() => {
    setAspectRatio(initialAspectRatio);
  }, [initialAspectRatio]);

  // Layout calculations
  const maxW = 320;
  const maxH = 320;
  const viewportWidth = aspectRatio === '16:9' ? maxW : maxW * (9 / 16);
  const viewportHeight = aspectRatio === '16:9' ? maxW * (9 / 16) : maxH;

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load natural image size
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Reset zoom and offset when modal opens or aspect ratio changes
  useEffect(() => {
    if (isOpen && imgSize) {
      setZoom(1.0);
      // Smart initial positioning: if the image is taller than the viewport, default towards the top so heads/sky aren't sliced off!
      const currentFitScale = Math.max(viewportWidth / (imgSize.width || 1), viewportHeight / (imgSize.height || 1));
      const renderedH = (imgSize.height || 1) * currentFitScale;
      const maxY = Math.max(0, (renderedH - viewportHeight) / 2);
      
      // If height is notably larger than width, default to Top alignment
      if (imgSize.height > imgSize.width * 1.05) {
        setOffset({ x: 0, y: maxY }); // Align to top!
      } else {
        setOffset({ x: 0, y: 0 });
      }
    }
  }, [isOpen, aspectRatio, imgSize]);

  if (!isOpen || !imageSrc) return null;

  const naturalWidth = imgSize?.width || 1;
  const naturalHeight = imgSize?.height || 1;

  // Scaling factor: 'fill' covers the bounds (standard crop), 'fit' fits entirely without any crop
  const fillScale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  const letterboxScale = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  const fitScale = cropMode === 'fill' ? fillScale : letterboxScale;

  const imageRenderWidth = naturalWidth * fitScale;
  const imageRenderHeight = naturalHeight * fitScale;

  // Helper to keep the offset in valid bounds
  const clampOffset = (x: number, y: number, currentZoom: number) => {
    if (cropMode === 'fit') {
      return { x: 0, y: 0 };
    }
    const maxX = Math.max(0, (imageRenderWidth * currentZoom - viewportWidth) / 2);
    const maxY = Math.max(0, (imageRenderHeight * currentZoom - viewportHeight) / 2);
    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY),
    };
  };

  const currentMaxY = Math.max(0, (imageRenderHeight * zoom - viewportHeight) / 2);

  // Alignment helpers
  const alignTop = () => {
    setOffset({ x: 0, y: currentMaxY });
  };
  const alignCenter = () => {
    setOffset({ x: 0, y: 0 });
  };
  const alignBottom = () => {
    setOffset({ x: 0, y: -currentMaxY });
  };

  const handleRatioSelect = (newRatio: '16:9' | '9:16') => {
    setAspectRatio(newRatio);
    onAspectRatioChange?.(newRatio);
  };

  // Keep offset clamped when zoom changes
  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, newZoom));
  };

  // Drag handles
  const handleStart = (clientX: number, clientY: number) => {
    if (cropMode === 'fit') return;
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || cropMode === 'fit') return;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    
    setOffset((prev) => {
      const targetX = prev.x + deltaX;
      const targetY = prev.y + deltaY;
      return clampOffset(targetX, targetY, zoom);
    });

    setDragStart({ x: clientX, y: clientY });
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Execute high resolution canvas crop
  const handleApplyCrop = () => {
    if (isCropping) return;
    setIsCropping(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        
        const targetWidth = aspectRatio === '16:9' ? 1280 : 720;
        const targetHeight = aspectRatio === '16:9' ? 720 : 1280;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (cropMode === 'fit') {
            // Fill background with soft dark backdrop and center uncropped image
            ctx.fillStyle = '#0f0f11';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            const scale = Math.min(targetWidth / naturalWidth, targetHeight / naturalHeight);
            const drawW = naturalWidth * scale;
            const drawH = naturalHeight * scale;
            const drawX = (targetWidth - drawW) / 2;
            const drawY = (targetHeight - drawH) / 2;

            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          } else {
            // Fill/Crop with user selected positioning and zoom
            const totalScale = fitScale * zoom;
            const viewLeftInRendered = (imageRenderWidth * zoom - viewportWidth) / 2 - offset.x;
            const viewTopInRendered = (imageRenderHeight * zoom - viewportHeight) / 2 - offset.y;

            const cropXInNatural = Math.max(0, viewLeftInRendered / totalScale);
            const cropYInNatural = Math.max(0, viewTopInRendered / totalScale);
            const cropWidthInNatural = Math.min(naturalWidth, viewportWidth / totalScale);
            const cropHeightInNatural = Math.min(naturalHeight, viewportHeight / totalScale);

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            
            ctx.drawImage(
              img,
              cropXInNatural,
              cropYInNatural,
              cropWidthInNatural,
              cropHeightInNatural,
              0,
              0,
              targetWidth,
              targetHeight
            );
          }

          canvas.toBlob(
            (blob) => {
              if (blob) {
                onCropComplete(blob);
                onClose();
              }
              setIsCropping(false);
            },
            'image/jpeg',
            0.95
          );
        } else {
          setIsCropping(false);
        }
      } catch (e) {
        console.error('Error cropping image:', e);
        setIsCropping(false);
      }
    };
    img.src = imageSrc;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-orange-50 to-peach-550 border border-orange-200/60 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-orange-950 text-base sm:text-lg">Crop & Position Canvas</h3>
              <p className="text-xs text-orange-800">Prevent image cutoff and align your subject</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-orange-100/65 hover:bg-orange-200/90 text-orange-900 transition-colors focus:outline-none cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Aspect Ratio Switcher Controls */}
        <div className="mb-3 bg-white/80 p-2.5 rounded-2xl border border-orange-200/60 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-orange-950">
            <span>Target Video Ratio:</span>
            <span className="text-[10px] text-orange-700 font-semibold">
              {imgSize ? `Original: ${imgSize.width}x${imgSize.height}` : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleRatioSelect('16:9')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                aspectRatio === '16:9'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-orange-100/60 text-orange-900 hover:bg-orange-100'
              }`}
            >
              <span>Landscape (16:9)</span>
            </button>
            <button
              type="button"
              onClick={() => handleRatioSelect('9:16')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                aspectRatio === '9:16'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-orange-100/60 text-orange-900 hover:bg-orange-100'
              }`}
            >
              <span>Portrait (9:16)</span>
            </button>
          </div>
        </div>

        {/* Fit vs Fill Mode Toggle */}
        <div className="flex items-center justify-between gap-2 mb-3 bg-orange-100/60 p-1.5 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setCropMode('fill')}
            className={`flex-1 py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
              cropMode === 'fill' ? 'bg-white text-orange-950 shadow-xs' : 'text-orange-800 hover:text-orange-950'
            }`}
          >
            Crop to Fill Frame
          </button>
          <button
            type="button"
            onClick={() => setCropMode('fit')}
            className={`flex-1 py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
              cropMode === 'fit' ? 'bg-white text-orange-950 shadow-xs' : 'text-orange-800 hover:text-orange-950'
            }`}
            title="Keep 100% of the image without any edge or top cutoff"
          >
            ✨ Fit Whole Image (No Cutoff)
          </button>
        </div>

        {/* Crop Stage Container */}
        <div className="flex justify-center items-center py-3 bg-zinc-900/10 rounded-2xl border border-orange-200/30 shadow-inner relative justify-self-center self-center w-full aspect-square max-w-[340px]">
          <div 
            className="relative border-2 border-orange-400 rounded-lg shadow-lg overflow-hidden select-none touch-none bg-zinc-950"
            style={{
              width: `${viewportWidth}px`,
              height: `${viewportHeight}px`,
            }}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={(e) => {
              if (e.touches && e.touches[0]) {
                handleStart(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches && e.touches[0]) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={handleEnd}
          >
            {/* The Image */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Cropping visual target"
              className="absolute max-w-none pointer-events-none origin-center"
              style={{
                width: `${imageRenderWidth}px`,
                height: `${imageRenderHeight}px`,
                transform: cropMode === 'fill'
                  ? `translate3d(${-imageRenderWidth / 2 + viewportWidth / 2 + offset.x}px, ${-imageRenderHeight / 2 + viewportHeight / 2 + offset.y}px, 0) scale(${zoom})`
                  : `translate3d(${-imageRenderWidth / 2 + viewportWidth / 2}px, ${-imageRenderHeight / 2 + viewportHeight / 2}px, 0)`,
                cursor: cropMode === 'fill' ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
              draggable={false}
            />

            {/* Mesh/Rule-of-Thirds Grid overlays in fill mode */}
            {cropMode === 'fill' && (
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-25">
                <div className="border-r border-b border-dashed border-white"></div>
                <div className="border-r border-b border-dashed border-white"></div>
                <div className="border-b border-dashed border-white"></div>
                <div className="border-r border-b border-dashed border-white"></div>
                <div className="border-r border-b border-dashed border-white"></div>
                <div className="border-b border-dashed border-white"></div>
                <div className="border-r border-dashed border-white"></div>
                <div className="border-r border-dashed border-white"></div>
                <div></div>
              </div>
            )}

            {/* Dark crop borders outside the crop window */}
            <div className="absolute inset-0 pointer-events-none ring-[10px] ring-black/40 ring-inset" />
          </div>
        </div>

        {/* Quick Position Alignment Presets (for Fill mode) */}
        {cropMode === 'fill' && (
          <div className="mt-2.5 bg-white/70 p-2 rounded-xl border border-orange-200/50 flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-orange-950 px-1">Quick Align:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={alignTop}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-950 transition-colors cursor-pointer"
                title="Align to top edge (protects heads and sky from cutoff)"
              >
                Top / Head
              </button>
              <button
                type="button"
                onClick={alignCenter}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-950 transition-colors cursor-pointer"
              >
                Center
              </button>
              <button
                type="button"
                onClick={alignBottom}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-950 transition-colors cursor-pointer"
              >
                Bottom
              </button>
            </div>
          </div>
        )}

        {/* Tip text */}
        <p className="text-center text-[11px] text-orange-850 font-medium mt-1.5">
          {cropMode === 'fill' 
            ? '💡 Drag the image or click "Top / Head" so faces and top details stay visible!'
            : '✨ Entire image fits inside with subtle letterboxing. Zero pixels cut off!'}
        </p>

        {/* Zoom Controls (Fill mode only) */}
        {cropMode === 'fill' && (
          <div className="mt-2 px-1">
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-orange-700" />
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.01"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 accent-orange-500 h-1.5 bg-orange-200 rounded-lg cursor-pointer"
              />
              <ZoomIn className="w-4 h-4 text-orange-700" />
              <span className="text-xs font-mono font-bold text-orange-900 leading-none w-10 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-200 font-bold rounded-xl transition-all active:scale-98 text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyCrop}
            disabled={isCropping}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98 text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isCropping ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Applying...
              </span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply Canvas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
