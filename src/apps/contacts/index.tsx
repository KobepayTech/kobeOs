import { Construction } from 'lucide-react';

export default function StubApp() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400">
      <Construction className="w-16 h-16 mb-4" />
      <h2 className="text-xl font-semibold">Coming Soon</h2>
      <p className="text-sm mt-1">This app is under development.</p>
    </div>
  );
}
