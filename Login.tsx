import React, { useState } from 'react';
import { PeachIcon } from './components/PeachIcon';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (email && password) {
      try {
        localStorage.setItem('peachy_user_email', email);
        localStorage.setItem('peachy_logged_in', 'true');
      } catch (err) {
        console.error("Storage error:", err);
      }
      onLoginSuccess();
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      try {
        localStorage.setItem('peachy_logged_in', 'true');
      } catch {}
      onLoginSuccess();
    } catch (err: any) {
      console.error("Google login failed:", err);
      setLoginError("Could not sign in with Google. You can sign in with email or continue as guest.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestEntry = () => {
    try {
      localStorage.setItem('peachy_logged_in', 'true');
    } catch {}
    onLoginSuccess();
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
      {/* Matching Background */}
      <div className="fixed inset-0 -z-10">
         <img 
           src="https://images.unsplash.com/photo-1746124310569-64dce183ec38?q=80&w=1974&auto=format&fit=crop" 
           className="w-full h-full object-cover opacity-90" 
           alt="bg" 
         />
         <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]"></div>
      </div>

      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/70 p-8 sm:p-10 text-center">
        <div className="w-20 h-20 mx-auto mb-3 transform transition-transform hover:scale-110">
          <PeachIcon className="w-full h-full" />
        </div>
        <h2 className="text-3xl font-extrabold text-orange-950 mb-1">Welcome Back</h2>
        <p className="text-sm font-semibold text-orange-800/80 mb-6">Enter Peachy Web to animate your photos</p>
        
        {loginError && (
          <div className="mb-4 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 text-left">
            {loginError}
          </div>
        )}

        {/* Google Sign In Option */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="w-full mb-4 flex items-center justify-center gap-3 bg-white hover:bg-orange-50/60 text-orange-950 font-bold py-3 px-4 rounded-xl border border-orange-200 shadow-sm hover:shadow transition-all cursor-pointer text-sm"
        >
          {isGoogleLoading ? (
            <span className="animate-pulse">Connecting to Google...</span>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-orange-200"></div>
          <span className="px-3 text-xs font-semibold text-orange-600/70 uppercase tracking-wider">or email</span>
          <div className="flex-1 border-t border-orange-200"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <input 
            type="email" 
            placeholder="Email Address" 
            className="w-full p-3.5 bg-white/90 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none text-sm text-orange-950 placeholder:text-orange-400/80 transition-all"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full p-3.5 bg-white/90 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none text-sm text-orange-950 placeholder:text-orange-400/80 transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer text-base"
          >
            Enter Peachy Web
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-orange-100">
          <button
            type="button"
            onClick={handleGuestEntry}
            className="text-xs font-semibold text-orange-700 hover:text-orange-950 hover:underline cursor-pointer transition-colors"
          >
            Skip for now &amp; explore as Guest →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
