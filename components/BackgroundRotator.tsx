import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Sparkles, 
  Upload, 
  Trash2, 
  Check, 
  Layers
} from 'lucide-react';

export interface BackgroundItem {
  id: string;
  url: string;
  title: string;
  isCustom?: boolean;
}

const DEFAULT_BACKGROUNDS: BackgroundItem[] = [
  {
    id: 'orchard',
    url: '/backgrounds/peach_orchard.jpg',
    title: 'Sunlit Orchard'
  },
  {
    id: 'splash',
    url: '/backgrounds/peach_splash.jpg',
    title: 'Juicy Water Splash'
  },
  {
    id: 'basket',
    url: '/backgrounds/peach_basket.jpg',
    title: 'Rustic Harvest'
  },
  {
    id: 'sunset',
    url: '/backgrounds/peach_sunset.jpg',
    title: 'Twilight Blossom'
  },
  {
    id: 'unsplash-splash',
    url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=2574&auto=format&fit=crop',
    title: 'Fruit Splash Classic'
  },
  {
    id: 'unsplash-peaches',
    url: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?q=80&w=2574&auto=format&fit=crop',
    title: 'Fresh Summer Peaches'
  }
];

export const BackgroundRotator: React.FC = () => {
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>(() => {
    try {
      const saved = localStorage.getItem('peachy_custom_backgrounds');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...DEFAULT_BACKGROUNDS, ...parsed];
        }
      }
    } catch (e) {
      console.error('Error loading custom backgrounds:', e);
    }
    return DEFAULT_BACKGROUNDS;
  });

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [rotationInterval, setRotationInterval] = useState<number>(8000); // 8 seconds
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Preload images into browser cache to ensure smooth crossfade transitions
  useEffect(() => {
    backgrounds.forEach((bg) => {
      const img = new Image();
      img.src = bg.url;
    });
  }, [backgrounds]);

  // Handle automatic rotation
  useEffect(() => {
    if (!isRotating || backgrounds.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % backgrounds.length);
    }, rotationInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRotating, backgrounds.length, rotationInterval]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % backgrounds.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + backgrounds.length) % backgrounds.length);
  };

  const handleSelect = (index: number) => {
    setCurrentIndex(index);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newBg: BackgroundItem = {
        id: `custom-${Date.now()}`,
        url: dataUrl,
        title: file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || 'Custom Image',
        isCustom: true
      };

      const updated = [...backgrounds, newBg];
      setBackgrounds(updated);
      setCurrentIndex(updated.length - 1);

      // Save custom ones in localStorage
      try {
        const customOnly = updated.filter(b => b.isCustom);
        localStorage.setItem('peachy_custom_backgrounds', JSON.stringify(customOnly));
      } catch (err) {
        console.error('Could not save to localStorage:', err);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = backgrounds.filter(b => b.id !== id);
    setBackgrounds(updated);
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1));
    }
    try {
      const customOnly = updated.filter(b => b.isCustom);
      localStorage.setItem('peachy_custom_backgrounds', JSON.stringify(customOnly));
    } catch (err) {
      console.error('Could not update localStorage:', err);
    }
  };

  return (
    <>
      {/* Background Rotating Layers with Crossfade */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-orange-50 select-none pointer-events-none">
        {backgrounds.map((bg, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={bg.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-90' : 'opacity-0'
              }`}
            >
              <img
                src={bg.url}
                alt={bg.title}
                className={`w-full h-full object-cover transition-transform duration-[12000ms] ease-out ${
                  isActive ? 'scale-105' : 'scale-100'
                }`}
              />
            </div>
          );
        })}
        {/* Soft white backdrop overlay to maintain high-contrast legibility */}
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/15 via-transparent to-orange-950/10" />
      </div>

      {/* Floating Rotating Controls (Bottom-Right Dock) */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end">
        {/* Expanded Background Drawer/Palette */}
        {isPanelOpen && (
          <div className="mb-2 w-72 sm:w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-orange-200/90 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-orange-100">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-extrabold text-orange-950">Background Rotation</span>
              </div>
              <span className="text-[10px] font-bold text-orange-700 bg-orange-100/80 px-2 py-0.5 rounded-full">
                {backgrounds.length} Photos
              </span>
            </div>

            {/* Thumbnail grid */}
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 mb-3">
              {backgrounds.map((bg, idx) => {
                const isSelected = idx === currentIndex;
                return (
                  <div
                    key={bg.id}
                    onClick={() => handleSelect(idx)}
                    className={`group relative aspect-video rounded-lg overflow-hidden border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-orange-500 ring-2 ring-orange-400 ring-offset-1 shadow-sm'
                        : 'border-orange-200/80 hover:border-orange-400 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={bg.url}
                      alt={bg.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-1">
                      <span className="text-[8px] font-bold text-white truncate drop-shadow">
                        {bg.title}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-orange-500 text-white rounded-full p-0.5 shadow">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}

                    {bg.isCustom && (
                      <button
                        onClick={(e) => handleDeleteCustom(bg.id, e)}
                        title="Remove custom image"
                        className="absolute top-1 left-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rotation Speed & Interval Selector */}
            <div className="flex items-center justify-between text-[11px] text-orange-900 font-semibold mb-3 bg-orange-50/70 p-2 rounded-xl border border-orange-100">
              <span>Auto-change every:</span>
              <div className="flex gap-1">
                {[
                  { label: '5s', ms: 5000 },
                  { label: '8s', ms: 8000 },
                  { label: '12s', ms: 12000 }
                ].map((speed) => (
                  <button
                    key={speed.ms}
                    type="button"
                    onClick={() => setRotationInterval(speed.ms)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                      rotationInterval === speed.ms
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-white text-orange-800 hover:bg-orange-100 border border-orange-200'
                    }`}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Custom Background Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add Custom Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Compact Floating Controller Pill */}
        <div className="flex items-center gap-1.5 bg-white/90 hover:bg-white backdrop-blur-md py-1.5 px-3 rounded-full border border-orange-200 shadow-lg text-xs text-orange-950 transition-all select-none">
          {/* Previous */}
          <button
            type="button"
            onClick={handlePrev}
            title="Previous Background"
            className="p-1 hover:bg-orange-100 text-orange-900 rounded-full transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Rotation / Current Status */}
          <button
            type="button"
            onClick={() => setIsRotating(prev => !prev)}
            title={isRotating ? "Pause background rotation" : "Start background rotation"}
            className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-orange-50 rounded-full font-semibold cursor-pointer transition-colors"
          >
            {isRotating ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-orange-950">
                  {backgrounds[currentIndex]?.title || 'Rotating'}
                </span>
                <span className="text-[9px] text-orange-600 font-mono">
                  ({currentIndex + 1}/{backgrounds.length})
                </span>
              </>
            ) : (
              <>
                <Pause className="w-2.5 h-2.5 text-amber-600" />
                <span className="text-[11px] font-bold text-orange-950">
                  Paused
                </span>
                <span className="text-[9px] text-orange-600 font-mono">
                  ({currentIndex + 1}/{backgrounds.length})
                </span>
              </>
            )}
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={handleNext}
            title="Next Background"
            className="p-1 hover:bg-orange-100 text-orange-900 rounded-full transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-orange-200 mx-0.5" />

          {/* Toggle Backgrounds Drawer/Gallery */}
          <button
            type="button"
            onClick={() => setIsPanelOpen(prev => !prev)}
            title="Choose Backgrounds & Uploads"
            className={`p-1 rounded-full transition-colors cursor-pointer ${
              isPanelOpen
                ? 'bg-orange-500 text-white'
                : 'hover:bg-orange-100 text-orange-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
