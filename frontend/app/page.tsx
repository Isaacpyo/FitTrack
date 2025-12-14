import React from 'react';
import { Activity, Flame, Timer, TrendingUp } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-red-500 selection:text-white">
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-6xl md:text-9xl font-black italic tracking-tighter mb-8 uppercase text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-600">
          FitTrack
        </h1>
        <p className="text-2xl text-zinc-400 mb-12 max-w-2xl mx-auto">
          Track progress. Build habits. <span className="text-red-500 font-bold">No excuses.</span>
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 hover:border-red-500/50 transition group">
            <Flame className="w-10 h-10 text-red-500 mb-4 group-hover:scale-110 transition" />
            <h3 className="text-xl font-bold mb-2">Heatmap Analytics</h3>
            <p className="text-zinc-500">Visualize your consistency over 365 days.</p>
          </div>
          <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 hover:border-red-500/50 transition group">
            <Activity className="w-10 h-10 text-red-500 mb-4 group-hover:scale-110 transition" />
            <h3 className="text-xl font-bold mb-2">Form Correction</h3>
            <p className="text-zinc-500">AI analysis of your lifting technique via camera.</p>
          </div>
          <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 hover:border-red-500/50 transition group">
            <TrendingUp className="w-10 h-10 text-red-500 mb-4 group-hover:scale-110 transition" />
            <h3 className="text-xl font-bold mb-2">Progressive Overload</h3>
            <p className="text-zinc-500">Smart weight suggestions for every session.</p>
          </div>
        </div>

        <button className="mt-16 bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-full font-bold text-lg transition shadow-lg shadow-red-900/20">
          Start Your Transformation
        </button>
      </div>
    </main>
  );
}
