import { useState, useEffect, useRef } from 'react';

// ordio UI States v2 — With Caption Display
// Added: Live transcription area, caption preview in export

export default function OrdioUIStates() {
  const [currentState, setCurrentState] = useState('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [format, setFormat] = useState('vertical');
  const [showControls, setShowControls] = useState(false);
  const [waveformStyle, setWaveformStyle] = useState('bars');
  const [captionStyle, setCaptionStyle] = useState('bottom'); // bottom | center | karaoke
  
  // Simulated live transcription
  const [liveCaption, setLiveCaption] = useState('');
  const [captionWords, setCaptionWords] = useState([]);
  
  const sampleTranscript = [
    "Hey", "everyone,", "welcome", "back", "to", "the", "show.",
    "Today", "we're", "talking", "about", "something", "really", "exciting.",
    "Let's", "dive", "right", "in."
  ];

  // Simulate audio levels during recording
  useEffect(() => {
    if (currentState === 'recording') {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 0.7 + 0.3);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setAudioLevel(0);
    }
  }, [currentState]);

  // Simulate live transcription during recording
  useEffect(() => {
    if (currentState === 'recording') {
      setCaptionWords([]);
      let wordIndex = 0;
      const interval = setInterval(() => {
        if (wordIndex < sampleTranscript.length) {
          setCaptionWords(prev => [...prev, sampleTranscript[wordIndex]]);
          wordIndex++;
        } else {
          wordIndex = 0;
          setCaptionWords([]);
        }
      }, 400);
      return () => clearInterval(interval);
    } else {
      setCaptionWords([]);
    }
  }, [currentState]);

  // Simulate processing progress
  useEffect(() => {
    if (currentState === 'processing') {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setCurrentState('export'), 300);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [currentState]);

  const handleRecord = () => {
    if (currentState === 'idle') {
      setCurrentState('recording');
    } else if (currentState === 'recording') {
      setCurrentState('processing');
    }
  };

  const handleReset = () => {
    setCurrentState('idle');
    setProgress(0);
  };

  // Waveform Components
  const BarsWaveform = ({ level, isRecording, compact = false }) => {
    const bars = compact ? 16 : 24;
    const maxHeight = compact ? 60 : 100;
    return (
      <div className={`flex items-center justify-center gap-1 ${compact ? 'h-16' : 'h-24'}`}>
        {Array.from({ length: bars }).map((_, i) => {
          const distance = Math.abs(i - bars / 2) / (bars / 2);
          const height = isRecording 
            ? Math.max(4, (1 - distance * 0.5) * level * maxHeight + Math.sin(Date.now() / 100 + i) * 8)
            : 4 + Math.sin(Date.now() / 1000 + i * 0.3) * 3;
          return (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-75"
              style={{
                height: `${height}px`,
                background: isRecording 
                  ? `linear-gradient(to top, #3B82F6, #8B5CF6)`
                  : '#333',
                opacity: isRecording ? 1 : 0.5,
              }}
            />
          );
        })}
      </div>
    );
  };

  const CircleWaveform = ({ level, isRecording, compact = false }) => {
    const size = compact ? 48 : 80;
    const scale = isRecording ? 1 + level * 0.25 : 1 + Math.sin(Date.now() / 1000) * 0.03;
    const glowIntensity = isRecording ? level * 30 : 8;
    return (
      <div className={`flex items-center justify-center ${compact ? 'h-16' : 'h-24'}`}>
        <div
          className="relative rounded-full transition-transform duration-75"
          style={{
            width: size,
            height: size,
            transform: `scale(${scale})`,
            background: isRecording
              ? `radial-gradient(circle, #3B82F6 0%, #1E3A8A 70%, transparent 100%)`
              : `radial-gradient(circle, #333 0%, #1a1a1a 70%, transparent 100%)`,
            boxShadow: isRecording 
              ? `0 0 ${glowIntensity}px ${glowIntensity/2}px rgba(59, 130, 246, 0.4)`
              : 'none',
          }}
        />
      </div>
    );
  };

  const LineWaveform = ({ level, isRecording, compact = false }) => {
    const width = compact ? 120 : 200;
    const height = compact ? 40 : 60;
    const points = 40;
    const pathData = Array.from({ length: points }).map((_, i) => {
      const x = (i / (points - 1)) * width;
      const amplitude = isRecording ? level * (compact ? 15 : 25) : 4;
      const y = height/2 + Math.sin(Date.now() / 200 + i * 0.3) * amplitude;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
      <div className={`flex items-center justify-center ${compact ? 'h-16' : 'h-24'}`}>
        <svg width={width} height={height} className="overflow-visible">
          <path
            d={pathData}
            fill="none"
            stroke={isRecording ? "url(#gradientLine)" : "#333"}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="gradientLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  const WaveformDisplay = ({ level, isRecording, compact = false }) => {
    switch (waveformStyle) {
      case 'circle': return <CircleWaveform level={level} isRecording={isRecording} compact={compact} />;
      case 'line': return <LineWaveform level={level} isRecording={isRecording} compact={compact} />;
      default: return <BarsWaveform level={level} isRecording={isRecording} compact={compact} />;
    }
  };

  // Caption Display Components
  const LiveCaption = ({ words, style }) => {
    const displayWords = words.slice(-8); // Show last 8 words
    
    if (style === 'karaoke') {
      return (
        <div className="text-center px-4">
          <p className="text-lg font-medium leading-relaxed">
            {displayWords.map((word, i) => (
              <span 
                key={i} 
                className={`inline-block mr-2 transition-all duration-200 ${
                  i === displayWords.length - 1 
                    ? 'text-blue-400 scale-110' 
                    : 'text-white'
                }`}
                style={{
                  animation: i === displayWords.length - 1 ? 'popIn 0.2s ease-out' : 'none'
                }}
              >
                {word}
              </span>
            ))}
            <span className="inline-block w-0.5 h-5 bg-blue-400 animate-pulse ml-1" />
          </p>
        </div>
      );
    }

    return (
      <div className={`px-4 ${style === 'center' ? 'text-center' : ''}`}>
        <p className="text-lg font-medium leading-relaxed text-white">
          {displayWords.join(' ')}
          <span className="inline-block w-0.5 h-5 bg-white/60 animate-pulse ml-1" />
        </p>
      </div>
    );
  };

  // Video Preview Component (for Export state)
  const VideoPreview = ({ format, waveformStyle, captionStyle }) => {
    const isVertical = format === 'vertical';
    
    return (
      <div 
        className={`relative bg-gradient-to-b from-zinc-900 to-black rounded-xl overflow-hidden border border-white/10 ${
          isVertical ? 'w-56 h-96' : 'w-96 h-56'
        }`}
      >
        {/* Waveform Area */}
        <div className={`absolute ${
          isVertical 
            ? 'top-1/3 left-0 right-0' 
            : 'top-1/2 left-0 right-0 -translate-y-1/2'
        } flex justify-center`}>
          <WaveformDisplay level={0.6} isRecording={true} compact={true} />
        </div>

        {/* Caption Area */}
        <div className={`absolute left-0 right-0 px-4 ${
          captionStyle === 'center' 
            ? 'top-1/2 -translate-y-1/2' 
            : isVertical 
              ? 'bottom-16' 
              : 'bottom-8'
        }`}>
          <div className={`${captionStyle === 'center' ? 'text-center mt-20' : ''}`}>
            <p className={`font-semibold leading-tight ${
              isVertical ? 'text-sm' : 'text-base'
            }`}>
              <span className="bg-black/60 px-2 py-1 rounded">
                "Today we're talking about something really exciting."
              </span>
            </p>
          </div>
        </div>

        {/* Format Badge */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 rounded text-xs text-white/50">
          {isVertical ? '9:16' : '16:9'}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      {/* State Navigation — Demo Controls */}
      <div className="fixed top-4 left-4 flex gap-2 z-50">
        {['idle', 'recording', 'processing', 'export'].map(state => (
          <button
            key={state}
            onClick={() => {
              setCurrentState(state);
              if (state === 'processing') setProgress(0);
            }}
            className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wider transition-all ${
              currentState === state 
                ? 'bg-white text-black font-medium' 
                : 'bg-white/10 text-white/50 hover:bg-white/20'
            }`}
          >
            {state}
          </button>
        ))}
      </div>

      {/* Caption Style Selector — Demo Controls */}
      <div className="fixed top-4 right-4 flex gap-2 z-50">
        <span className="text-white/30 text-xs self-center mr-2">Caption:</span>
        {['bottom', 'center', 'karaoke'].map(style => (
          <button
            key={style}
            onClick={() => setCaptionStyle(style)}
            className={`px-3 py-1.5 rounded-full text-xs transition-all ${
              captionStyle === style 
                ? 'bg-blue-500 text-white' 
                : 'bg-white/10 text-white/50 hover:bg-white/20'
            }`}
          >
            {style}
          </button>
        ))}
      </div>

      {/* Main Canvas */}
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-8 relative"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        
        {/* IDLE STATE */}
        {currentState === 'idle' && (
          <div className="flex flex-col items-center gap-10 animate-fadeIn">
            {/* Logo */}
            <div className="text-center">
              <h1 className="text-4xl font-extralight tracking-tight">
                ord<span className="text-blue-500 font-light">io</span>
              </h1>
              <p className="text-white/30 text-sm mt-2 tracking-widest">audio → video</p>
            </div>

            {/* Idle Waveform */}
            <WaveformDisplay level={0.2} isRecording={false} />

            {/* Caption Preview Area — Placeholder */}
            <div className="h-12 flex items-center justify-center">
              <p className="text-white/20 text-sm">Your words will appear here</p>
            </div>

            {/* Main Action */}
            <button
              onClick={handleRecord}
              className="group relative w-20 h-20 rounded-full bg-white/5 border border-white/10 
                         hover:bg-white/10 hover:border-white/20 transition-all duration-300
                         hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-red-500 group-hover:bg-red-400 transition-colors" />
              </div>
            </button>
            
            <p className="text-white/20 text-xs tracking-widest uppercase">tap to record</p>

            {/* Upload Option */}
            <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <button className="text-white/30 text-sm hover:text-white/60 transition-colors underline underline-offset-4">
                or upload audio file
              </button>
            </div>
          </div>
        )}

        {/* RECORDING STATE */}
        {currentState === 'recording' && (
          <div className="flex flex-col items-center gap-6 animate-fadeIn max-w-lg">
            {/* Recording Indicator */}
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white/50 text-sm tracking-wider uppercase">recording</span>
            </div>

            {/* Timer */}
            <div className="text-5xl font-extralight tabular-nums tracking-tight">
              <RecordingTimer />
            </div>

            {/* Active Waveform */}
            <WaveformDisplay level={audioLevel} isRecording={true} />

            {/* LIVE CAPTION AREA — The Key Addition */}
            <div className="w-full min-h-20 flex items-center justify-center bg-white/5 rounded-xl px-6 py-4 border border-white/10">
              {captionWords.length > 0 ? (
                <LiveCaption words={captionWords} style={captionStyle} />
              ) : (
                <p className="text-white/30 text-sm animate-pulse">Listening...</p>
              )}
            </div>

            {/* Stop Button */}
            <button
              onClick={handleRecord}
              className="group relative w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40
                         hover:bg-red-500/30 hover:border-red-500/60 transition-all duration-300
                         hover:scale-105 active:scale-95 mt-4"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-7 h-7 rounded-sm bg-red-500" />
              </div>
            </button>

            <p className="text-white/20 text-xs tracking-widest uppercase">tap to finish</p>
          </div>
        )}

        {/* PROCESSING STATE */}
        {currentState === 'processing' && (
          <div className="flex flex-col items-center gap-10 animate-fadeIn">
            <div className="text-center">
              <h2 className="text-2xl font-light text-white/90">Creating your video</h2>
              <p className="text-white/40 text-sm mt-2">This won't take long</p>
            </div>

            {/* Progress Ring */}
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="64"
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth="4"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="64"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 64}`}
                  strokeDashoffset={`${2 * Math.PI * 64 * (1 - progress / 100)}`}
                  className="transition-all duration-100"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-light tabular-nums">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Processing Steps */}
            <div className="flex flex-col items-center gap-3 text-sm">
              <ProcessingStep done={progress > 15} active={progress <= 15 && progress > 0}>
                Analyzing audio
              </ProcessingStep>
              <ProcessingStep done={progress > 35} active={progress > 15 && progress <= 35}>
                Generating transcript
              </ProcessingStep>
              <ProcessingStep done={progress > 60} active={progress > 35 && progress <= 60}>
                Rendering waveform
              </ProcessingStep>
              <ProcessingStep done={progress > 85} active={progress > 60 && progress <= 85}>
                Encoding video
              </ProcessingStep>
              <ProcessingStep done={progress === 100} active={progress > 85 && progress < 100}>
                Finalizing
              </ProcessingStep>
            </div>
          </div>
        )}

        {/* EXPORT STATE */}
        {currentState === 'export' && (
          <div className="flex flex-col items-center gap-8 animate-fadeIn">
            {/* Success */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-light">Ready to share</h2>
            </div>

            {/* Video Preview with Captions */}
            <VideoPreview 
              format={format} 
              waveformStyle={waveformStyle}
              captionStyle={captionStyle}
            />

            {/* Format Toggle */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
              <button
                onClick={() => setFormat('vertical')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  format === 'vertical' 
                    ? 'bg-white text-black' 
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                Vertical · 9:16
              </button>
              <button
                onClick={() => setFormat('horizontal')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  format === 'horizontal' 
                    ? 'bg-white text-black' 
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                Horizontal · 16:9
              </button>
            </div>

            {/* Download */}
            <button className="px-10 py-3.5 bg-white text-black rounded-full font-semibold 
                             hover:bg-white/90 transition-all hover:scale-105 active:scale-95
                             shadow-lg shadow-white/10">
              Download MP4
            </button>

            <button 
              onClick={handleReset}
              className="text-white/30 text-sm hover:text-white/60 transition-colors"
            >
              Create another
            </button>
          </div>
        )}

        {/* Waveform Style Selector */}
        <div className={`fixed bottom-8 right-8 flex gap-2 transition-opacity duration-300 ${
          showControls && (currentState === 'idle' || currentState === 'recording') ? 'opacity-100' : 'opacity-0'
        }`}>
          <span className="text-white/20 text-xs self-center mr-2">Wave:</span>
          {['bars', 'circle', 'line'].map(style => (
            <button
              key={style}
              onClick={() => setWaveformStyle(style)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                waveformStyle === style 
                  ? 'bg-white/20 border border-white/40' 
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
              }`}
              title={style}
            >
              {style === 'bars' && <BarsIcon />}
              {style === 'circle' && <CircleIcon />}
              {style === 'line' && <LineIcon />}
            </button>
          ))}
        </div>

        {/* Brand Watermark */}
        <div className="fixed bottom-8 left-8 text-white/10 text-xs tracking-widest">
          ordio
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1.1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

// Helper Components
function RecordingTimer() {
  const [seconds, setSeconds] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function ProcessingStep({ children, done, active }) {
  return (
    <div className={`flex items-center gap-3 transition-all ${
      done ? 'text-green-400' : active ? 'text-white' : 'text-white/25'
    }`}>
      {done ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : active ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <div className="w-4 h-4 rounded-full border border-current opacity-50" />
      )}
      <span className="text-sm">{children}</span>
    </div>
  );
}

function BarsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-white/60">
      <rect x="1" y="6" width="2" height="4" fill="currentColor" rx="0.5" />
      <rect x="5" y="3" width="2" height="10" fill="currentColor" rx="0.5" />
      <rect x="9" y="5" width="2" height="6" fill="currentColor" rx="0.5" />
      <rect x="13" y="4" width="2" height="8" fill="currentColor" rx="0.5" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-white/60">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="text-white/60">
      <path d="M1 8 Q4 4, 8 8 T15 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
