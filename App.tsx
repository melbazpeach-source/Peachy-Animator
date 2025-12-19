import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { PeachIcon } from './components/PeachIcon';
import Login from './Login';

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

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [apiKeySelected, setApiKeySelected] = useState<boolean | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  if (!isLoggedIn) {
return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
}

  const loadingIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
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
        setError("Could not check for API key. Please refresh the page.");
        setApiKeySelected(false);
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
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
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

    loadingIntervalRef.current = window.setInterval(() => {
      setLoadingMessage(
        loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
      );
    }, 3000);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imageBase64 = await fileToBase64(imageFile);
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
          imageBytes: imageBase64,
          mimeType: imageFile.type,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio,
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!downloadLink) {
        throw new Error("Video generation completed, but no download link was found.");
      }
      
      const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      }

      const videoBlob = await videoResponse.blob();
      setVideoUrl(URL.createObjectURL(videoBlob));

    } catch (err: any) {
      let errorMessage = err.message || "An unknown error occurred.";
      if (errorMessage.includes("Requested entity was not found")) {
        errorMessage = "Your API key is invalid or not found. Please select a valid key and try again.";
        setApiKeySelected(false);
      } else if(errorMessage.includes("API key not valid")){
        errorMessage = "Your API key is not valid. Please select a valid key and try again.";
        setApiKeySelected(false);
      }
      console.error(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    }
  }, [imageFile, prompt, aspectRatio]);

  const handleReset = () => {
    setVideoUrl(null);
    setError(null);
    setImageFile(null);
    setImagePreview(null);
    setPrompt('');
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleShare = async () => {
    if (!videoUrl) return;
    setIsSharing(true);
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const file = new File([blob], "peachy-animation.mp4", { type: "video/mp4" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Peachy Animation',
          text: `Check out this video I made with Peachy! Prompt: "${prompt}"`,
        });
      } else {
        // Fallback if share sheet isn't available
        handleDownload();
      }
    } catch (error) {
      console.error("Error sharing:", error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `peachy-animation-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-center text-orange-900">Your Peachy Animation!</h2>
          
          <div className="rounded-xl overflow-hidden shadow-lg border-4 border-white bg-black">
            <video src={videoUrl} controls autoPlay loop className="w-full h-auto max-h-[60vh] mx-auto" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {/* Share Button */}
             <button 
                onClick={handleShare} 
                disabled={isSharing} 
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isSharing ? (
                    <span className="animate-pulse">Sharing...</span>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                        </svg>
                        Share
                    </>
                )}
             </button>

             {/* Download Button */}
             <button 
                onClick={handleDownload}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
             </button>

             {/* Reset Button */}
             <button onClick={handleReset} className="sm:col-span-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                Animate Another!
             </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Image Upload */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer group relative flex flex-col items-center justify-center w-full h-48 sm:h-64 bg-orange-50/50 border-2 border-dashed border-orange-300 rounded-2xl transition-all duration-300 hover:border-orange-500 hover:bg-orange-100/50 hover:shadow-inner"
        >
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="w-full h-full object-contain rounded-2xl p-2" />
          ) : (
            <div className="text-center text-orange-800 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 mb-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="font-bold">Click to upload</p>
              <p className="text-sm opacity-75">or drag and drop</p>
            </div>
          )}
        </div>
        
        {/* Prompt Input */}
        <div>
          <label htmlFor="prompt" className="block text-lg font-bold text-orange-900 mb-2">2. Describe the motion</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g., cinematic lighting, the fruit explodes into water droplets, 4k realistic"
            className="w-full h-28 p-4 bg-white/80 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all duration-200 placeholder:text-orange-300 text-orange-900"
          />
        </div>
        
        {/* Aspect Ratio */}
        <div>
           <h3 className="text-lg font-bold text-orange-900 mb-2">3. Aspect Ratio</h3>
           <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center justify-center p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all shadow-sm ${aspectRatio === '16:9' ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-[1.02]' : 'bg-white/60 border-orange-200 text-orange-800 hover:border-orange-400 hover:bg-white'}`}>
                <input type="radio" name="aspectRatio" value="16:9" checked={aspectRatio === '16:9'} onChange={() => setAspectRatio('16:9')} className="sr-only" />
                <span className="font-medium">Landscape (16:9)</span>
              </label>
              <label className={`flex items-center justify-center p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all shadow-sm ${aspectRatio === '9:16' ? 'bg-orange-500 border-orange-500 text-white shadow-md scale-[1.02]' : 'bg-white/60 border-orange-200 text-orange-800 hover:border-orange-400 hover:bg-white'}`}>
                <input type="radio" name="aspectRatio" value="9:16" checked={aspectRatio === '9:16'} onChange={() => setAspectRatio('9:16')} className="sr-only" />
                <span className="font-medium">Portrait (9:16)</span>
              </label>
           </div>
        </div>
        
        {error && <p className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-xl text-center text-sm font-medium">{error}</p>}

        <button 
          onClick={handleGenerateVideo}
          disabled={!imageFile || !prompt.trim() || isLoading}
          className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none transform hover:-translate-y-1 disabled:transform-none text-lg"
        >
          ✨ Animate It!
        </button>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen w-full font-sans text-gray-800 overflow-x-hidden selection:bg-orange-200">
      {/* Background Layer */}
      <div className="fixed inset-0 -z-10">
         <div className="absolute inset-0 bg-orange-50"></div>
         {/* Fruit Splash Background Image */}
         <img
            src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=2574&auto=format&fit=crop"
            alt="Fruit Background"
            className="w-full h-full object-cover opacity-90"
         />
         {/* Overlay to ensure text readability */}
         <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px]"></div>
      </div>

      <div className="flex flex-col items-center min-h-screen p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <header className="text-center mb-8 mt-4 sm:mt-8 relative z-10">
              <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2">
                 <PeachIcon className="w-12 h-12 sm:w-16 sm:h-16 drop-shadow-lg" />
                 <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-lg tracking-wide" style={{fontFamily: 'cursive, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.2)'}}>
                    Peachy Web
                 </h1>
              </div>
              <p className="text-orange-900 font-bold text-lg sm:text-xl bg-white/70 backdrop-blur-md py-1 px-6 rounded-full inline-block shadow-lg border border-white/50">
                  Bring your images to life with AI!
              </p>
          </header>

          {/* Glassmorphism Card Container */}
          <main className="w-full max-w-2xl bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-6 sm:p-10 transition-all duration-300 relative z-10 mb-8">
             {renderContent()}
          </main>
      </div>
    </div>
  );
};

export default App;
