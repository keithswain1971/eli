'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '@/components/eli/ChatMessage';

import { LeadForm } from '@/components/eli/LeadForm';
import { AdvisorHandover } from '@/components/eli/AdvisorHandover';

type Surface = 'website' | 'dashboard';

interface EliWidgetProps {
    surface?: Surface;
    defaultOpen?: boolean;
    context?: string; // e.g. 'employers', 'learners', 'programs'
}

// Proactive messages based on User Context
const tooltips: Record<string, string> = {
    'employers': "Looking to hire an apprentice? I can help!",
    'learners': "Start your career with an apprenticeship. Ask me how!",
    'programs': "Not sure which program is right for you?",
    'contact': "Have a specific question? Ask me directly."
};

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function EliWidget({ surface = 'website', defaultOpen = false, context }: EliWidgetProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');

    // Commercial Feature States
    const [showLeadForm, setShowLeadForm] = useState(false);
    const [showHandover, setShowHandover] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Handle Lead Form Submission
    const handleLeadSubmit = async (data: { name: string; email: string; phone: string }) => {
        try {
            await fetch('/api/eli/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    intent: 'chat_capture',
                    source_url: window.location.href,
                    chat_session_id: sessionId || 'temp_session_id'
                })
            });
            setShowLeadForm(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: "Thanks! I've sent that over. Is there anything else I can help with?"
            }]);
        } catch (e) {
            console.error('Lead submission error:', e);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
        };

        setMessages([...messages, userMessage]);
        setInput('');
        setIsLoading(true);

        // Hide overlays if they chat again
        setShowLeadForm(false);
        setShowHandover(false);

        try {
            const response = await fetch('/api/eli/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
                    surface,
                    pageContext: {
                        url: window.location.href,
                        title: document.title
                    },
                    sessionId
                }),
            });

            if (!response.ok) throw new Error('Failed to get response');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    assistantMessage += chunk;

                    // Check for Lead Capture Token
                    if (assistantMessage.includes('[LEAD_CAPTURE]')) {
                        if (!showLeadForm) {
                            setShowLeadForm(true);
                            setShowHandover(false);
                        }
                        assistantMessage = assistantMessage.replace('[LEAD_CAPTURE]', '');
                    }

                    // Check for Human Handoff Token
                    if (assistantMessage.includes('[HUMAN_HANDOFF]')) {
                        if (!showHandover) {
                            setShowHandover(true);
                            setShowLeadForm(false);
                        }
                        assistantMessage = assistantMessage.replace('[HUMAN_HANDOFF]', '');
                    }

                    // Update the assistant message as it streams
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.content = assistantMessage;
                        } else {
                            newMessages.push({
                                id: (Date.now() + 1).toString(),
                                role: 'assistant',
                                content: assistantMessage,
                            });
                        }
                        return newMessages;
                    });
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Session Management Effect
    useEffect(() => {
        const initSession = async () => {
            let storedSessionId = localStorage.getItem('eli_session_id');

            if (!storedSessionId) {
                storedSessionId = crypto.randomUUID();
                localStorage.setItem('eli_session_id', storedSessionId);
            }

            setSessionId(storedSessionId);

            // Fetch History
            try {
                const res = await fetch(`/api/eli/history?sessionId=${storedSessionId}`);
                if (res.ok) {
                    const history = await res.json();
                    if (history.length > 0) {
                        setMessages(history);
                    }
                }
            } catch (err) {
                console.error('Failed to load history:', err);
            }
        };

        initSession();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, showLeadForm, showHandover]);

    return (
        <div className={cn(
            "fixed flex flex-col items-end space-y-4 font-sans antialiased text-slate-800 z-50",
            defaultOpen ? "bottom-0 right-0 p-0" : "bottom-6 right-6"
        )}>

            {/* Chat Window */}
            {isOpen && (
                <div className="w-[380px] h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">

                    {/* Header */}
                    <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
                                <span className="font-bold text-xs">ELI</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Eli Assistant</h3>
                                <p className="text-[10px] text-slate-300 opacity-80">Always here to help</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-slate-800 rounded-full transition-colors opacity-70 hover:opacity-100"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 font-sans">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-6 opacity-60">
                                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-2">
                                    <MessageCircle size={24} className="text-slate-400" />
                                </div>
                                <p className="text-sm text-slate-500">
                                    Hi! I'm Eli. Ask me anything about policies, procedures, or the platform.
                                </p>
                            </div>
                        )}

                        {messages.map((m) => (
                            <ChatMessage key={m.id} role={m.role} content={m.content} />
                        ))}

                        {/* Loading State */}
                        {isLoading && (
                            <div className="flex justify-start w-full">
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center space-x-2">
                                    <Loader2 size={14} className="animate-spin text-slate-400" />
                                    <span className="text-xs text-slate-400">Thinking...</span>
                                </div>
                            </div>
                        )}

                        {/* Human Handoff Overlay */}
                        {showHandover && (
                            <AdvisorHandover
                                onRequestCallback={() => {
                                    setShowHandover(false);
                                    setShowLeadForm(true); // Re-use lead form for callback
                                }}
                            />
                        )}

                        {/* Lead Form Overlay */}
                        {showLeadForm && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <LeadForm
                                    onSubmit={handleLeadSubmit}
                                    onCancel={() => setShowLeadForm(false)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-100 shrink-0">
                        <div className="relative flex items-center">
                            <input
                                className="w-full font-sans bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type a message..."
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input?.trim()}
                                className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                        <div className="text-[10px] text-center text-slate-300 mt-2">
                            Values generated by AI may be inaccurate.
                        </div>
                    </form>

                </div>
            )}

            {/* Launcher */}
            {!isOpen && (
                <div className="relative group">
                    {/* Contextual Tooltip */}
                    {context && tooltips[context] && (
                        <div className="absolute bottom-full right-0 mb-3 w-48 bg-white p-3 rounded-xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="text-xs font-medium text-slate-800 relative z-10">
                                {tooltips[context]}
                            </div>
                            {/* Tiny pointer triangle */}
                            <div className="absolute -bottom-1 right-6 w-3 h-3 bg-white transform rotate-45 border-b border-r border-slate-100"></div>
                        </div>
                    )}

                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all transform hover:scale-105 animate-pulse-subtle"
                    >
                        <MessageCircle size={28} />
                    </button>

                    {/* Ripple Effect Ring */}
                    <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20 animate-ping top-0 right-0 -z-10 disabled:hidden"></span>
                </div>
            )}

        </div>
    );
}
