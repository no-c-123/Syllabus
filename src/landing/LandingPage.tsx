import { motion } from "framer-motion";
import { ArrowRight, PenTool, Layout, Layers, Sparkles } from "lucide-react";

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden font-sans relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-900/20 rounded-full blur-[150px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center">
          <img src="/Girok-logo-full.png" alt="GirokIQ" className="h-10 w-auto object-contain" />
        </div>
        <button 
          onClick={onSignIn}
          className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          Sign In
        </button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-300">
            <Sparkles className="w-3 h-3" />
            <span>Reimagining the digital notebook</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[1.1] bg-linear-to-b from-white to-zinc-500 bg-clip-text text-transparent">
            Think clearly. <br /> Create freely.
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            An infinite canvas for your thoughts. Combine handwriting, text, and media 
            in a distraction-free environment designed for deep work.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={onGetStarted}
              className="group relative inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold transition-all shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.6)]"
            >
              <span>Start Creating</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full text-left"
        >
          <FeatureCard 
            icon={Layout}
            title="Infinite Canvas"
            description="No boundaries. Just space to explore ideas in every direction."
          />
          <FeatureCard 
            icon={PenTool}
            title="Natural Ink"
            description="Pressure-sensitive handwriting that feels just like paper."
          />
          <FeatureCard 
            icon={Layers}
            title="Mixed Media"
            description="Drag and drop images, type text, and draw all in one place."
          />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-xs text-zinc-600">
        <p>© 2024 GirokIQ. Crafted for thinkers.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
      <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-5 h-5 text-indigo-400" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-200 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
