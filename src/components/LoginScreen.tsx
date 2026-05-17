import { useState } from 'react';
import { Lock, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginScreen({ onLogin }: { onLogin: (user: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const users = [
    { name: 'Admin', avatar: 'A', role: 'System Administrator', color: 'from-blue-500 to-purple-600' },
    { name: 'Manager', avatar: 'M', role: 'Business Manager', color: 'from-green-500 to-teal-600' },
    { name: 'Cashier', avatar: 'C', role: 'Sales Staff', color: 'from-orange-500 to-red-600' },
  ];

  const handleLogin = () => {
    if (!username) { setError('Select a user'); return; }
    if (!password) { setError('Enter password'); return; }
    if (password === 'kobeos123') {
      onLogin(username);
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
      <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-white text-center mb-2">KobeOS</h1>
        <p className="text-gray-400 text-center mb-8">Select user to continue</p>
        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
        <div className="space-y-3 mb-6">
          {users.map(user => (
            <button key={user.name} onClick={() => { setUsername(user.name); setError(''); }}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                username === user.name ? 'border-blue-500 bg-blue-500/20' : 'border-gray-700 hover:border-gray-600'
              }`}>
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${user.color} flex items-center justify-center text-white font-bold`}>
                {user.avatar}
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">{user.name}</p>
                <p className="text-sm text-gray-400">{user.role}</p>
              </div>
            </button>
          ))}
        </div>
        {username && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-3 text-gray-500" />
              <input type="password" placeholder="Enter password (default: kobeos123)" value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
            </div>
            <Button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg rounded-xl">
              Sign In
            </Button>
          </div>
        )}
        <div className="flex justify-center mt-6">
          <button className="text-gray-500 hover:text-white" onClick={() => window.kobeOS?.system?.shutdown?.()}>
            <Power size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
