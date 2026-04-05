import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, ExternalLink, Bot, ChevronDown, Trash2, Globe } from 'lucide-react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getDomainName = (uri: string) => {
  try {
    const url = new URL(uri);
    let hostname = url.hostname.replace(/^www\./, '');
    if (hostname.includes('wikipedia.org')) return 'Wikipedia';
    if (hostname.includes('imdb.com')) return 'IMDb';
    if (hostname.includes('reddit.com')) return 'Reddit';
    if (hostname.includes('fandom.com') || hostname.includes('wikia.com')) return 'Fandom';
    if (hostname.includes('youtube.com')) return 'YouTube';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'X (Twitter)';
    
    const parts = hostname.split('.');
    let name = parts[0];
    if (parts.length > 2 && parts[0].length <= 3) {
      name = parts[1];
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch (e) {
    return 'Source';
  }
};

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: { uri: string; title: string }[];
}

export default function ChatMenu() {
  const [isOpen, setIsOpen] = useState(false);
  
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem('chat_model');
    return saved || 'gemini-3-flash-preview';
  });
  
  const [useSearch, setUseSearch] = useState(() => {
    const saved = localStorage.getItem('chat_use_search');
    return saved !== 'false'; // Defaults to true unless explicitly 'false'
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('chat_model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('chat_use_search', useSearch.toString());
  }, [useSearch]);

  // Auto-focus when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n\n');
        
      const prompt = history 
        ? `Previous conversation:\n${history}\n\nUser: ${userMessage.text}`
        : userMessage.text;

      const config: any = {};
      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: prompt,
        config,
      });

      let fullText = '';
      let sources: { uri: string; title: string }[] = [];
      let supports: any[] = [];
      let isFirstChunk = true;
      const messageId = (Date.now() + 1).toString();

      for await (const chunk of responseStream) {
        const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          const chunks = groundingMetadata.groundingChunks as any[];
          sources = chunks.map(c => ({
            uri: c.web?.uri || '',
            title: c.web?.title || 'Source'
          }));
        }
        if (groundingMetadata?.groundingSupports) {
          supports = groundingMetadata.groundingSupports as any[];
        }

        if (chunk.text) {
          fullText += chunk.text;
          if (isFirstChunk) {
            setIsLoading(false);
            isFirstChunk = false;
            setMessages((prev) => [...prev, { id: messageId, role: 'model', text: fullText }]);
          } else {
            setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, text: fullText } : m));
          }
        }
      }

      if (isFirstChunk) {
        // If stream ended without any text
        setIsLoading(false);
        setMessages((prev) => [...prev, { id: messageId, role: 'model', text: 'Sorry, I could not generate a response.' }]);
      } else {
        let finalText = fullText;
        if (supports && supports.length > 0) {
          const sortedSupports = [...supports].sort((a, b) => (b.segment?.endIndex || 0) - (a.segment?.endIndex || 0));
          sortedSupports.forEach(support => {
            if (support.segment?.endIndex !== undefined && support.groundingChunkIndices && support.groundingChunkIndices.length > 0) {
              const indices = support.groundingChunkIndices.join(',');
              const citation = `[ ](cite:${indices})`;
              finalText = finalText.slice(0, support.segment.endIndex) + citation + finalText.slice(support.segment.endIndex);
            }
          });
        }
        
        finalText = finalText.replace(/\[\d+(?:,\s*\d+)*\]/g, '');

        setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, text: finalText, sources: sources.length > 0 ? sources : undefined } : m));
      }

    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: 'Sorry, I encountered an error while processing your request. Please try again later.',
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/20 transition-all duration-300 z-40 flex items-center justify-center group ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        aria-label="Open chat"
      >
        <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-6 right-6 w-[380px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-6rem)] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <div className="flex-1 mr-4 relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm font-medium rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Advanced)</option>
              <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setUseSearch(!useSearch)}
              className={`p-2 rounded-full transition-colors ${useSearch ? 'text-blue-400 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800'}`}
              title={useSearch ? "Web Search Enabled" : "Web Search Disabled"}
            >
              <Globe className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setMessages([])}
              disabled={messages.length === 0}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-950/50 custom-scrollbar">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                    : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700/50'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <div className="text-sm prose prose-invert prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 max-w-none break-words">
                      <Markdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, href, children, ...props }) => {
                            if (href?.startsWith('cite:')) {
                              const indices = href.replace('cite:', '').split(',').map(Number);
                                  const validIndices = indices.filter(i => !isNaN(i) && msg.sources && msg.sources[i] && msg.sources[i].uri);
                                  
                                  if (validIndices.length === 0) return <span>{children}</span>;

                                  // Deduplicate sources for the tooltip
                                  const uniqueSources = Array.from(new Map(validIndices.map(i => [msg.sources![i].uri, msg.sources![i]])).values());
                                  
                                  let hostname = '';
                                  try {
                                    hostname = new URL(uniqueSources[0].uri).hostname;
                                  } catch (e) {}

                                  return (
                                    <span className="relative inline-block group mx-1 align-middle">
                                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium cursor-help border border-slate-700 transition-colors gap-1.5">
                                        {hostname ? (
                                          <img 
                                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`} 
                                            className="w-3 h-3 rounded-sm bg-white/10" 
                                            alt="" 
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                                          />
                                        ) : (
                                          <Globe className="w-3 h-3" />
                                        )}
                                        <span>{getDomainName(uniqueSources[0].uri)}</span>
                                        {uniqueSources.length > 1 && (
                                          <span className="text-slate-400">+{uniqueSources.length - 1}</span>
                                        )}
                                      </span>
                                      
                                      {/* Hover Tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 flex flex-col gap-1.5 pointer-events-none group-hover:pointer-events-auto">
                                        {uniqueSources.map((source, idx) => {
                                          let sourceHostname = '';
                                          try {
                                            sourceHostname = new URL(source.uri).hostname;
                                          } catch (e) {}
                                          
                                          return (
                                            <a 
                                              key={idx}
                                              href={source.uri}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2 text-xs text-slate-300 hover:text-blue-400 transition-colors p-1.5 rounded hover:bg-slate-700/50"
                                            >
                                              {sourceHostname ? (
                                                <img 
                                                  src={`https://www.google.com/s2/favicons?domain=${sourceHostname}&sz=16`} 
                                                  className="w-3 h-3 rounded-sm flex-shrink-0 bg-white/10" 
                                                  alt="" 
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                                                />
                                              ) : (
                                                <Globe className="w-3 h-3 flex-shrink-0" />
                                              )}
                                              <span className="truncate">{source.title}</span>
                                            </a>
                                          );
                                        })}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                      </div>
                                    </span>
                                  );
                                }
                                return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline" {...props}>{children}</a>;
                              }
                            }}
                          >
                            {msg.text}
                          </Markdown>
                    </div>
                  )}
                </div>
                
                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ delay: 0.2 }}
                    className="mt-2 max-w-[85%]"
                  >
                    <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Sources
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((source, idx) => (
                        <a 
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md text-[10px] text-blue-400 hover:text-blue-300 transition-colors truncate"
                          title={source.title}
                        >
                          <Globe className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{source.title}</span>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
            
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-start"
              >
                <div className="px-4 py-4 bg-slate-800 rounded-2xl rounded-bl-sm border border-slate-700/50 flex items-center gap-1.5 w-fit">
                  <motion.div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                  <motion.div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                  <motion.div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-800 bg-slate-900">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-1.5 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
