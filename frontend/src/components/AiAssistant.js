import { useState, useEffect, useRef } from 'react';
import { aiApi, formatApiError } from '../lib/api';
import { MessageCircle, X, Send, Trash2, Loader2 } from 'lucide-react';

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && !historyLoaded) {
      loadHistory();
    }
  }, [isOpen, historyLoaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const res = await aiApi.getHistory();
      setMessages(res.data.map(m => ({ role: m.role, content: m.content })));
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await aiApi.chat(text);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erreur: ${formatApiError(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await aiApi.clearHistory();
      setMessages([]);
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-52 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          isOpen 
            ? 'bg-zinc-800 border border-white/[0.1] rotate-0' 
            : 'bg-[#FF3B30] hover:bg-[#FF3B30]/90 hover:scale-110'
        }`}
        data-testid="ai-assistant-toggle"
      >
        {isOpen ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-52 z-50 w-[400px] max-h-[560px] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in"
          data-testid="ai-chat-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FF3B30]/20 flex items-center justify-center">
                <MessageCircle size={16} className="text-[#FF3B30]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Assistant IA</h3>
                <p className="text-[11px] text-zinc-500">Analyse et aide</p>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Effacer l'historique"
              data-testid="ai-clear-history"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[380px]">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle size={32} className="mx-auto mb-3 text-zinc-700" />
                <p className="text-sm text-zinc-500 mb-1">Assistant BTP Manager</p>
                <p className="text-xs text-zinc-600">Posez vos questions sur la plateforme ou demandez une analyse des données.</p>
                <div className="mt-4 space-y-2">
                  {['Comment fonctionne la plateforme ?', 'Combien d\'utilisateurs sont actifs ?', 'Quels sont les pôles et outils ?'].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12] transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#FF3B30] text-white rounded-br-md'
                      : 'bg-white/[0.04] border border-white/[0.06] text-zinc-200 rounded-bl-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.06]">
                  <Loader2 size={16} className="animate-spin text-zinc-400" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/[0.06]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                className="flex-1 px-4 py-2.5 text-sm input-field rounded-xl resize-none max-h-24"
                rows={1}
                data-testid="ai-chat-input"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-2.5 bg-[#FF3B30] text-white rounded-xl hover:bg-[#FF3B30]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                data-testid="ai-send-btn"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
