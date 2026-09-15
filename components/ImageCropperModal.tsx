import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Crop, X, Check } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  aspectRatio: '16:9' | '9:16';
  onCropComplete: (croppedBlob: Blob) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  aspectRatio,
  onCropComplete,
}) => {
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isCropping, setIsCropping] = useState<boolean>(false);

  // Layout calculations
  const maxW = 320;
  const maxH = 320;
  const viewportWidth = aspectRatio === '16:9' ? maxW : maxW * (9 / 16);
  const viewportHeight = aspectRatio === '16:9' ? maxW * (9 / 16) : maxH;

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset zoom and offset when modal opens or aspect ratio changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1.0);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, aspectRatio]);

  // Load natural image size
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const naturalWidth = imgSize?.width || 1;
  const naturalHeight = imgSize?.height || 1;

  // fitScale is the scaling factor to fit the image perfectly covering the crop viewport bounds (no white bars)
  const fitScale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  const imageRenderWidth = naturalWidth * fitScale;
  const imageRenderHeight = naturalHeight * fitScale;

  // Helper to keep the offset in valid bounds (no blank margins)
  const clampOffset = (x: number, y: number, currentZoom: number) => {
    const maxX = Math.max(0, (imageRenderWidth * currentZoom - viewportWidth) / 2);
    const maxY = Math.max(0, (imageRenderHeight * currentZoom - viewportHeight) / 2);
    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY),
    };
  };

  // Keep offset clamped when zoom changes
  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, newZoom));
  };

  // Drag handles
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
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

    // Create an image element to draw onto canvas
    const img = new Image();
    img.crossOrigin = 'anonymous'; // support CORS if any
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        
        // Exact high-res scaling mapping
        const totalScale = fitScale * zoom;
        const viewLeftInRendered = (imageRenderWidth * zoom - viewportWidth) / 2 - offset.x;
        const viewTopInRendered = (imageRenderHeight * zoom - viewportHeight) / 2 - offset.y;

        const cropXInNatural = viewLeftInRendered / totalScale;
        const cropYInNatural = viewTopInRendered / totalScale;
        const cropWidthInNatural = viewportWidth / totalScale;
        const cropHeightInNatural = viewportHeight / totalScale;

        // Set output video-friendly resolutions or source cropped resolution
        // Minimum target width for decent video generation of image is 1024 or natural scale
        const targetWidth = aspectRatio === '16:9' ? 1280 : 720;
        const targetHeight = aspectRatio === '16:9' ? 720 : 1280;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill background white/black just in case, but shouldn't have empty spots due to bounds capping
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
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
      <div className="relative w-full max-w-md bg-gradient-to-b from-orange-50 to-peach-550 border border-orange-200/60 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-orange-950 text-base sm:text-lg">Adjust Aspect Ratio</h3>
              <p className="text-xs text-orange-800">Crop and position your animation's canvas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-orange-100/65 hover:bg-orange-200/90 text-orange-900 transition-colors focus:outline-none"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Informational badge */}
        <div className="mb-4 bg-orange-500/10 border border-orange-200/40 rounded-xl p-2 text-center text-xs text-orange-900 font-bold flex items-center justify-center gap-1.5">
          <span>🎯 Currently:</span>
          <span className="bg-orange-500 text-white rounded px-1.5 py-0.5 text-[10px] font-mono tracking-wider font-extrabold uppercase">
            {aspectRatio === '16:9' ? 'Landscape (16:9)' : 'Portrait (9:16)'}
          </span>
        </div>

        {/* Crop Stage Container */}
        <div className="flex justify-center items-center py-4 bg-black/10 rounded-2xl border border-orange-200/30 shadow-inner relative justify-self-center self-center w-full aspect-square max-w-[340px]">
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
                transform: `translate3d(${-imageRenderWidth / 2 + viewportWidth / 2 + offset.x}px, ${-imageRenderHeight / 2 + viewportHeight / 2 + offset.y}px, 0) scale(${zoom})`,
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              draggable={false}
            />

            {/* Mesh/Rule-of-Thirds Grid overlays */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
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

            {/* Dark crop borders outside the crop window */}
            <div className="absolute inset-0 pointer-events-none ring-[10px] ring-black/40 ring-inset" />
          </div>
        </div>

        {/* Tip text */}
        <p className="text-center text-[11px] text-orange-850 font-medium mt-2">
          💡 Drag image to position. Use slider below to zoom.
        </p>

        {/* Zoom Controls */}
        <div className="mt-4 px-1">
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

        {/* Footer Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-200 font-bold rounded-xl transition-all active:scale-98 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyCrop}
            disabled={isCropping}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98 text-sm flex items-center justify-center gap-1.5"
          >
            {isCropping ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Applying...
              </span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply Crop
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
