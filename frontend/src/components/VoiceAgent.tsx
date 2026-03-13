'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { parseVoiceIntent } from '@/lib/voiceIntentParser';

type AgentState = 'idle' | 'listening' | 'processing' | 'executing';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const HELP_TEXT = [
  '"Search for education schemes"',
  '"Find farming schemes in Maharashtra"',
  '"Go to dashboard / profile / saved"',
  '"Show central government schemes"',
  '"Filter by health"  (on search page)',
  '"Clear filters"  (on search page)',
  '"Save this scheme"  (on scheme page)',
  '"Go back"',
];

async function parseWithAI(transcript: string) {
  try {
    const response = await api.post('/voice/parse', { transcript });
    return response.data.data;
  } catch {
    // Gemini unavailable — fall back to local parser
    return parseVoiceIntent(transcript);
  }
}

export default function VoiceAgent() {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      const current = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setTranscript(current);
      if (event.results[event.results.length - 1].isFinal) {
        setState('processing');
        handleTranscript(current);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        toast('No speech detected. Try again.', { icon: '🎤' });
      } else {
        toast.error(`Voice error: ${event.error}`);
      }
      reset();
    };

    recognition.onend = () => { reset(); };
    recognitionRef.current = recognition;
  }, []);

  const reset = () => {
    setState('idle');
    setTranscript('');
  };

  const handleTranscript = useCallback(async (text: string) => {
    setState('processing');
    let parsed: any;

    try {
      parsed = await parseWithAI(text);
    } catch {
      parsed = parseVoiceIntent(text);
    }

    const { intent, entities } = parsed;
    const onSearchPage = pathnameRef.current === '/search';
    setState('executing');

    switch (intent) {
      case 'stop':
        reset();
        return;

      case 'help':
        setShowHelp(true);
        reset();
        return;

      case 'go_back':
        toast('Going back...', { icon: '⬅️' });
        router.back();
        break;

      case 'navigate':
        if (entities?.page) {
          const label = entities.page.replace('/', '') || 'page';
          toast(`Opening ${label}...`, { icon: '🧭' });
          router.push(entities.page);
        }
        break;

      case 'search': {
        if (onSearchPage) {
          toast(entities?.query ? `Searching "${entities.query}"...` : 'Searching...', { icon: '🔍' });
          window.dispatchEvent(new CustomEvent('voice-search', { detail: parsed }));
        } else {
          const params = new URLSearchParams();
          if (entities?.query) params.set('q', entities.query);
          if (entities?.category) params.set('category', entities.category);
          if (entities?.level) params.set('level', entities.level);
          if (entities?.state) params.set('state', entities.state);
          toast(entities?.query ? `Searching "${entities.query}"...` : 'Opening search...', { icon: '🔍' });
          router.push(`/search?${params.toString()}`);
        }
        break;
      }

      case 'filter':
        if (onSearchPage) {
          toast('Applying filter...', { icon: '🔧' });
          window.dispatchEvent(new CustomEvent('voice-filter', { detail: parsed }));
        } else {
          const params = new URLSearchParams();
          if (entities?.category) params.set('category', entities.category);
          if (entities?.level) params.set('level', entities.level);
          router.push(`/search?${params.toString()}`);
        }
        break;

      case 'clear_filters':
        toast('Clearing filters...', { icon: '✖️' });
        window.dispatchEvent(new CustomEvent('voice-clear', {}));
        break;

      case 'save_scheme':
        window.dispatchEvent(new CustomEvent('voice-save', {}));
        toast('Saving scheme...', { icon: '🔖' });
        break;

      default:
        toast('Didn\'t understand. Say "help" for commands.', { icon: '❓' });
    }

    setTimeout(reset, 1500);
  }, [router]);

  const toggleListening = () => {
    if (!supported) {
      toast.error('Voice not supported. Try Chrome or Edge.');
      return;
    }
    if (state === 'listening') {
      recognitionRef.current?.stop();
      reset();
    } else {
      setTranscript('');
      setState('listening');
      try { recognitionRef.current?.start(); } catch { reset(); }
    }
  };

  if (!supported) return null;

  return (
    <>
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Voice Commands</h3>
            <p className="text-xs text-gray-500 mb-4">Say any of these:</p>
            <ul className="space-y-2">
              {HELP_TEXT.map((cmd, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-yellow-500">✦</span> {cmd}
                </li>
              ))}
            </ul>
            <button onClick={() => setShowHelp(false)} className="mt-5 w-full bg-yellow-500 text-black py-2 rounded-lg font-medium hover:bg-yellow-400">
              Got it
            </button>
          </div>
        </div>
      )}

      {transcript && (
        <div className="fixed bottom-24 right-6 z-40 bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-lg max-w-xs text-sm text-gray-700">
          🎤 {transcript}
        </div>
      )}

      <button
        onClick={toggleListening}
        aria-label={state === 'listening' ? 'Stop listening' : 'Start voice command'}
        className={`
          fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center transition-all duration-200
          ${state === 'idle' ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : ''}
          ${state === 'listening' ? 'bg-red-500 text-white scale-110' : ''}
          ${state === 'processing' || state === 'executing' ? 'bg-gray-700 text-white' : ''}
        `}
      >
        {state === 'listening' && <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60" />}
        {state === 'idle' && <MicIcon />}
        {state === 'listening' && <StopIcon />}
        {(state === 'processing' || state === 'executing') && <SpinnerIcon />}
      </button>
    </>
  );
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-6 w-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
