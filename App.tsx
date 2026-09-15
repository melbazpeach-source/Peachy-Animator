import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import Login from './Login';
import { PeachIcon } from './components/PeachIcon';
import { ImageCropperModal } from './components/ImageCropperModal';
import { BackgroundRotator } from './components/BackgroundRotator';
import { 
  getSavedVideos, 
  saveVideo, 
  deleteVideo, 
  SavedVideo 
} from './db';
import { auth } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  syncToFirestore, 
  getCloudAnimations, 
  deleteFromFirestore,
  testConnection 
} from './firebaseSync';
import { 
  Download, 
  Share2, 
  Trash2, 
  Play, 
  Pause,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Save, 
  FileVideo, 
  Image as ImageIcon, 
  Clock, 
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Library,
  Gauge,
  Palette,
  Film,
  Crop,
  Scissors,
  ChevronDown,
  Sliders,
  AlertCircle,
  Eye,
  Maximize2,
  AlertTriangle,
  X
} from 'lucide-react';
import { 
  VideoEngineId, 
  TextLLMId, 
  getVideoEngine, 
  ALL_VIDEO_ENGINES, 
  validateVideoEngineSelection,
  enhanceAnimationPrompt 
} from './providers';
import { ProviderSettings } from './components/ProviderSettings';

// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const loadingMessages = [
  "Warming up the animation engines...",
  "Teaching pixels how to dance...",
  "Gathering stardust for that extra sparkle...",
  "Peeling back the layers of reality...",
  "Sketching your vision into motion...",
  "This might take a minute, great art needs patience!",
  "Composing a symphony of frames...",
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:image/jpeg;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });

/**
 * Headroom & Motion Padding for Veo:
 * Pads the source image with extra empty space / headroom on top (and a bit on the sides)
 * before sending to Veo. Seamlessly extends the image's top edge (e.g. sky, wall, or backdrop)
 * so vertical movements like bounces, jumps, or hops have ample ceiling space and never clip.
 */
const preparePaddedImageForVeo = async (
  file: File,
  targetAspectRatio: '16:9' | '9:16'
): Promise<{ imageBytes: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = () => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        const isLandscape = targetAspectRatio === '16:9';
        const targetWidth = isLandscape ? 1280 : 720;
        const targetHeight = isLandscape ? 720 : 1280;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const rawBase64 = (reader.result as string).split(',')[1];
          return resolve({ imageBytes: rawBase64, mimeType: file.type });
        }

        // Sample top edge and bottom edge colors from source image to naturally blend the headroom
        let topColor = 'rgba(235, 235, 240, 1)';
        let bottomColor = 'rgba(215, 215, 220, 1)';

        try {
          const sampleCanvas = document.createElement('canvas');
          sampleCanvas.width = img.naturalWidth;
          sampleCanvas.height = img.naturalHeight;
          const sCtx = sampleCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(img, 0, 0);
            const midX = Math.floor(img.naturalWidth * 0.25);
            const spanW = Math.max(1, Math.floor(img.naturalWidth * 0.5));

            // Sample top edge row (e.g. sky above castle/head)
            const topData = sCtx.getImageData(midX, 0, spanW, Math.min(6, img.naturalHeight)).data;
            let rt = 0, gt = 0, bt = 0, ct = 0;
            for (let i = 0; i < topData.length; i += 4) {
              rt += topData[i];
              gt += topData[i + 1];
              bt += topData[i + 2];
              ct++;
            }
            if (ct > 0) {
              topColor = `rgb(${Math.round(rt / ct)}, ${Math.round(gt / ct)}, ${Math.round(bt / ct)})`;
            }

            // Sample bottom edge row (ground/floor)
            const botY = Math.max(0, img.naturalHeight - 6);
            const botData = sCtx.getImageData(midX, botY, spanW, Math.min(6, img.naturalHeight)).data;
            let rb = 0, gb = 0, bb = 0, cb = 0;
            for (let i = 0; i < botData.length; i += 4) {
              rb += botData[i];
              gb += botData[i + 1];
              bb += botData[i + 2];
              cb++;
            }
            if (cb > 0) {
              bottomColor = `rgb(${Math.round(rb / cb)}, ${Math.round(gb / cb)}, ${Math.round(bb / cb)})`;
            }
          }
        } catch (sampleErr) {
          console.warn("Could not sample image edge colors:", sampleErr);
        }

        // 1. Fill canvas background with subtle matching gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, targetHeight);
        bgGrad.addColorStop(0, topColor);
        bgGrad.addColorStop(0.65, topColor);
        bgGrad.addColorStop(1, bottomColor);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // 2. Add smooth, blurred image atmosphere so surrounding textures extend seamlessly
        ctx.save();
        ctx.filter = 'blur(45px)';
        ctx.globalAlpha = 0.4;
        ctx.drawImage(img, -15, -15, targetWidth + 30, targetHeight + 30);
        ctx.restore();

        // 3. Headroom & Motion Padding:
        // Reserve generous ceiling space (16%) on top and a safe margin on the sides
        // so upward movement (bounce, jump, hop) stays fully inside the frame.
        const topHeadroomPct = 0.16; // 16% headroom
        const sideMarginPct = 0.06;  // 6% side margin
        const bottomMarginPct = 0.04;// 4% bottom margin

        const maxAvailableW = targetWidth * (1 - sideMarginPct * 2);
        const maxAvailableH = targetHeight * (1 - topHeadroomPct - bottomMarginPct);

        const scale = Math.min(maxAvailableW / img.naturalWidth, maxAvailableH / img.naturalHeight);
        const drawW = Math.round(img.naturalWidth * scale);
        const drawH = Math.round(img.naturalHeight * scale);

        // Center horizontally
        const drawX = Math.round((targetWidth - drawW) / 2);
        // Anchor below the top headroom space with room to jump
        const drawY = Math.round(targetHeight * topHeadroomPct + (maxAvailableH - drawH) / 2);

        // 4. Draw sharp source image onto the padded canvas
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // Export as JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const base64 = dataUrl.split(',')[1];
        resolve({ imageBytes: base64, mimeType: 'image/jpeg' });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const STYLE_FILTERS = [
  {
    id: 'none',
    name: 'None',
    description: 'No filter applied. Pure cinematic video.',
    filterClass: '',
    previewColors: 'from-gray-100 to-gray-200 text-gray-800'
  },
  {
    id: 'vintage',
    name: 'Vintage Film',
    description: 'Warm analog tint, nostalgic sepia, and animated film grain textures.',
    filterClass: 'sepia-[35%] contrast-[115%] brightness-[95%] saturate-[90%]',
    previewColors: 'from-amber-100 to-amber-200 text-amber-900 border-amber-300'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Glitch-friendly neon saturation with striking pink and turquoise color shifts.',
    filterClass: 'contrast-[125%] saturate-[160%] hue-rotate-[-10deg]',
    previewColors: 'from-fuchsia-100 to-pink-200 text-fuchsia-900 border-fuchsia-300'
  },
  {
    id: 'bw',
    name: 'Black & White',
    description: 'Luminous monochrome silver tones coupled with an eye-safe vignette.',
    filterClass: 'grayscale-[100%] contrast-[135%] brightness-[95%]',
    previewColors: 'from-zinc-100 to-zinc-200 text-zinc-900 border-zinc-300'
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    description: 'Boosted saturation profiles producing ultra-colorful, rich animations.',
    filterClass: 'saturate-[185%] contrast-[115%] brightness-[105%]',
    previewColors: 'from-rose-100 to-orange-200 text-orange-950 border-orange-300'
  }
];

const renderOverlayEffect = (styleId: string) => {
  switch (styleId) {
    case 'vintage':
      return (
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_60%,rgba(0,0,0,0.6)_100%)]">
          <div 
             className="absolute inset-0 bg-repeat bg-center animate-grain opacity-25 pointer-events-none" 
             style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%\" height=\"100%\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }} 
          />
        </div>
      );
    case 'cyberpunk':
      return (
        <div className="absolute inset-0 pointer-events-none mix-blend-color opacity-25 bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-500" />
      );
    case 'bw':
      return (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_50%,rgba(0,0,0,0.55)_100%)]" />
      );
    case 'vibrant':
      return (
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-20 bg-gradient-to-b from-yellow-300 to-orange-500" />
      );
    default:
      return null;
  }
};

export type ExportPreset = 'social' | 'cinematic' | 'square';

export interface ExportPresetConfig {
  id: ExportPreset;
  name: string;
  label: string;
  badge: string;
  description: string;
  aspectRatioLabel: string;
  targetAspect: number;
  videoWidth: number;
  videoHeight: number;
  gifWidth: number;
  gifHeight: number;
  platformTags: string[];
}

export const EXPORT_PRESETS: Record<ExportPreset, ExportPresetConfig> = {
  social: {
    id: 'social',
    name: "'Social Media' (vertical)",
    label: 'Social Media',
    badge: '9:16 Vertical',
    description: 'Optimized for TikTok, Instagram Reels, YouTube Shorts, and vertical stories.',
    aspectRatioLabel: '9:16',
    targetAspect: 9 / 16,
    videoWidth: 720,
    videoHeight: 1280,
    gifWidth: 225,
    gifHeight: 400,
    platformTags: ['TikTok', 'Reels', 'Shorts', 'Stories']
  },
  cinematic: {
    id: 'cinematic',
    name: "'Cinematic' (16:9)",
    label: 'Cinematic',
    badge: '16:9 Widescreen',
    description: 'Optimized for YouTube, widescreen displays, TV, and cinematic presentations.',
    aspectRatioLabel: '16:9',
    targetAspect: 16 / 9,
    videoWidth: 1280,
    videoHeight: 720,
    gifWidth: 400,
    gifHeight: 225,
    platformTags: ['YouTube', 'Desktop', 'TV', 'Cinema']
  },
  square: {
    id: 'square',
    name: "'Square'",
    label: 'Square',
    badge: '1:1 Balanced',
    description: 'Optimized for Instagram feeds, carousels, Discord avatars, and square media.',
    aspectRatioLabel: '1:1',
    targetAspect: 1 / 1,
    videoWidth: 720,
    videoHeight: 720,
    gifWidth: 320,
    gifHeight: 320,
    platformTags: ['Instagram Feed', 'Discord', 'Carousels', 'Thumbnails']
  }
};

const App: React.FC = () => {
  // Authentication session state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('peachy_logged_in') === 'true';
    } catch {
      return false;
    }
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [apiKeySelected, setApiKeySelected] = useState<boolean | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState<boolean>(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [autoCrop, setAutoCrop] = useState<boolean>(false);

  const handleCropComplete = useCallback((croppedBlob: Blob) => {
    // Generate a file from the blob
    const croppedFile = new File([croppedBlob], imageFile?.name || "cropped_input.jpg", { type: 'image/jpeg' });
    setImageFile(croppedFile);
    
    // Revoke previous preview URL if it was an object URL
    if (imagePreview && imagePreview.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(imagePreview);
      } catch (e) {
        console.error("Error revoking imagePreview:", e);
      }
    }
    
    const previewUrl = URL.createObjectURL(croppedBlob);
    setImagePreview(previewUrl);
  }, [imageFile, imagePreview]);

  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [motionStrength, setMotionStrength] = useState<number>(5);
  const [styleFilter, setStyleFilter] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Storage / Persistence state
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [hasSavedCurrent, setHasSavedCurrent] = useState<boolean>(false);
  const [isSavingToDb, setIsSavingToDb] = useState<boolean>(false);
  const [isExportingGif, setIsExportingGif] = useState<boolean>(false);
  const [gifProgress, setGifProgress] = useState<string>('');
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(5);
  const [isExportingTrimmed, setIsExportingTrimmed] = useState<boolean>(false);
  const [trimProgress, setTrimProgress] = useState<string>('');
  const [exportPreset, setExportPreset] = useState<ExportPreset>('cinematic');
  const [mediaUrls, setMediaUrls] = useState<Record<string, { image: string; video: string }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Gallery Display Mode & Full-View Lightbox state
  const [galleryFitMode, setGalleryFitMode] = useState<'fit' | 'cover'>(() => {
    try {
      return (localStorage.getItem('peachy_gallery_fit_mode') as 'fit' | 'cover') || 'fit';
    } catch {
      return 'fit';
    }
  });
  const [galleryPreviewVideo, setGalleryPreviewVideo] = useState<SavedVideo | null>(null);
  const [isUploadedImagePortrait, setIsUploadedImagePortrait] = useState<boolean>(false);

  const handleToggleGalleryFitMode = (mode: 'fit' | 'cover') => {
    setGalleryFitMode(mode);
    try {
      localStorage.setItem('peachy_gallery_fit_mode', mode);
    } catch (e) {
      console.warn('Unable to persist gallery fit mode:', e);
    }
  };

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Custom Video Player states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Prompt History State
  const [recentPrompts, setRecentPrompts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('peachy_recent_prompts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Accordion state for options 3, 4, 5, 6, 7 (3 open by default)
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    '3': true,
    '4': false,
    '5': false,
    '6': false,
    '7': false,
  });

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Video Engine & Text LLM Provider State
  const [selectedVideoEngine, setSelectedVideoEngine] = useState<VideoEngineId>(() => {
    try {
      const saved = localStorage.getItem('peachy_selected_video_engine');
      if (saved && ALL_VIDEO_ENGINES.some(e => e.id === saved)) {
        return saved as VideoEngineId;
      }
    } catch {}
    return (process.env.SELECTED_VIDEO_ENGINE as VideoEngineId) || 'google-veo';
  });

  const [selectedTextLLM, setSelectedTextLLM] = useState<TextLLMId>(() => {
    try {
      const saved = localStorage.getItem('peachy_selected_text_llm');
      if (saved) return saved as TextLLMId;
    } catch {}
    return (process.env.SELECTED_TEXT_LLM as TextLLMId) || 'google';
  });

  const [isPromptAssisting, setIsPromptAssisting] = useState<boolean>(false);
  const [videoEngineError, setVideoEngineError] = useState<string | null>(null);

  const handleSelectVideoEngine = (engineId: VideoEngineId) => {
    setSelectedVideoEngine(engineId);
    setVideoEngineError(null);
    try {
      localStorage.setItem('peachy_selected_video_engine', engineId);
    } catch {}
  };

  const handleSelectTextLLM = (llmId: TextLLMId) => {
    setSelectedTextLLM(llmId);
    try {
      localStorage.setItem('peachy_selected_text_llm', llmId);
    } catch {}
  };

  const handlePromptAssist = async () => {
    if (selectedTextLLM === 'none') {
      setError("Please select a Text LLM (Google, OpenAI, xAI, Anthropic, or Ollama) in Settings (Section 7) to use AI Prompt Assist.");
      setOpenAccordions(prev => ({ ...prev, '7': true }));
      return;
    }
    setIsPromptAssisting(true);
    setError(null);
    try {
      const enhanced = await enhanceAnimationPrompt(selectedTextLLM, prompt, imageFile?.name);
      setPrompt(enhanced);
    } catch (err: any) {
      console.error("Prompt assist error:", err);
      setError(`Prompt Assist (${selectedTextLLM}) failed: ${err.message || err}`);
    } finally {
      setIsPromptAssisting(false);
    }
  };

  const loadingIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial connection test and Auth listener mount
  useEffect(() => {
    testConnection();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load animations and sync between IndexedDB and Cloud Firestore
  useEffect(() => {
    const loadAndSync = async () => {
      setIsSyncing(true);
      try {
        // First load local animations
        const localVideos = await getSavedVideos();
        
        if (user) {
          // If signed in, fetch cloud animations
          const cloudVideos = await getCloudAnimations(user.uid);
          
          // Map cloud animations by ID for quick lookup
          const cloudMap = new Map(cloudVideos.map(v => [v.id, v]));
          const localMap = new Map(localVideos.map(v => [v.id, v]));
          
          // We will construct a merged list
          const mergedList: SavedVideo[] = [...localVideos];
          
          // Add any animations only present on cloud (not local)
          cloudVideos.forEach((cloudV) => {
            if (!localMap.has(cloudV.id)) {
              mergedList.push({
                id: cloudV.id,
                prompt: cloudV.prompt,
                aspectRatio: cloudV.aspectRatio,
                durationSeconds: cloudV.durationSeconds,
                motionStrength: cloudV.motionStrength,
                styleFilter: cloudV.styleFilter,
                createdAt: cloudV.createdAt,
                videoUrl: cloudV.videoUrl,
                isCloud: true
              });
            }
          });

          // Background sync: any local videos that are NOT on the cloud yet, sync them up!
          for (const localV of localVideos) {
            if (!cloudMap.has(localV.id)) {
              try {
                await syncToFirestore(localV, user.uid);
                console.log(`Auto-synced local animation ${localV.id} to cloud Firestore`);
              } catch (e) {
                console.error(`Failed to auto-sync ${localV.id} to cloud:`, e);
              }
            }
          }

          // Sort merged list descending by createdAt
          mergedList.sort((a, b) => b.createdAt - a.createdAt);
          setSavedVideos(mergedList);
        } else {
          // If not signed in, just show local videos
          setSavedVideos(localVideos);
        }
      } catch (err) {
        console.error("Error syncing animations:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    if (!isAuthLoading) {
      loadAndSync();
    }
  }, [user, isAuthLoading]);

  // Manage object URLs cleanly to prevent memory leaks and flickers
  useEffect(() => {
    const newMediaUrls: Record<string, { image: string; video: string }> = {};
    
    savedVideos.forEach(v => {
      if (mediaUrls[v.id]) {
        newMediaUrls[v.id] = mediaUrls[v.id];
      } else {
        const image = v.imageBlob ? URL.createObjectURL(v.imageBlob) : '';
        const video = v.videoBlob ? URL.createObjectURL(v.videoBlob) : (v.videoUrl || '');
        newMediaUrls[v.id] = { image, video };
      }
    });

    // Revoke any removed media items' URLs
    Object.keys(mediaUrls).forEach(id => {
      if (!newMediaUrls[id]) {
        if (mediaUrls[id].image) URL.revokeObjectURL(mediaUrls[id].image);
        if (mediaUrls[id].video) URL.revokeObjectURL(mediaUrls[id].video);
      }
    });

    setMediaUrls(newMediaUrls);
  }, [savedVideos]);

  // Clean up remaining URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(mediaUrls).forEach(urls => {
        if (urls.image) URL.revokeObjectURL(urls.image);
        if (urls.video) URL.revokeObjectURL(urls.video);
      });
    };
  }, []);

  // Drag and drop mechanics
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleReset();
      if (!autoCrop) {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setRawImageSrc(result);
        const img = new Image();
        img.onload = () => {
          setIsUploadedImagePortrait(img.naturalHeight > img.naturalWidth * 1.05);
        };
        img.src = result;
        if (autoCrop) {
          setIsCropperOpen(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const checkKey = async () => {
      try {
        const envKey = process.env.API_KEY || (import.meta as any).env?.VITE_PEACHY_KEY || (process as any).env?.GEMINI_API_KEY;
        if (envKey && envKey !== 'PLACEHOLDER_API_KEY') {
          setApiKeySelected(true);
          return;
        }
        if (window.aistudio) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setApiKeySelected(hasKey);
        } else {
            // Fallback for local development
            console.warn("aistudio context not found. Assuming API key is set in environment.")
            setApiKeySelected(true);
        }
      } catch (e) {
        console.error("Error checking for API key:", e);
        setApiKeySelected(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKeyClick = async () => {
    try {
      if(window.aistudio) {
        await window.aistudio.openSelectKey();
        setApiKeySelected(true);
        setError(null);
      }
    } catch (e) {
      console.error("Could not open API key selection:", e);
      setError("Failed to open the API key selection dialog. Please try again.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleReset();
      if (!autoCrop) {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setRawImageSrc(result);
        const img = new Image();
        img.onload = () => {
          setIsUploadedImagePortrait(img.naturalHeight > img.naturalWidth * 1.05);
        };
        img.src = result;
        if (autoCrop) {
          setIsCropperOpen(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateVideo = useCallback(async () => {
    if (!imageFile || !prompt.trim()) {
      setError("Please provide an image and a prompt.");
      return;
    }
    setError(null);
    setIsLoading(true);

    // Validate selected video engine - Show plain error if someone picks a text LLM as the animator
    const validation = validateVideoEngineSelection(selectedVideoEngine);
    if (!validation.valid) {
      const plainError = validation.error || `Cannot use "${selectedVideoEngine}" as the video animator. Peachy requires a dedicated video engine (such as Google Veo) to animate images.`;
      setVideoEngineError(plainError);
      setError(plainError);
      return;
    }

    const engine = getVideoEngine(selectedVideoEngine);
    if (!engine.hasKey()) {
      const keyError = `Video engine key missing: Please configure ${engine.requiredEnvVar} in your environment to use ${engine.name}.`;
      setError(keyError);
      return;
    }

    setError(null);
    setVideoEngineError(null);
    setIsLoading(true);

    // Save prompt to history
    const trimmedPrompt = prompt.trim();
    setRecentPrompts(prev => {
      const filtered = prev.filter(p => p !== trimmedPrompt);
      const updated = [trimmedPrompt, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('peachy_recent_prompts', JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save prompt history:", err);
      }
      return updated;
    });

    loadingIntervalRef.current = window.setInterval(() => {
      setLoadingMessage(
        loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
      );
    }, 3000);
    
    try {
      // 1. Prepare image with headroom & motion padding:
      // If the source image is tight, pad/letterbox it before Veo so bounce/jump motions have headroom.
      const paddedImage = await preparePaddedImageForVeo(imageFile, aspectRatio);
      
      const getMotionDescriptor = (strength: number): string => {
        if (strength <= 2) return "slight subtle movement, gentle sway, almost still, cinematic calm, slow panning";
        if (strength <= 4) return "gentle motion, slow smooth kinetic flow, moderate drift";
        if (strength <= 6) return "standard movement, balanced normal action, natural cinema motion";
        if (strength <= 8) return "dynamic active motion, vibrant moving elements, fast fluid camera sweep";
        return "extremely high velocity motion, explosive rapid movement, cinematic fast tracking, hyper kinetic energetic flow";
      };

      const userPromptLower = prompt.toLowerCase();
      const isVerticalMotion = 
        userPromptLower.includes('jump') || 
        userPromptLower.includes('bounce') || 
        userPromptLower.includes('hop') || 
        userPromptLower.includes('leap');

      // 2. Framing lock: Prepend to user prompt on every generateVideos call (do not replace user prompt)
      const framingLockPrefix = isVerticalMotion
        ? "Bounce in place, small amplitude. Locked camera, no pan, no zoom, no tilt. Keep the full subject inside the frame with a small margin. The entire subject and all top details stay fully visible for every frame. Nothing may exit the top edge. "
        : "Locked camera, no pan, no zoom, no tilt. Keep the full subject inside the frame with a small margin. Nothing important may leave the edges. ";

      const finalPrompt = `${framingLockPrefix}${prompt.trim()}, ${getMotionDescriptor(motionStrength)}`;

      // Execute via the selected video engine interface
      const videoBlob = await engine.generateVideo(
        {
          image: {
            imageBytes: paddedImage.imageBytes,
            mimeType: paddedImage.mimeType,
          },
          prompt: finalPrompt,
          aspectRatio,
          durationSeconds,
          motionStrength
        },
        (progressMessage) => {
          setLoadingMessage(progressMessage);
        }
      );

      setCurrentVideoBlob(videoBlob);
      setHasSavedCurrent(false);
      setVideoUrl(URL.createObjectURL(videoBlob));
      setExportPreset(aspectRatio === '9:16' ? 'social' : 'cinematic');

    } catch (err: any) {
      let errorMessage = err.message || "An unknown error occurred.";
      const errStr = typeof err === 'object' ? JSON.stringify(err) : String(err);
      
      // Quota / billing / permission errors stay Google-shaped for Veo. Don't map them onto other vendors.
      if (engine.id === 'google-veo') {
        if (
          errorMessage.includes("403") ||
          errorMessage.includes("PERMISSION_DENIED") ||
          errStr.includes("PERMISSION_DENIED") ||
          errStr.includes("403") ||
          errorMessage.toLowerCase().includes("does not have permission") ||
          errStr.toLowerCase().includes("does not have permission")
        ) {
          errorMessage = "Permission Denied (403): Google Veo requires an API key associated with a Google Cloud project with billing/paid tier enabled. Please verify your project billing in AI Studio or select a paid API key.";
        } else if (
          errorMessage.includes("429") || 
          errorMessage.includes("RESOURCE_EXHAUSTED") || 
          errorMessage.toLowerCase().includes("quota") ||
          errStr.includes("RESOURCE_EXHAUSTED") || 
          errStr.includes("429")
        ) {
          errorMessage = "You have reached your current Gemini/Veo quota limit (429 RESOURCE_EXHAUSTED). Video generation models require an API key with available quota or an active billing plan. Please select or switch your API key to continue.";
        } else if (errorMessage.includes("Requested entity was not found")) {
          errorMessage = "Your API key is invalid or not found. Please select a valid key and try again.";
          setApiKeySelected(false);
        } else if (errorMessage.includes("API key not valid")) {
          errorMessage = "Your API key is not valid. Please select a valid key and try again.";
          setApiKeySelected(false);
        }
      }
      console.error("Video generation error:", err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    }
  }, [imageFile, prompt, aspectRatio, durationSeconds, motionStrength, styleFilter, selectedVideoEngine]);

  // Synchronize player time / settings when URL changes
  useEffect(() => {
    if (videoUrl) {
      setIsPlaying(true);
      setCurrentTime(0);
      setPlaybackRate(1);
      setTrimStart(0);
      setTrimEnd(videoDuration || durationSeconds || 5);
    }
  }, [videoUrl, videoDuration, durationSeconds]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(err => console.log("Playback interrupted:", err));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    
    if (time > trimEnd) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    } else if (time < trimStart) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    } else {
      setCurrentTime(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    setVideoDuration(dur);
    setTrimStart(0);
    setTrimEnd(dur || durationSeconds || 5);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleStep = (amount: number) => {
    if (!videoRef.current) return;
    // Pause on manual stepping so user can inspect frame
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    let nextTime = videoRef.current.currentTime + amount;
    if (nextTime < 0) nextTime = 0;
    if (nextTime > videoDuration) nextTime = videoDuration;
    
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleSpeedChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleReset = () => {
    setVideoUrl(null);
    setError(null);
    setImageFile(null);
    setImagePreview(null);
    setPrompt('');
    setStyleFilter('none');
    setCurrentVideoBlob(null);
    setHasSavedCurrent(false);
    setIsUploadedImagePortrait(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleLogin = async () => {
    setIsAuthLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login failed:", err);
      setError("Failed to sign in with Google: " + (err.message || String(err)));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthLoading(true);
    try {
      await signOut(auth);
      try {
        localStorage.removeItem('peachy_logged_in');
        localStorage.removeItem('peachy_user_email');
      } catch {}
      setIsLoggedIn(false);
      // Fallback: reset list to localIndexedDB items
      const localVideos = await getSavedVideos();
      setSavedVideos(localVideos);
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsAuthLoading(false);
    }
  };

   const handleSaveToBrowser = async () => {
    if (!currentVideoBlob || !prompt.trim() || hasSavedCurrent) return;
    setIsSavingToDb(true);
    setError(null);
    try {
      const savedRecord = await saveVideo({
        prompt: prompt,
        aspectRatio: aspectRatio,
        durationSeconds: durationSeconds,
        motionStrength: motionStrength,
        styleFilter: styleFilter,
        videoBlob: currentVideoBlob,
        imageBlob: imageFile || undefined,
      });

      if (user) {
        // Double-save to Cloud Firestore if signed in
        await syncToFirestore({
          id: savedRecord.id,
          prompt: prompt,
          aspectRatio: aspectRatio,
          durationSeconds: durationSeconds,
          motionStrength: motionStrength,
          styleFilter: styleFilter,
          createdAt: savedRecord.createdAt,
        }, user.uid, videoUrl || undefined);
      }

      setSavedVideos(prev => [savedRecord, ...prev]);
      setHasSavedCurrent(true);
    } catch (err) {
      console.error("Error saving video:", err);
      setError("Failed to save animation to your browser library.");
    } finally {
      setIsSavingToDb(false);
    }
  };

  const handleDeleteVideo = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this animation?")) {
      return;
    }
    try {
      await deleteVideo(id);

      if (user) {
        // Also delete from Cloud Firestore if signed in
        await deleteFromFirestore(id, user.uid);
      }

      setSavedVideos(prev => prev.filter(v => v.id !== id));
      if (hasSavedCurrent) {
        setHasSavedCurrent(false);
      }
    } catch (err) {
      console.error("Error deleting video:", err);
    }
  };

  const handleLoadSavedVideo = (video: SavedVideo) => {
    setError(null);
    setPrompt(video.prompt);
    setAspectRatio(video.aspectRatio);
    setDurationSeconds(video.durationSeconds || 5);
    setMotionStrength(video.motionStrength || 5);
    setStyleFilter(video.styleFilter || 'none');
    
    if (video.imageBlob) {
      const imgUrl = URL.createObjectURL(video.imageBlob);
      setImagePreview(imgUrl);
      setImageFile(new File([video.imageBlob], "thumbnail.png", { type: video.imageBlob.type }));
    } else {
      setImagePreview(null);
      setImageFile(null);
    }
    
    if (video.videoBlob) {
      const vUrl = URL.createObjectURL(video.videoBlob);
      setVideoUrl(vUrl);
      setCurrentVideoBlob(video.videoBlob);
    } else if (video.videoUrl) {
      setVideoUrl(video.videoUrl);
      setCurrentVideoBlob(null); // we stream directly from the cloud Url
    }
    setExportPreset(video.aspectRatio === '9:16' ? 'social' : 'cinematic');
    setHasSavedCurrent(true);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isTrimmed = trimStart > 0.01 || trimEnd < (videoDuration - 0.01 || 4.99);

  const createTrimmedBlob = async (options?: { preset?: ExportPreset; ignoreTrim?: boolean }): Promise<Blob> => {
    if (!videoUrl) throw new Error("No video URL loaded.");

    const activePreset = options?.preset || exportPreset;
    const presetConfig = EXPORT_PRESETS[activePreset];

    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video metadata for trimming."));
    });

    const targetWidth = presetConfig.videoWidth;
    const targetHeight = presetConfig.videoHeight;
    const targetAspect = presetConfig.targetAspect;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not initialize 2D context.");

    let filterStr = 'none';
    if (styleFilter === 'vintage') {
      filterStr = 'sepia(35%) contrast(115%) brightness(95%) saturate(90%)';
    } else if (styleFilter === 'cyberpunk') {
      filterStr = 'contrast(125%) saturate(160%) hue-rotate(-10deg)';
    } else if (styleFilter === 'bw') {
      filterStr = 'grayscale(100%) contrast(135%) brightness(95%)';
    } else if (styleFilter === 'vibrant') {
      filterStr = 'saturate(185%) contrast(115%) brightness(105%)';
    }

    // Compute center-crop parameters from source video into preset aspect
    const sourceVideoWidth = video.videoWidth || targetWidth;
    const sourceVideoHeight = video.videoHeight || targetHeight;
    const sourceAspect = sourceVideoWidth / sourceVideoHeight;

    let sx = 0;
    let sy = 0;
    let sWidth = sourceVideoWidth;
    let sHeight = sourceVideoHeight;

    if (sourceAspect > targetAspect) {
      sWidth = sourceVideoHeight * targetAspect;
      sx = (sourceVideoWidth - sWidth) / 2;
    } else {
      sHeight = sourceVideoWidth / targetAspect;
      sy = (sourceVideoHeight - sHeight) / 2;
    }

    const stream = canvas.captureStream(30); // 30 FPS

    let selectedMime = '';
    const mimeTypes = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMime || undefined,
      videoBitsPerSecond: 2500000
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordingCompleted = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMime || 'video/webm' });
        resolve(blob);
      };
    });

    mediaRecorder.start();

    const startSec = options?.ignoreTrim ? 0 : trimStart;
    const endSec = options?.ignoreTrim ? (videoDuration || 5) : trimEnd;
    const duration = Math.max(0.2, endSec - startSec);
    const fps = 30;
    const interval = 1 / fps;
    const totalNumFrames = Math.ceil(duration / interval);

    for (let i = 0; i < totalNumFrames; i++) {
      const time = startSec + (i * interval);
      video.currentTime = Math.min(time, endSec - 0.01);

      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.filter = filterStr;
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

      ctx.filter = 'none';
      if (styleFilter === 'vintage') {
        const grad = ctx.createRadialGradient(targetWidth/2, targetHeight/2, Math.min(targetWidth, targetHeight)*0.3, targetWidth/2, targetHeight/2, Math.max(targetWidth, targetHeight)*0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else if (styleFilter === 'cyberpunk') {
        ctx.fillStyle = 'rgba(236, 72, 153, 0.08)';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else if (styleFilter === 'bw') {
        const grad = ctx.createRadialGradient(targetWidth/2, targetHeight/2, Math.min(targetWidth, targetHeight)*0.25, targetWidth/2, targetHeight/2, Math.max(targetWidth, targetHeight)*0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else if (styleFilter === 'vibrant') {
        const grad = ctx.createLinearGradient(0, 0, 0, targetHeight);
        grad.addColorStop(0, 'rgba(253, 224, 71, 0.04)');
        grad.addColorStop(1, 'rgba(249, 115, 22, 0.04)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      setTrimProgress(`Processing ${presetConfig.label} export: ${Math.round(((i + 1) / totalNumFrames) * 100)}%`);
    }

    mediaRecorder.stop();
    return await recordingCompleted;
  };

  const handleDownloadPresetVideo = async (ignoreTrim = false) => {
    if (!videoUrl) return;
    const presetConfig = EXPORT_PRESETS[exportPreset];
    const isOriginalAspectMatch = 
      (aspectRatio === '16:9' && exportPreset === 'cinematic') ||
      (aspectRatio === '9:16' && exportPreset === 'social');

    // If matches original aspect ratio, has no trim (or ignoreTrim), and no live filter applied, direct download
    if (isOriginalAspectMatch && (!isTrimmed || ignoreTrim) && styleFilter === 'none') {
      handleDownloadOriginal();
      return;
    }

    setIsExportingTrimmed(true);
    setTrimProgress(`Preparing ${presetConfig.label} (${presetConfig.aspectRatioLabel})...`);
    try {
      const exportBlob = await createTrimmedBlob({ preset: exportPreset, ignoreTrim });
      const isMp4 = exportBlob.type.includes('mp4');
      const ext = isMp4 ? 'mp4' : 'webm';

      const downloadUrl = URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `peachy-${exportPreset}-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Preset export failed, downloading original direct:", err);
      handleDownloadOriginal();
    } finally {
      setIsExportingTrimmed(false);
      setTrimProgress('');
    }
  };

  const handleDownloadOriginal = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `peachy-original-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (!videoUrl) return;
    setIsSharing(true);
    setTrimProgress("Preparing share video...");
    try {
      const presetConfig = EXPORT_PRESETS[exportPreset];
      const isOriginalAspectMatch = 
        (aspectRatio === '16:9' && exportPreset === 'cinematic') ||
        (aspectRatio === '9:16' && exportPreset === 'social');

      let blob: Blob;
      if (isTrimmed || !isOriginalAspectMatch || styleFilter !== 'none') {
        blob = await createTrimmedBlob({ preset: exportPreset });
      } else {
        const response = await fetch(videoUrl);
        blob = await response.blob();
      }
      const isMp4 = blob.type.includes('mp4');
      const ext = isMp4 ? 'mp4' : 'webm';
      const file = new File([blob], `peachy-${exportPreset}.${ext}`, { type: blob.type || "video/mp4" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Peachy Animation',
          text: `Check out this ${presetConfig.name} video I made with Peachy! Prompt: "${prompt}"`,
        });
      } else {
        // Fallback if share sheet isn't available
        await handleDownloadPresetVideo();
      }
    } catch (error) {
      console.error("Error sharing:", error);
    } finally {
      setIsSharing(false);
      setTrimProgress('');
    }
  };

  const handleExportGif = async () => {
    if (!currentVideoBlob && !videoUrl) return;
    setIsExportingGif(true);
    setGifProgress("Loading video metadata...");
    setError(null);

    try {
      const presetConfig = EXPORT_PRESETS[exportPreset];
      const video = document.createElement('video');
      const url = currentVideoBlob ? URL.createObjectURL(currentVideoBlob) : (videoUrl || '');
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      // Wait for metadata
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Unable to load video for GIF rendering."));
      });

      // Target dimensions from the selected preset
      const width = presetConfig.gifWidth;
      const height = presetConfig.gifHeight;
      const targetAspect = presetConfig.targetAspect;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not initialize 2D rendering canvas context.");

      // Calculate center crop from source video into preset aspect
      const sourceVideoWidth = video.videoWidth || width;
      const sourceVideoHeight = video.videoHeight || height;
      const sourceAspect = sourceVideoWidth / sourceVideoHeight;

      let sx = 0;
      let sy = 0;
      let sWidth = sourceVideoWidth;
      let sHeight = sourceVideoHeight;

      if (sourceAspect > targetAspect) {
        sWidth = sourceVideoHeight * targetAspect;
        sx = (sourceVideoWidth - sWidth) / 2;
      } else {
        sHeight = sourceVideoWidth / targetAspect;
        sy = (sourceVideoHeight - sHeight) / 2;
      }

      // Calculate sample frames
      const fps = 8;
      const frameInterval = 1 / fps;
      const startSec = trimStart;
      const endSec = trimEnd;
      const duration = Math.max(0.2, endSec - startSec);
      const totalFrames = Math.ceil(duration / frameInterval);

      const gif = GIFEncoder();
      gif.writeHeader();

      // Map active style filters to native context filters for permanent rendering
      let filterStr = 'none';
      if (styleFilter === 'vintage') {
        filterStr = 'sepia(35%) contrast(115%) brightness(95%) saturate(90%)';
      } else if (styleFilter === 'cyberpunk') {
        filterStr = 'contrast(125%) saturate(160%) hue-rotate(-10deg)';
      } else if (styleFilter === 'bw') {
        filterStr = 'grayscale(100%) contrast(135%) brightness(95%)';
      } else if (styleFilter === 'vibrant') {
        filterStr = 'saturate(185%) contrast(115%) brightness(105%)';
      }

      // Sync and seek starting point
      video.currentTime = startSec;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      for (let i = 0; i < totalFrames; i++) {
        const time = startSec + (i * frameInterval);
        video.currentTime = Math.min(time, endSec - 0.01);

        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        // 1. Draw frame to canvas under filter with center crop
        ctx.clearRect(0, 0, width, height);
        ctx.filter = filterStr;
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, width, height);

        // 2. Draw custom aesthetic vector overlays/vignettes
        ctx.filter = 'none';
        if (styleFilter === 'vintage') {
          const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.75);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.3)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          for (let s = 0; s < 120; s++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            const rSize = Math.random() * 1.8 + 0.8;
            ctx.fillRect(rx, ry, rSize, rSize);
          }
        } else if (styleFilter === 'cyberpunk') {
          ctx.fillStyle = 'rgba(236, 72, 153, 0.08)';
          ctx.fillRect(0, 0, width, height);
        } else if (styleFilter === 'bw') {
          const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.75);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.45)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
        } else if (styleFilter === 'vibrant') {
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, 'rgba(253, 224, 71, 0.04)');
          grad.addColorStop(1, 'rgba(249, 115, 22, 0.04)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
        }

        // 3. Extract and compress pixel channels using gifenc
        const imgData = ctx.getImageData(0, 0, width, height);
        const rgba = imgData.data;

        const palette = quantize(rgba, 256);
        const index = applyPalette(rgba, palette, 'rgb565');

        gif.addFrame(index, width, height, {
          palette,
          delay: Math.round(frameInterval * 1000)
        });

        // 4. Update progression
        const pct = Math.round(((i + 1) / totalFrames) * 100);
        setGifProgress(`Baking ${presetConfig.label} GIF: ${pct}%`);
      }

      gif.finish();
      const bytes = gif.bytes();
      const gifBlob = new Blob([bytes], { type: 'image/gif' });
      
      const downloadUrl = URL.createObjectURL(gifBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `peachy-${exportPreset}-${Date.now()}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      if (currentVideoBlob) {
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error("GIF generation failed:", err);
      setError("Failed to convert video animation to GIF format. Please try again.");
    } finally {
      setIsExportingGif(false);
      setGifProgress('');
    }
  };

  const renderContent = () => {
    if (apiKeySelected === null) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <PeachIcon className="w-20 h-20 animate-pulse" />
          <p className="text-orange-900 font-medium">Checking API key...</p>
        </div>
      );
    }
    
    if (!apiKeySelected) {
      return (
         <div className="text-center space-y-6">
            <div className="inline-block p-4 bg-orange-100 rounded-full">
                 <PeachIcon className="w-16 h-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-orange-900">Welcome to Peachy Web!</h2>
            <p className="text-orange-800">To animate videos with Veo, you'll need to select a Google AI API key.</p>
             <p className="text-xs text-orange-700">
                Please ensure you have enabled billing for your project. For more information, visit{' '}
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-orange-900">
                    AI Platform Billing
                </a>.
            </p>
            <button onClick={handleSelectKeyClick} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                Select API Key
            </button>
            {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-sm">{error}</p>}
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="text-center py-12">
            <PeachIcon className="w-32 h-32 mx-auto animate-bounce mb-8" />
            <p className="text-xl font-semibold text-orange-900 animate-pulse px-4">{loadingMessage}</p>
        </div>
      )
    }

    if (videoUrl) {
      const activeFilter = STYLE_FILTERS.find(f => f.id === styleFilter) || STYLE_FILTERS[0];
      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-center text-orange-900">Your Peachy Animation!</h2>
          
          <div 
            className="relative rounded-xl overflow-hidden shadow-lg border-4 border-white bg-black cursor-pointer group/video"
            onClick={togglePlay}
          >
            <video 
              ref={videoRef}
              src={videoUrl} 
              autoPlay 
              loop 
              muted={isMuted}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className={`w-full h-auto max-h-[60vh] mx-auto transition-all duration-300 ${activeFilter.filterClass}`} 
            />
            {renderOverlayEffect(styleFilter)}
            
            {/* Play/Pause Overlay Indicator on Hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/video:opacity-100 transition-opacity duration-200 pointer-events-none">
              <div className="p-4 bg-black/60 rounded-full text-white backdrop-blur-sm">
                {isPlaying ? <Pause className="w-8 h-8 animate-pulse" /> : <Play className="w-8 h-8 translate-x-0.5 fill-current" />}
              </div>
            </div>
          </div>

          {/* Custom Video Player Scrubber & Advanced Inspection Controls */}
          <div className="bg-gradient-to-br from-orange-50/70 to-pink-50/20 p-4.5 rounded-2xl border border-orange-200/50 shadow-sm space-y-4">
            {/* Scrubber Time Bar Row */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono font-extrabold text-orange-950 bg-orange-100/60 px-2 py-0.5 rounded-md select-none min-w-[50px] text-center">
                {currentTime.toFixed(2)}s
              </span>
              
              <div className="relative flex-1 group">
                <input 
                  type="range"
                  min={0}
                  max={videoDuration || 5}
                  step={0.01}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 rounded-lg appearance-none cursor-ew-resize bg-orange-200 accent-gradient-to-r from-orange-500 to-pink-500 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all [&::-webkit-slider-runnable-track]:bg-orange-100 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-125"
                />
              </div>

              <span className="text-[11px] font-mono font-extrabold text-orange-950 bg-orange-100/60 px-2 py-0.5 rounded-md select-none min-w-[50px] text-center">
                {videoDuration ? `${videoDuration.toFixed(2)}s` : '5.00s'}
              </span>
            </div>

            {/* Visual Timeline Trim Slider Section */}
            <div className="pt-3.5 border-t border-orange-200/25 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-bold text-orange-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Scissors className="w-3.5 h-3.5 text-pink-500" />
                  Define Trim & Loop region
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full border border-pink-100 shadow-2xs select-none">
                  {isTrimmed 
                    ? `Region: ${trimStart.toFixed(2)}s - ${trimEnd.toFixed(2)}s (${(trimEnd - trimStart).toFixed(2)}s)` 
                    : `Full length (${(videoDuration || 5).toFixed(2)}s)`
                  }
                </span>
              </div>
              
              <div className="bg-white/80 p-3 rounded-xl border border-orange-200/25 space-y-3 shadow-3xs">
                {/* Trim Start handle */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-orange-900 w-16">Start Cut:</span>
                  <input 
                    type="range"
                    min={0}
                    max={Math.max(0, trimEnd - 0.2)}
                    step={0.05}
                    value={trimStart}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimStart(val);
                      if (videoRef.current) {
                        videoRef.current.currentTime = val;
                        setCurrentTime(val);
                      }
                    }}
                    className="flex-1 h-1.5 rounded-lg appearance-none cursor-ew-resize bg-orange-100 accent-orange-500 focus:outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-115"
                  />
                  <span className="text-[10px] font-mono font-bold text-orange-950 bg-orange-100/40 px-2 py-0.5 rounded w-12 text-center">
                    {trimStart.toFixed(2)}s
                  </span>
                </div>

                {/* Trim End handle */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-orange-900 w-16">End Cut:</span>
                  <input 
                    type="range"
                    min={Math.min(videoDuration || 5, trimStart + 0.2)}
                    max={videoDuration || 5}
                    step={0.05}
                    value={trimEnd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimEnd(val);
                      if (videoRef.current && videoRef.current.currentTime > val) {
                        videoRef.current.currentTime = trimStart;
                        setCurrentTime(trimStart);
                      }
                    }}
                    className="flex-1 h-1.5 rounded-lg appearance-none cursor-ew-resize bg-orange-100 accent-pink-500 focus:outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-115"
                  />
                  <span className="text-[10px] font-mono font-bold text-orange-950 bg-orange-100/40 px-2 py-0.5 rounded w-12 text-center">
                    {trimEnd.toFixed(2)}s
                  </span>
                </div>
              </div>
            </div>

            {/* Controller Buttons Grid */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-orange-200/20">
              <div className="flex items-center gap-1.5">
                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                  className="p-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all font-bold shadow-sm cursor-pointer flex items-center justify-center min-w-[36px]"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                {/* Mute/Unmute */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggleMute(); }}
                  className="p-2 rounded-xl bg-white border border-orange-200 text-orange-900 hover:bg-orange-50 active:scale-95 transition-all font-bold cursor-pointer flex items-center justify-center min-w-[36px]"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-pink-500" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-orange-700" />
                  )}
                </button>
              </div>

              {/* Frame-by-frame Manual Inspection */}
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-orange-200/30 shadow-xs">
                <span className="text-[11px] font-extrabold text-orange-950 select-none">Inspect Frame:</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleStep(-0.05); }}
                  className="p-1 rounded-lg bg-orange-50 text-orange-900 border border-orange-200/50 hover:bg-orange-100 active:scale-90 transition-all cursor-pointer"
                  title="Previous Frame (-0.05s)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleStep(0.05); }}
                  className="p-1 rounded-lg bg-orange-50 text-orange-900 border border-orange-200/50 hover:bg-orange-100 active:scale-90 transition-all cursor-pointer"
                  title="Next Frame (+0.05s)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Playback rate (Speed) */}
              <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-orange-200/30 shadow-xs">
                <span className="text-[11px] font-extrabold text-orange-950 mr-1 select-none">Speed:</span>
                {[0.25, 0.5, 1, 2].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSpeedChange(speed); }}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                      playbackRate === speed
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-orange-50/50 hover:bg-orange-50 text-orange-900'
                    }`}
                  >
                    {speed === 1 ? '1x' : `${speed}x`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Filter Selector on Output Screen */}
          <div className="space-y-3 bg-orange-50/50 p-4 rounded-2xl border border-orange-200/40">
             <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950 uppercase tracking-wider">
                <Palette className="w-4 h-4 text-orange-500 animate-pulse" />
                <span>Adjust Style Overlays Live:</span>
             </div>
             <div className="flex flex-wrap gap-2">
                {STYLE_FILTERS.map((filter) => (
                   <button
                      key={filter.id}
                      type="button"
                      onClick={() => setStyleFilter(filter.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer ${
                        styleFilter === filter.id
                          ? 'bg-gradient-to-r from-orange-500 to-pink-500 border-orange-500 text-white shadow-sm scale-[1.03]'
                          : 'bg-white border-orange-200 text-orange-900 hover:border-orange-400'
                      }`}
                   >
                      {filter.name}
                   </button>
                ))}
             </div>
             <p className="text-[10px] text-orange-700 font-medium">
               Select filters to change the aesthetic mood in real-time. This aesthetic filter is persistent when stored in your library!
             </p>
          </div>

          {/* Export Settings & Preset Dropdown */}
          <div className="space-y-3 bg-white/90 p-4 rounded-2xl border-2 border-orange-200/80 shadow-xs">
             <div className="flex items-center justify-between flex-wrap gap-2">
                <label 
                  htmlFor="export-preset-select" 
                  className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-orange-950 uppercase tracking-wider"
                >
                   <Sliders className="w-4 h-4 text-orange-500" />
                   <span>Export Preset</span>
                </label>
                <div className="flex items-center gap-1.5">
                   <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                     {EXPORT_PRESETS[exportPreset].badge}
                   </span>
                   <span className="text-[11px] font-medium text-orange-700">
                     ({EXPORT_PRESETS[exportPreset].videoWidth}x{EXPORT_PRESETS[exportPreset].videoHeight})
                   </span>
                </div>
             </div>

             <div className="relative">
                <select
                  id="export-preset-select"
                  value={exportPreset}
                  onChange={(e) => setExportPreset(e.target.value as ExportPreset)}
                  className="w-full bg-orange-50/70 border-2 border-orange-300 text-orange-950 text-sm sm:text-base font-bold rounded-xl px-3.5 py-3 pr-10 focus:outline-hidden focus:border-orange-500 focus:ring-2 focus:ring-orange-300/40 transition-all appearance-none cursor-pointer"
                >
                  <option value="social">'Social Media' (vertical)</option>
                  <option value="cinematic">'Cinematic' (16:9)</option>
                  <option value="square">'Square'</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-orange-600">
                  <ChevronDown className="w-5 h-5" />
                </div>
             </div>

             <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-orange-100">
                <p className="text-[11px] text-orange-800 font-medium">
                  {EXPORT_PRESETS[exportPreset].description}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {EXPORT_PRESETS[exportPreset].platformTags.map((tag) => (
                    <span 
                      key={tag} 
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             {/* Save to Browser Button */}
             <button 
                onClick={handleSaveToBrowser}
                disabled={isSavingToDb || hasSavedCurrent || !currentVideoBlob}
                className={`sm:col-span-3 font-bold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-md flex items-center justify-center gap-2 ${
                  hasSavedCurrent 
                    ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-200 cursor-default shadow-none' 
                    : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600 hover:shadow-lg transform hover:-translate-y-0.5'
                }`}
             >
                {isSavingToDb ? (
                   <RefreshCw className="w-5 h-5 animate-spin" />
                ) : hasSavedCurrent ? (
                   <Check className="w-5 h-5 text-emerald-600" />
                ) : (
                   <Save className="w-5 h-5" />
                )}
                {isSavingToDb 
                   ? 'Saving to Browser...' 
                   : hasSavedCurrent 
                     ? 'Successfully Saved to Gallery!' 
                     : 'Save to Browser Library'}
             </button>

             {/* Share Button */}
             <button 
                onClick={handleShare} 
                disabled={isSharing || isExportingTrimmed} 
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
                {isSharing ? (
                    <span className="animate-pulse">{trimProgress || "Sharing..."}</span>
                ) : (
                    <>
                        <Share2 className="w-5 h-5" />
                        Share
                    </>
                )}
             </button>

             {/* Download Button */}
             <div className="flex flex-col gap-1.5 justify-center">
               <button 
                  id="download-preset-btn"
                  onClick={() => handleDownloadPresetVideo(false)}
                  disabled={isExportingTrimmed}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
               >
                  {isExportingTrimmed ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="truncate">{trimProgress || "Processing..."}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span className="truncate">
                        {isTrimmed 
                          ? `Download Trimmed (${EXPORT_PRESETS[exportPreset].label})` 
                          : `Download (${EXPORT_PRESETS[exportPreset].label})`}
                      </span>
                    </>
                  )}
               </button>
               <div className="flex items-center justify-center gap-2 flex-wrap">
                 {isTrimmed && !isExportingTrimmed && (
                   <button 
                     id="download-full-preset-btn"
                     type="button"
                     onClick={() => handleDownloadPresetVideo(true)}
                     className="text-[10px] text-green-700 hover:text-green-950 font-bold underline text-center cursor-pointer"
                   >
                     Full Length ({EXPORT_PRESETS[exportPreset].label})
                   </button>
                 )}
                 {!isExportingTrimmed && (
                   <button 
                     id="download-raw-original-btn"
                     type="button"
                     onClick={handleDownloadOriginal}
                     className="text-[10px] text-orange-700 hover:text-orange-950 font-bold underline text-center cursor-pointer"
                     title="Download original raw animation without preset crop"
                   >
                     Raw Original ({aspectRatio})
                   </button>
                 )}
               </div>
             </div>

             {/* Export as GIF Button */}
             <button 
                id="export-gif-btn"
                onClick={handleExportGif}
                disabled={isExportingGif || (!currentVideoBlob && !videoUrl)}
                className="bg-purple-500 hover:bg-purple-650 hover:shadow-lg text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
                {isExportingGif ? (
                   <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span className="truncate">{gifProgress || "Converting..."}</span>
                   </>
                ) : (
                   <>
                      <Film className="w-5 h-5" />
                      <span className="truncate">Export GIF ({EXPORT_PRESETS[exportPreset].label})</span>
                   </>
                )}
             </button>

             {/* Reset Button */}
             <button onClick={handleReset} className="sm:col-span-3 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Animate Another!
             </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Image Upload */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
            <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-orange-500 animate-pulse" />
              <span>1. Select Starting Image</span>
            </h3>
            
            {/* Auto Crop Toggle */}
            <label className="inline-flex items-center gap-2 cursor-pointer bg-white/70 hover:bg-white border border-orange-200 px-3 py-1.5 rounded-full transition-all text-xs font-bold text-orange-950 shadow-sm hover:shadow active:scale-95">
              <input 
                type="checkbox"
                name="autoCropToggle"
                checked={autoCrop}
                onChange={(e) => setAutoCrop(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-8 h-4 bg-orange-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500"></div>
              <span>Auto-crop on upload</span>
            </label>
          </div>

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group relative flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-dashed rounded-2xl transition-all duration-300 overflow-hidden ${
              isDragging 
                ? 'border-orange-500 bg-orange-100/70 shadow-inner scale-[1.01]' 
                : 'border-orange-300 bg-orange-50/50 hover:border-orange-500 hover:bg-orange-100/50 hover:shadow-inner'
            }`}
          >
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {imagePreview ? (
            <div className="relative w-full h-full p-2 flex items-center justify-center bg-orange-50/10">
              <img src={imagePreview} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-inner" />
              
              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-white hover:bg-orange-50 text-orange-950 font-bold py-2 px-4 rounded-xl text-xs sm:text-sm shadow-lg transition-all transform hover:scale-105 cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 text-orange-500" />
                  Change
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    const src = rawImageSrc || imagePreview;
                    setRawImageSrc(src);
                    setIsCropperOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-xl text-xs sm:text-sm shadow-lg transition-all transform hover:scale-105 cursor-pointer active:scale-95"
                >
                  <Crop className="w-4 h-4" />
                  Crop & Position
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-center text-orange-850 p-4"
            >
              <ImageIcon className="mx-auto h-12 w-12 mb-2 text-orange-400 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-orange-950">Click to upload</p>
              <p className="text-sm opacity-75">or drag and drop image</p>
            </div>
          )}
          </div>

          {/* Portrait Image Guidance Banner */}
          {imagePreview && isUploadedImagePortrait && aspectRatio === '16:9' && (
            <div className="mt-3 bg-amber-50/95 border-2 border-amber-300/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-amber-950">
                    Portrait Image Detected (Prevents Top Cutoff)
                  </p>
                  <p className="text-[11px] sm:text-xs text-amber-850 leading-relaxed mt-0.5">
                    Your photo is tall/vertical. Landscape (16:9) will center-crop and cut off the top. Switch to <strong>Portrait (9:16)</strong> or adjust the crop position so the top stays in frame!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  Switch to 9:16
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const src = rawImageSrc || imagePreview;
                    setRawImageSrc(src);
                    setIsCropperOpen(true);
                  }}
                  className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold py-1.5 px-3 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  Crop & Position
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Prompt Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="prompt" className="text-lg font-bold text-orange-900">2. Describe the motion</label>
            <button
              type="button"
              onClick={handlePromptAssist}
              disabled={isPromptAssisting}
              title={selectedTextLLM === 'none' ? 'Select a Text LLM in Settings to enable Prompt Assist' : `Enhance prompt with ${selectedTextLLM.toUpperCase()}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-bold rounded-lg border border-orange-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 text-orange-600 ${isPromptAssisting ? 'animate-spin' : ''}`} />
              <span>{isPromptAssisting ? 'Enhancing...' : 'AI Prompt Assist'}</span>
              {selectedTextLLM !== 'none' && (
                <span className="text-[10px] bg-white/80 px-1.5 py-0.5 rounded text-orange-850 font-mono">
                  {selectedTextLLM}
                </span>
              )}
            </button>
          </div>
          <textarea
            id="prompt"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g., cinematic lighting, the fruit explodes into water droplets, 4k realistic"
            className="w-full h-28 p-4 bg-white/80 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all duration-200 placeholder:text-orange-300 text-orange-900"
          />
          
          {/* Recent Prompts Quick Reuse List */}
          {recentPrompts.length > 0 && (
            <div className="mt-3 bg-orange-50/40 p-3 rounded-xl border border-orange-200/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-orange-900/85 flex items-center gap-1.5 uppercase tracking-wide">
                  <Clock className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                  Recent Prompts (Click to Reuse)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRecentPrompts([]);
                    try {
                      localStorage.removeItem('peachy_recent_prompts');
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="text-[10px] text-orange-700 hover:text-red-600 hover:underline transition-colors focus:outline-none"
                >
                  Clear History
                </button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                {recentPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="w-full text-left truncate bg-white/90 hover:bg-orange-100/70 border border-orange-100 hover:border-orange-300 rounded-lg p-2 text-xs text-orange-950 font-medium transition-all duration-150 flex items-center gap-2 group cursor-pointer"
                    title={p}
                  >
                    <span className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-orange-100 text-orange-750 text-[10px] font-bold group-hover:bg-orange-200">
                      {idx + 1}
                    </span>
                    <span className="truncate flex-1">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Options Accordion Group (3, 4, 5, 6) */}
        <div className="space-y-3 pt-1">
          {/* 3. Aspect Ratio Accordion */}
          <div className="border border-orange-200/80 bg-white/80 rounded-2xl overflow-hidden shadow-2xs transition-all duration-200 hover:border-orange-300">
            <button
              type="button"
              onClick={() => toggleAccordion('3')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors bg-white/60 hover:bg-orange-50/70 select-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Crop className="w-5 h-5 text-orange-500" />
                <span className="text-base sm:text-lg font-bold text-orange-900">3. Aspect Ratio</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-850 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  {aspectRatio === '16:9' ? '16:9 (Landscape)' : '9:16 (Portrait)'}
                </span>
                <ChevronDown className={`w-5 h-5 text-orange-400 transition-transform duration-200 ${openAccordions['3'] ? 'rotate-180 text-orange-600' : ''}`} />
              </div>
            </button>
            {openAccordions['3'] && (
              <div className="px-4 pb-4 pt-2 border-t border-orange-100/60 bg-white/40 space-y-2">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <label className={`flex items-center justify-center p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all shadow-sm ${aspectRatio === '16:9' ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-[1.02]' : 'bg-white/60 border-orange-200 text-orange-800 hover:border-orange-400 hover:bg-white'}`}>
                    <input type="radio" name="aspectRatio" value="16:9" checked={aspectRatio === '16:9'} onChange={() => setAspectRatio('16:9')} className="sr-only" />
                    <span className="font-medium text-sm sm:text-base">Landscape (16:9)</span>
                  </label>
                  <label className={`flex items-center justify-center p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all shadow-sm ${aspectRatio === '9:16' ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-[1.02]' : 'bg-white/60 border-orange-200 text-orange-800 hover:border-orange-400 hover:bg-white'}`}>
                    <input type="radio" name="aspectRatio" value="9:16" checked={aspectRatio === '9:16'} onChange={() => setAspectRatio('9:16')} className="sr-only" />
                    <span className="font-medium text-sm sm:text-base">Portrait (9:16)</span>
                  </label>
                </div>
                
                {/* Dynamic adjust helper action */}
                {imagePreview && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const src = rawImageSrc || imagePreview;
                        setRawImageSrc(src);
                        setIsCropperOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-950 transition-colors bg-orange-100/60 hover:bg-orange-200/80 py-1.5 px-3.5 rounded-full cursor-pointer border border-orange-200/40"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      Adjust crop to match {aspectRatio}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Output Duration Accordion */}
          <div className="border border-orange-200/80 bg-white/80 rounded-2xl overflow-hidden shadow-2xs transition-all duration-200 hover:border-orange-300">
            <button
              type="button"
              onClick={() => toggleAccordion('4')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors bg-white/60 hover:bg-orange-50/70 select-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-orange-500" />
                <span className="text-base sm:text-lg font-bold text-orange-900">4. Output Duration</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-850 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  {durationSeconds}s ({durationSeconds === 5 ? 'Default' : durationSeconds === 4 ? 'Quick' : durationSeconds === 6 ? 'Medium' : 'Long'})
                </span>
                <ChevronDown className={`w-5 h-5 text-orange-400 transition-transform duration-200 ${openAccordions['4'] ? 'rotate-180 text-orange-600' : ''}`} />
              </div>
            </button>
            {openAccordions['4'] && (
              <div className="px-4 pb-4 pt-2 border-t border-orange-100/60 bg-white/40">
                <div className="grid grid-cols-4 gap-2">
                  {[4, 5, 6, 8].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDurationSeconds(sec)}
                      className={`flex flex-col items-center justify-center p-2.5 sm:p-3.5 border-2 rounded-xl cursor-pointer transition-all shadow-sm ${
                        durationSeconds === sec 
                          ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-[1.02] font-bold' 
                          : 'bg-white/60 border-orange-200 text-orange-850 hover:border-orange-400 hover:bg-white font-medium'
                      }`}
                    >
                      <span className="text-base sm:text-lg font-bold">{sec}s</span>
                      <span className="text-[9px] opacity-80 uppercase tracking-wider font-semibold">
                        {sec === 5 ? 'Default' : sec === 4 ? 'Quick' : sec === 6 ? 'Medium' : 'Long'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. Animation Motion Strength Accordion */}
          <div className="border border-orange-200/80 bg-white/80 rounded-2xl overflow-hidden shadow-2xs transition-all duration-200 hover:border-orange-300">
            <button
              type="button"
              onClick={() => toggleAccordion('5')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors bg-white/60 hover:bg-orange-50/70 select-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Gauge className="w-5 h-5 text-orange-500" />
                <span className="text-base sm:text-lg font-bold text-orange-900">5. Animation Motion Strength</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-850 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  Level {motionStrength} / 10
                </span>
                <ChevronDown className={`w-5 h-5 text-orange-400 transition-transform duration-200 ${openAccordions['5'] ? 'rotate-180 text-orange-600' : ''}`} />
              </div>
            </button>
            {openAccordions['5'] && (
              <div className="px-4 pb-4 pt-2 border-t border-orange-100/60 bg-white/40 space-y-3">
                <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4 sm:p-5 space-y-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-orange-700 w-11 shrink-0">Subtle</span>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={motionStrength} 
                      onChange={(e) => setMotionStrength(parseInt(e.target.value, 10))}
                      className="flex-1 h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <span className="text-xs font-semibold text-orange-700 w-12 shrink-0 text-right">Dynamic</span>
                  </div>
                  
                  <div className="text-center pt-1 border-t border-orange-100/50">
                    <p className="text-xs font-bold text-orange-950 uppercase tracking-wide">
                      {motionStrength <= 2 ? "🌸 Gentle Whispers (Subtle)" : 
                       motionStrength <= 4 ? "🍃 Soft Kinetic Flow (Calm)" : 
                       motionStrength <= 6 ? "🚗 Balanced Narrative (Medium)" : 
                       motionStrength <= 8 ? "⚡ High Energy Sweep (Dynamic)" : 
                       "☄️ Cinematic Turbulence (Extreme)"}
                    </p>
                    <p className="text-[11px] text-orange-700/85 mt-1 leading-relaxed">
                      {motionStrength <= 2 ? "Ideal for subtle background sways, gentle portrait breezes, or micro-motions." :
                       motionStrength <= 4 ? "Perfect for standard pan flows, slow-mo drift transitions, or calming liquid ripples." :
                       motionStrength <= 6 ? "Standard natural rate of action, standard camera motion and cinematography." :
                       motionStrength <= 8 ? "Sweeping cinematic pans, dramatic tracking movements, and expressive action energy." :
                       "Maximum motion velocity! High-intensity action, dramatic changes, and epic kinetic sequences."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. Aesthetic Style Filter Overlay Accordion */}
          <div className="border border-orange-200/80 bg-white/80 rounded-2xl overflow-hidden shadow-2xs transition-all duration-200 hover:border-orange-300">
            <button
              type="button"
              onClick={() => toggleAccordion('6')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors bg-white/60 hover:bg-orange-50/70 select-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Palette className="w-5 h-5 text-orange-500" />
                <span className="text-base sm:text-lg font-bold text-orange-900">6. Aesthetic Style Filter Overlay</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-850 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  {STYLE_FILTERS.find(f => f.id === styleFilter)?.name || 'Default (Clean)'}
                </span>
                <ChevronDown className={`w-5 h-5 text-orange-400 transition-transform duration-200 ${openAccordions['6'] ? 'rotate-180 text-orange-600' : ''}`} />
              </div>
            </button>
            {openAccordions['6'] && (
              <div className="px-4 pb-4 pt-2 border-t border-orange-100/60 bg-white/40 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {STYLE_FILTERS.map((s) => {
                    const isActive = styleFilter === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStyleFilter(s.id)}
                        className={`group relative flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                          isActive
                            ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-[1.03] font-bold'
                            : 'bg-white/70 border-orange-200 text-orange-900 hover:border-orange-400 hover:bg-white'
                        }`}
                      >
                        {/* Preview circles demonstrating tint colors */}
                        <div className="flex -space-x-1 mb-1.5 pointer-events-none">
                          <span className={`w-3 h-3 rounded-full border border-white/50 bg-gradient-to-tr ${s.previewColors}`} />
                          <span className={`w-3 h-3 rounded-full border border-white/50 bg-gradient-to-bl ${s.previewColors}`} />
                        </div>
                        
                        <span className="text-[11px] tracking-tight">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Active Filter Explanation Card */}
                {(() => {
                  const selected = STYLE_FILTERS.find(f => f.id === styleFilter) || STYLE_FILTERS[0];
                  return (
                    <div className="bg-orange-50/25 border border-orange-100/70 p-3.5 rounded-2xl shadow-inner">
                      <p className="text-[11px] font-bold text-orange-950 uppercase tracking-wider flex items-center gap-1">
                        <span>✨ Dynamic Mood: {selected.name}</span>
                      </p>
                      <p className="text-[11px] text-orange-700/85 mt-1 leading-relaxed">
                        {selected.description}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* 7. AI Engine & Provider Settings */}
          <div className="border border-orange-200/80 bg-white/80 rounded-2xl overflow-hidden shadow-2xs transition-all duration-200 hover:border-orange-300">
            <button
              type="button"
              onClick={() => toggleAccordion('7')}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors bg-white/60 hover:bg-orange-50/70 select-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-orange-500" />
                <span className="text-base sm:text-lg font-bold text-orange-900">7. AI Engine & Provider Settings</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-850 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  {getVideoEngine(selectedVideoEngine).name} • {selectedTextLLM === 'none' ? 'No Text LLM' : selectedTextLLM.toUpperCase()}
                </span>
                <ChevronDown className={`w-5 h-5 text-orange-400 transition-transform duration-200 ${openAccordions['7'] ? 'rotate-180 text-orange-600' : ''}`} />
              </div>
            </button>
            {openAccordions['7'] && (
              <div className="px-4 pb-4 pt-2 border-t border-orange-100/60 bg-white/40">
                <ProviderSettings
                  selectedVideoEngine={selectedVideoEngine}
                  onSelectVideoEngine={handleSelectVideoEngine}
                  selectedTextLLM={selectedTextLLM}
                  onSelectTextLLM={handleSelectTextLLM}
                  videoEngineError={videoEngineError}
                />
              </div>
            )}
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center space-y-2.5">
            <p className="text-red-700 text-sm font-medium">{error}</p>
            {(error.includes("quota") || error.includes("429") || error.includes("API key") || error.includes("RESOURCE_EXHAUSTED")) && (
              <div>
                <button
                  type="button"
                  onClick={handleSelectKeyClick}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Select / Switch API Key
                </button>
              </div>
            )}
          </div>
        )}

        {(() => {
          const currentEngine = getVideoEngine(selectedVideoEngine);
          const hasKey = currentEngine.hasKey();
          const isStub = !currentEngine.isImplemented;
          const isAnimateDisabled = !imageFile || !prompt.trim() || isLoading || !hasKey || isStub || Boolean(videoEngineError);

          return (
            <div className="space-y-2">
              {videoEngineError && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-center text-xs font-bold text-red-700 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{videoEngineError}</span>
                </div>
              )}

              <button 
                onClick={handleGenerateVideo}
                disabled={isAnimateDisabled}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none transform hover:-translate-y-1 disabled:transform-none text-lg cursor-pointer disabled:cursor-not-allowed"
              >
                ✨ Animate It!
              </button>

              {!hasKey && (
                <p className="text-xs font-semibold text-red-600 text-center flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Animate disabled: {currentEngine.requiredEnvVar} is missing from environment for {currentEngine.name}.
                </p>
              )}

              {hasKey && isStub && (
                <p className="text-xs font-semibold text-amber-700 text-center flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Animate disabled: {currentEngine.name} is a stubbed engine. Please select Google Veo in Section 7.
                </p>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  if (isAuthLoading) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center p-4">
        <div className="fixed inset-0 -z-10 bg-orange-50/80"></div>
        <div className="flex flex-col items-center gap-3 bg-white/85 backdrop-blur-md p-8 rounded-3xl border border-white/60 shadow-xl text-center">
          <PeachIcon className="w-16 h-16 animate-bounce" />
          <p className="text-orange-950 font-bold text-base">Loading Peachy Web...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn && !user) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="relative min-h-screen w-full font-sans text-gray-800 overflow-x-hidden selection:bg-orange-200">
      <style>{`
        @keyframes grain {
          0%, 100% { transform:translate(0, 0) }
          10% { transform:translate(-1%, -1%) }
          20% { transform:translate(-2%, 1%) }
          30% { transform:translate(1%, -2%) }
          40% { transform:translate(-1%, 3%) }
          50% { transform:translate(-2%, 1%) }
          60% { transform:translate(3%, -1%) }
          70% { transform:translate(2%, 1%) }
          80% { transform:translate(1%, -1%) }
          90% { transform:translate(-1%, 2%) }
        }
        .animate-grain {
          animation: grain 0.8s steps(6) infinite;
          width: 200%;
          height: 200%;
          left: -50%;
          top: -50%;
        }
      `}</style>
      {/* Dynamic Rotating Background Layer */}
      <BackgroundRotator />

      <div className="flex flex-col items-center min-h-screen p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <header className="text-center mb-6 mt-4 sm:mt-8 relative z-10">
              <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2">
                 <PeachIcon className="w-12 h-12 sm:w-16 sm:h-16 drop-shadow-lg" />
                 <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-lg tracking-wide" style={{fontFamily: 'cursive, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.2)'}}>
                    Peachy Web
                 </h1>
              </div>
              <p className="text-orange-900 font-bold text-lg sm:text-xl bg-white/70 backdrop-blur-md py-1 px-6 rounded-full inline-block shadow-lg border border-white/50">
                  Bring your images to life with AI!
              </p>

              {/* Authentication Sync Center */}
              <div className="mt-4.5 flex flex-col items-center justify-center relative z-20">
                {isAuthLoading ? (
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md py-1.5 px-4 rounded-full text-xs font-bold text-orange-950 shadow border border-white/40 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                    Verifying secure identity session...
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md py-1 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-extrabold text-orange-950 shadow-md border border-white">
                    {user.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt={user.displayName || "User"} 
                        className="w-5.5 h-5.5 rounded-full border border-orange-300" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-5.5 h-5.5 rounded-full bg-orange-100 border border-orange-350 flex items-center justify-center text-[10px] text-orange-850 font-bold uppercase select-none">
                        {user.displayName ? user.displayName.slice(0, 2) : "Creator"}
                      </div>
                    )}
                    <span className="max-w-[120px] sm:max-w-none truncate text-orange-950">Hi, {user.displayName || user.email || "Artist"}!</span>
                    <span className="text-[9px] bg-emerald-50 text-emerald-850 py-0.5 px-2 rounded-full border border-emerald-200 uppercase tracking-wider font-extrabold flex items-center gap-1 leading-none select-none">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      Cloud Synced
                    </span>
                    <button 
                      onClick={handleLogout}
                      className="ml-1 text-[10px] bg-orange-50 hover:bg-orange-100 text-orange-700 hover:text-orange-950 border border-orange-200 hover:border-orange-300 active:scale-95 transition-all py-0.5 px-2.5 rounded-md font-bold cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md py-1 px-3 sm:px-4 rounded-full text-xs font-bold text-orange-950 shadow-md border border-white">
                    <span>👋 Guest Creator</span>
                    <button 
                      onClick={handleLogin}
                      className="flex items-center gap-1 bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white font-extrabold py-1 px-3 rounded-full text-[11px] transition-all shadow-xs cursor-pointer"
                      title="Connect Google Account to back up animations to cloud"
                    >
                      <span>☁️</span>
                      <span>Connect Google</span>
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="text-[11px] bg-orange-50 hover:bg-orange-100 text-orange-700 hover:text-orange-950 border border-orange-200 hover:border-orange-300 transition-all py-0.5 px-2 rounded-md font-bold cursor-pointer"
                    >
                      Exit
                    </button>
                  </div>
                )}
              </div>
          </header>

          {/* Glassmorphism Card Container */}
          <main className="w-full max-w-2xl bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-6 sm:p-10 transition-all duration-300 relative z-10 mb-8">
             {renderContent()}
          </main>

          {/* Saved Gallery Card */}
          {apiKeySelected && (
            <section className="w-full max-w-2xl bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-6 sm:p-10 transition-all duration-300 relative z-10 mb-12">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-orange-100/60">
                  <div className="flex items-center gap-2">
                     <Library className="w-6 h-6 text-orange-500" />
                     <div>
                        <div className="flex items-center gap-2">
                           <h2 className="text-2xl font-bold text-orange-950">My Gallery</h2>
                           {savedVideos.length > 0 && (
                              <span className="bg-orange-100 text-orange-850 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                 {savedVideos.length} Anim{savedVideos.length !== 1 ? 's' : ''}
                              </span>
                           )}
                        </div>
                        <p className="text-xs text-orange-700/80">Saved animations from your local device & cloud</p>
                     </div>
                  </div>

                  {savedVideos.length > 0 && (
                     <div className="flex items-center gap-1.5 self-start sm:self-auto bg-orange-100/70 p-1 rounded-xl text-xs font-bold">
                        <span className="text-[11px] text-orange-800/80 px-1 hidden xs:inline">Display:</span>
                        <button
                           type="button"
                           onClick={() => handleToggleGalleryFitMode('fit')}
                           className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                              galleryFitMode === 'fit'
                                 ? 'bg-white text-orange-950 shadow-xs font-extrabold'
                                 : 'text-orange-800 hover:text-orange-950'
                           }`}
                           title="Display entire image/video without any cropping at the top or edges"
                        >
                           <span>✨ Fit Entire</span>
                        </button>
                        <button
                           type="button"
                           onClick={() => handleToggleGalleryFitMode('cover')}
                           className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                              galleryFitMode === 'cover'
                                 ? 'bg-white text-orange-950 shadow-xs font-extrabold'
                                 : 'text-orange-800 hover:text-orange-950'
                           }`}
                           title="Fill thumbnail card (aligns to top)"
                        >
                           <span>Fill Card</span>
                        </button>
                     </div>
                  )}
               </div>

               {savedVideos.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-orange-200 rounded-2xl bg-orange-50/30">
                     <FileVideo className="w-12 h-12 text-orange-300 mx-auto mb-3 animate-pulse" />
                     <p className="text-orange-900 font-bold">No saved animations yet</p>
                     <p className="text-sm text-orange-700/80 mt-1 max-w-xs mx-auto">
                        Animate your image and select "Save to Browser" to build your local collection.
                     </p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[550px] overflow-y-auto pr-1">
                     {savedVideos.map((video) => {
                        const urls = mediaUrls[video.id] || { image: '', video: '' };
                        const dateStr = new Date(video.createdAt).toLocaleDateString(undefined, {
                           month: 'short',
                           day: 'numeric',
                           year: 'numeric'
                        });
                        const timeStr = new Date(video.createdAt).toLocaleTimeString(undefined, {
                           hour: '2-digit',
                           minute: '2-digit'
                        });
                        const isCurrent = currentVideoBlob && video.videoBlob && (
                           video.videoBlob.size === currentVideoBlob.size
                        );

                        return (
                           <div 
                              key={video.id}
                              className={`group relative flex flex-col justify-between p-4 bg-orange-50/20 rounded-2xl border transition-all duration-300 hover:bg-orange-50/60 hover:shadow-md ${
                                 isCurrent ? 'border-orange-500 ring-2 ring-orange-200' : 'border-orange-100/65'
                              }`}
                           >
                              {/* Thumbnail & Info */}
                              <div className="space-y-3">
                                 {/* Image Thumbnail Container */}
                                 <div 
                                    onClick={() => setGalleryPreviewVideo(video)}
                                    className={`relative w-full rounded-xl overflow-hidden bg-zinc-950 border border-orange-100 cursor-pointer group-hover:shadow transition-all ${
                                       video.aspectRatio === '9:16'
                                          ? 'aspect-[4/5] sm:aspect-[9/16] max-h-[290px]'
                                          : 'aspect-video'
                                    }`}
                                 >
                                    {urls.image ? (
                                       <img 
                                          src={urls.image} 
                                          alt={video.prompt} 
                                          className={`w-full h-full transition-all duration-300 ${
                                             galleryFitMode === 'fit'
                                                ? 'object-contain bg-zinc-950 p-0.5'
                                                : 'object-cover object-top group-hover:scale-105'
                                          }`} 
                                       />
                                    ) : (
                                       <div className="w-full h-full bg-gradient-to-br from-pink-50 to-orange-50 flex items-center justify-center">
                                          <FileVideo className="w-8 h-8 text-orange-300" />
                                       </div>
                                    )}
                                    {/* Play / Full View Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                                       <div className="py-1.5 px-3 bg-white/95 rounded-full text-orange-600 shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-200 flex items-center gap-1.5 text-xs font-extrabold">
                                          <Eye className="w-3.5 h-3.5 text-orange-500" />
                                          <span>Full View</span>
                                       </div>
                                    </div>
                                    {/* Aspect Ratio & Duration Badges */}
                                    <div className="absolute bottom-2 right-2 flex gap-1">
                                       {video.isCloud ? (
                                          <span className="bg-sky-600/85 backdrop-blur-sm text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-extrabold" title="Synced from Google Cloud">
                                             ☁️ Cloud
                                          </span>
                                       ) : (
                                          <span className="bg-amber-600/85 backdrop-blur-sm text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-extrabold" title="Offline Browser Storage">
                                             💾 Local
                                          </span>
                                       )}
                                       <span className="bg-black/60 backdrop-blur-sm text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-medium">
                                          {video.aspectRatio}
                                       </span>
                                       {video.durationSeconds && (
                                          <span className="bg-orange-600/85 backdrop-blur-sm text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-bold">
                                             {video.durationSeconds}s
                                          </span>
                                       )}
                                       {video.motionStrength && (
                                          <span className="bg-pink-600/85 backdrop-blur-sm text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-bold" title={`Motion Level: ${video.motionStrength}`}>
                                             🎛️ Lvl {video.motionStrength}
                                          </span>
                                       )}
                                       {video.styleFilter && video.styleFilter !== 'none' && (
                                          <span className="bg-blue-600/85 backdrop-blur-sm text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-bold" title={`Style Filter: ${video.styleFilter}`}>
                                             🎬 {video.styleFilter === 'bw' ? 'B&W' : video.styleFilter}
                                          </span>
                                       )}
                                    </div>
                                 </div>

                                 <div className="space-y-1">
                                    {/* Metadata */}
                                    <div className="flex items-center gap-1 text-[10px] text-orange-700/80 font-semibold uppercase tracking-wider">
                                       <Clock className="w-3.5 h-3.5 text-orange-500" />
                                       <span>{dateStr} • {timeStr}</span>
                                    </div>
                                    {/* Prompt */}
                                    <p className="text-xs font-semibold text-orange-950 line-clamp-2 leading-relaxed" title={video.prompt}>
                                       {video.prompt}
                                    </p>
                                 </div>
                              </div>

                              {/* Buttons */}
                              <div className="flex items-center justify-end gap-1.5 mt-3 pt-2.5 border-t border-orange-100/60">
                                 <button
                                    onClick={() => handleLoadSavedVideo(video)}
                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold bg-orange-100 text-orange-950 hover:bg-orange-200 transition-colors cursor-pointer"
                                    title="Load into standard player"
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Load</span>
                                 </button>

                                 <button
                                    onClick={() => setGalleryPreviewVideo(video)}
                                    className="p-1.5 rounded-lg text-orange-850 hover:bg-orange-150 transition-colors cursor-pointer"
                                    title="Open Fullscreen Lightbox Player"
                                 >
                                    <Eye className="w-3.5 h-3.5" />
                                 </button>

                                 <button
                                    onClick={() => {
                                       const a = document.createElement('a');
                                       a.href = urls.video;
                                       a.download = `peachy-animation-${video.id}.mp4`;
                                       document.body.appendChild(a);
                                       a.click();
                                       document.body.removeChild(a);
                                    }}
                                    className="p-1.5 rounded-lg text-orange-850 hover:bg-orange-150 transition-colors cursor-pointer"
                                    title="Download MP4"
                                 >
                                    <Download className="w-3.5 h-3.5" />
                                 </button>

                                 <button
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       navigator.clipboard.writeText(video.prompt);
                                       setCopiedId(video.id);
                                       setTimeout(() => setCopiedId(null), 2000);
                                    }}
                                    className="p-1.5 rounded-lg text-orange-850 hover:bg-orange-150 transition-colors relative cursor-pointer"
                                    title="Copy original prompt"
                                 >
                                    {copiedId === video.id ? (
                                       <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                       <Copy className="w-3.5 h-3.5" />
                                    )}
                                 </button>

                                 <button
                                    onClick={(e) => handleDeleteVideo(video.id, e)}
                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                                    title="Delete animation"
                                 >
                                    <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </section>
          )}
      </div>

      {/* Gallery Video Fullscreen Lightbox Modal */}
      {galleryPreviewVideo && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => setGalleryPreviewVideo(null)}
        >
          <div 
            className="relative w-full max-w-3xl max-h-[92vh] bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col justify-between overflow-y-auto text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                  <Film className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base sm:text-lg text-zinc-100 truncate">
                    {galleryPreviewVideo.prompt}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>{new Date(galleryPreviewVideo.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-orange-300 font-bold">
                      {galleryPreviewVideo.aspectRatio}
                    </span>
                    {galleryPreviewVideo.durationSeconds && (
                      <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-300">
                        {galleryPreviewVideo.durationSeconds}s
                      </span>
                    )}
                    {galleryPreviewVideo.motionStrength && (
                      <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-pink-300">
                        Lvl {galleryPreviewVideo.motionStrength}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGalleryPreviewVideo(null)}
                className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer ml-3 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Stage Container (100% Uncropped Player) */}
            <div className="my-4 flex items-center justify-center bg-black/80 rounded-2xl border border-zinc-800/80 p-2 sm:p-4 min-h-[300px] max-h-[60vh] overflow-hidden">
              {mediaUrls[galleryPreviewVideo.id]?.video ? (
                <video
                  src={mediaUrls[galleryPreviewVideo.id].video}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="max-h-[55vh] max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl mx-auto block"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-zinc-500">
                  <FileVideo className="w-12 h-12 mb-2 text-zinc-600" />
                  <p className="text-sm">Video source unavailable</p>
                </div>
              )}
            </div>

            {/* Lightbox Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleLoadSavedVideo(galleryPreviewVideo);
                    setGalleryPreviewVideo(null);
                  }}
                  className="py-2 px-3.5 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Load into Editor</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = mediaUrls[galleryPreviewVideo.id]?.video;
                    if (!url) return;
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `peachy-animation-${galleryPreviewVideo.id}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  <span>Download MP4</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(galleryPreviewVideo.prompt);
                    setCopiedId(galleryPreviewVideo.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedId === galleryPreviewVideo.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span>{copiedId === galleryPreviewVideo.id ? 'Copied' : 'Copy Prompt'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setGalleryPreviewVideo(null)}
                className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ImageCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        imageSrc={rawImageSrc || ''}
        aspectRatio={aspectRatio}
        onCropComplete={handleCropComplete}
        onAspectRatioChange={(newRatio) => setAspectRatio(newRatio)}
      />
    </div>
  );
};

export default App;