import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { PeachIcon } from './components/PeachIcon';
import Login from './Login';

// --- CONFIGURATION ---
const MY_GIFT_KEY = "PASTE_YOUR_API_KEY_HERE";

const loadingMessages = [
"Warming up the animation engines...",
"Gathering stardust for that extra sparkle...",
"Sketching your vision into motion...",
"This might take a minute, great art needs patience!",
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
const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
const [isLoading, setIsLoading] = useState(false);
const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
const [videoUrl, setVideoUrl] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);
const [userKey, setUserKey] = useState<string>(''); // For if he wants his own key

const fileInputRef = useRef<HTMLInputElement>(null);
const loadingIntervalRef = useRef<number | null>(null);

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (file) {
setVideoUrl(null);
setImageFile(file);
const reader = new FileReader();
reader.onloadend = () => setImagePreview(reader.result as string);
reader.readAsDataURL(file);
}
};

const handleGenerateVideo = useCallback(async () => {
if (!imageFile || !prompt.trim()) {
setError("Please provide an image and a description!");
return;
}

setError(null);
setIsLoading(true);

// Start loading messages
loadingIntervalRef.current = window.setInterval(() => {
setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
}, 3500);

try {
// Use HIS key if he provided one, otherwise use YOUR gift key
const activeKey = userKey.trim() || MY_GIFT_KEY;
const ai = new GoogleGenAI({ apiKey: activeKey });
const imageBase64 = await fileToBase64(imageFile);

let operation = await ai.models.generateVideos({
model: 'veo-3.1-fast-generate-preview',
prompt: prompt,
image: { imageBytes: imageBase64, mimeType: imageFile.type },
config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
});

while (!operation.done) {
await new Promise(r => setTimeout(r, 5000));
operation = await ai.operations.getVideosOperation({ operation: operation });
}

const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
const videoResponse = await fetch(`${downloadLink}&key=${activeKey}`);
const videoBlob = await videoResponse.blob();
setVideoUrl(URL.createObjectURL(videoBlob));
} catch (err: any) {
setError("The AI is taking a nap. Check your API key or connection!");
console.error(err);
} finally {
setIsLoading(false);
if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
}
}, [imageFile, prompt, aspectRatio, userKey]);

if (isLoading) {
return (
<div className="text-center py-12">
<PeachIcon className="w-24 h-24 mx-auto animate-bounce mb-6" />
<p className="text-orange-900 font-bold animate-pulse">{loadingMessage}</p>
</div>
);
}

if (videoUrl) {
return (
<div className="space-y-6 text-center">
<video src={videoUrl} controls autoPlay loop className="w-full rounded-2xl shadow-lg border-4 border-white" />
<button onClick={() => {setVideoUrl(null); setImagePreview(null); setPrompt('');}} className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg">
Make Another!
</button>
</div>
);
}

return (
<div className="space-y-6">
{/* 1. Upload */}
<div onClick={() => fileInputRef.current?.click()} className="h-48 border-2 border-dashed border-orange-300 rounded-2xl flex flex-col items-center justify-center bg-orange-50/50 cursor-pointer hover:bg-orange-100 transition-all">
<input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
{imagePreview ? <img src={imagePreview} className="h-full object-contain p-2" /> : <p className="text-orange-800 font-bold">📸 Tap to upload image</p>}
</div>

{/* 2. Prompt */}
<textarea
value={prompt}
onChange={e => setPrompt(e.target.value)}
placeholder="Describe how it moves... (e.g. 'gentle wind blowing', 'exploding into glitter')"
className="w-full p-4 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none h-32"
/>

{/* 3. Generate */}
<button onClick={handleGenerateVideo} className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold py-4 rounded-xl shadow-xl transform active:scale-95 transition-all">
✨ Animate It!
</button>

{/* 4. Optional "Backdoor" for his own key */}
<details className="mt-4">
<summary className="text-xs text-orange-400 cursor-pointer text-center">Advanced: Use custom API key</summary>
<input
type="password"
value={userKey}
onChange={(e) => setUserKey(e.target.value)}
placeholder="Paste custom key here"
className="w-full mt-2 p-2 text-xs border rounded-lg bg-white/50"
/>
</details>
{error && <p className="text-red-500 text-center text-sm font-bold">{error}</p>}
</div>
);
};

// --- WRAPPER APP ---
const App: React.FC = () => {
const [isLoggedIn, setIsLoggedIn] = useState(false);

return (
<div className="min-h-screen w-full relative">
{/* Background */}
<div className="fixed inset-0 -z-10">
<img src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=2574&auto=format&fit=crop" className="w-full h-full object-cover" />
<div className="absolute inset-0 bg-white/40 backdrop-blur-sm"></div>
</div>

<div className="flex flex-col items-center p-4">
<header className="text-center my-8">
<PeachIcon className="w-16 h-16 mx-auto mb-2 drop-shadow-md" />
<h1 className="text-5xl font-bold text-white drop-shadow-lg mb-2">Peachy Web</h1>
{isLoggedIn && (
<button onClick={() => setIsLoggedIn(false)} className="text-orange-800 bg-white/50 px-4 py-1 rounded-full text-xs font-bold">Sign Out</button>
)}
</header>

<main className="w-full max-w-xl bg-white/90 p-8 rounded-3xl shadow-2xl border border-white/50">
{!isLoggedIn ? (
<Login onLoginSuccess={() => setIsLoggedIn(true)} />
) : (
<AnimatorEngine />
)}
</main>
</div>
</div>
);
};

export default App;

