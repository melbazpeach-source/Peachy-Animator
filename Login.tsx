import React, { useState } from 'react';
import { PeachIcon } from './components/PeachIcon';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple verification for now
    if (email && password) {
      onLoginSuccess();
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
      {/* Matching Background */}
      <div className="fixed inset-0 -z-10">
         <img src="https://images.unsplash.com/photo-1746124310569-64dce183ec38?q=80&w=1974&auto=format&fit=crop" className="w-full h-full object-cover opacity-90" alt="bg" />
         <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px]"></div>
      </div>

      <div className="w-full max-w-md bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-10 text-center">
        <PeachIcon className="w-16 h-16 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-orange-900 mb-6">Welcome Back</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email Address" 
            className="w-full p-4 bg-white/80 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full p-4 bg-white/80 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all"
          >
            Enter Peachy Web
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;


