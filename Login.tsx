import React, { useState } from 'react';

// This defines what "props" the Login component expects
interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLoginSuccess();
    }
  };

  const styles: { [key: string]: React.CSSProperties } = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#fff5f5' },
    card: { padding: '2rem', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', backgroundColor: 'white', width: '320px', textAlign: 'center' },
    input: { width: '100%', padding: '10px', margin: '10px 0', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' },
    button: { width: '100%', padding: '12px', backgroundColor: '#ff8c94', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={{ color: '#ff8c94' }}>Peachy Animator</h2>
        <form onSubmit={handleSubmit}>
          <input style={styles.input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={styles.input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button style={styles.button} type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;

