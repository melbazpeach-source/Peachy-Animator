import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { PeachIcon } from './components/PeachIcon';
import Login from './Login';

// --- CONFIGURATION ---
// 1. PASTE YOUR NEW KEY HERE
const MY_GIFT_KEY = "AIzaSyDZwYp5OI_Z7rLGeeMJPuRv8nF_0-9g1yU";

const loadingMessages = [
"Warming up the animation engines...",
"Gathering stardust for that extra sparkle...",
"Sketching your vision into motion...",
"Composing a symphony of frames...",
];

const fileToBase64 = (file: File): Promise<string> =>
new Promise((resolve, reject) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = () => resolve((reader.result as string).split(',')[1]);
reader.onerror = (error) => reject(error);
});

// --- THE ANIMATOR ENGINE ---
const AnimatorEngine: React.FC = () => {
const [imageFile, setImageFile] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string | null>(null);
const [prompt, setPrompt] = useState<string>('');
const [isLoading, setIsLoading] = useState(false);
const [isSharing, setIsSharing] = useState(false);
const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
const [videoUrl, setVideoUrl] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);

const fileInputRef = useRef<HTMLInputElement>(null);
const loadingIntervalRef = useRef<number | null>(null);

const handleDownload = () => {
if (!videoUrl) return;
const a = document.createElement('a');
a.href = videoUrl;
a.download = `peachy-animation-${Date.now()}.mp4`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
};

const handleShare = async () => {
if (!videoUrl) return;
setIsSharing(true);
try {
const response = await fetch(videoUrl);
const blob = await response.blob();
const file = new File([blob], "peachy-animation.mp4", { type: "video/mp4" });
if (navigator.canShare && navigator.canShare({ files: [file] })) {
await navigator.share({ files: [file], title: 'My Peachy Animation' });
} else {
handleDownload();
}
} catch (err) {
console.error("Share failed", err);
} finally {
setIsSharing(false);
}
};

const handleGenerateVideo = useCallback(async () => {
if (!imageFile || !prompt.trim()) return;
setError(null);
setIsLoading(true);
loadingIntervalRef.current = window.setInterval(() => {
setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
}, 3500);

try {
const ai = new GoogleGenAI({ apiKey: MY_GIFT_KEY });
const imageBase64 = await fileToBase64(imageFile);
let operation = await ai.models.generateVideos({
model: 'veo-3.1-fast-generate-preview',
prompt: prompt,
image: { imageBytes: imageBase64, mimeType: imageFile.type }
});
while (!operation.done) {
await new Promise(r => setTimeout(r, 5000));
operation = await ai.operations.getVideosOperation({ operation: operation });
}
const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
const videoResponse = await fetch(`${downloadLink}&key=${MY_GIFT_KEY}`);
const videoBlob = await videoResponse.blob();
setVideoUrl(URL.createObjectURL(videoBlob));
} catch (err) {
setError("AI is resting. Check your key!");
} finally {
setIsLoading(false);
if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
}
}, [imageFile, prompt]);

if (isLoading) return (
<div className="text-center py-12">
<PeachIcon className="w-20 h-20 mx-auto animate-bounce mb-4" />
<p className="text-orange-900 font-bold">{loadingMessage}</p>
</div>
);

if (videoUrl) return (
<div className="space-y-6 text-center">
<video src={videoUrl} controls autoPlay loop className="w-full rounded-2xl shadow-lg border-4 border-white" />
<div className="grid grid-cols-2 gap-3">
<button onClick={handleShare} className="bg-blue-500 text-white font-bold py-3 rounded-xl">{isSharing ? "..." : "📤 Share"}</button>
<button onClick={handleDownload} className="bg-green-500 text-white font-bold py-3 rounded-xl">💾 Save</button>
<button onClick={() => {setVideoUrl(null); setImagePreview(null); setPrompt('');}} className="col-span-2 bg-orange-500 text-white font-bold py-4 rounded-xl">New Animation</button>
</div>
</div>
);

return (
<div className="space-y-6">
<div onClick={() => fileInputRef.current?.click()} className="h-48 border-2 border-dashed border-orange-300 rounded-2xl flex flex-col items-center justify-center bg-orange-50/50 cursor-pointer">
<input ref={fileInputRef} type="file" className="hidden" onChange={(e) => {
const file = e.target.files?.[0];
if (file) {
setImageFile(file);
const reader = new FileReader();
reader.onloadend = () => setImagePreview(reader.result as string);
reader.readAsDataURL(file);
}
}} />
{imagePreview ? <img src={imagePreview} className="h-full object-contain p-2" /> : <p className="text-orange-800 font-bold">📸 Upload Image</p>}
</div>
<textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the motion..." className="w-full p-4 border-2 border-orange-200 rounded-xl outline-none h-32" />
<button onClick={handleGenerateVideo} className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg">✨ Animate It!</button>
{error && <p className="text-red-500 text-center font-bold">{error}</p>}
</div>
);
};

// --- MAIN APP ---
const App: React.FC = () => {
const [isLoggedIn, setIsLoggedIn] = useState(false);

return (
<div className="min-h-screen w-full relative">
{/* Background with a soft blur */}
<div className="fixed inset-0 -z-10 bg-orange-100">
<img src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=2574&auto=format&fit=crop" className="w-full h-full object-cover opacity-60" />
</div>

<div className="flex flex-col items-center p-4">
<header className="text-center my-8">
<PeachIcon className="w-16 h-16 mx-auto mb-2" />
<h1 className="text-5xl font-bold text-white drop-shadow-lg">Peachy Web</h1>
</header>

<main className="w-full max-w-xl bg-white/95 p-8 rounded-3xl shadow-2xl relative z-10">

{!isLoggedIn ? (
<div className="text-center">
{/* BIG BOUNCING CAKE */}
<div className="text-7xl mb-6 animate-bounce">🎂</div>

<h2 className="text-5xl font-extrabold text-orange-600 mb-2">
Happy Birthday!
</h2>

<p className="text-xl text-gray-600 mb-8 font-medium">
Ready to make some magic? ✨
</p>

{/* LOGIN BUTTON THAT TRIGGERS CONFETTI */}
<Login onLoginSuccess={() => {
setIsLoggedIn(true);
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
script.onload = () => {
(window as any).confetti({
particleCount: 150,
spread: 70,
origin: { y: 0.6 }
});
};
document.head.appendChild(script);
}} />

</div>
) : (
<div className="space-y-4">
<div className="flex justify-between items-center mb-4">
<h2 className="text-xl font-bold text-orange-600">Create Magic</h2>
<button onClick={() => setIsLoggedIn(false)} className="text-xs font-bold text-gray-400 underline uppercase tracking-widest">Sign Out</button>
</div>
<AnimatorEngine />
</div>
)}

</main>
</div>
</div>
);
};

export default App;

