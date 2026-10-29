import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  User, 
  HelpCircle, 
  MessageSquare, 
  CheckCircle, 
  RefreshCw, 
  Building2,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Search,
  ExternalLink,
  Volume2,
  VolumeX
} from 'lucide-react';
import { SupportedLanguage, RagSearchResult } from '../types';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  time: string;
  retrievedChunks?: RagSearchResult[];
  modelUsed?: string;
}

interface YojanaMitraChatbotProps {
  currentLanguage: SupportedLanguage;
  onExploreScheme?: (schemeId: string) => void;
}

export const YojanaMitraChatbot: React.FC<YojanaMitraChatbotProps> = ({
  currentLanguage,
  onExploreScheme,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: `राम-राम सा! मैं **'योजना मित्र'** (Yojana Mitra) हूँ — इंदौर जिले के नागरिकों का आधिकारिक Hybrid RAG AI योजना सहायक।\n\nमेरी ज्ञान-प्रणाली इंदौर कलेक्ट्रेट, नगर निगम (वार्ड 1-85) और चारों ग्रामीण जनपदों (इंदौर, महू, सांवेर, देपालपुर) के 47+ प्रामाणिक शासकीय नियमों और SQLite डेटाबेस से सीधे जुड़ी है।\n\nआप किसी भी योजना, पात्रता, आवश्यक दस्तावेज या प्रक्रिया के बारे में हिन्दी, माळवी या English में पूछ सकते हैं।`,
      time: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedChunkMsgIdx, setExpandedChunkMsgIdx] = useState<number | null>(null);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSpeak = (text: string, msgIndex: number) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMsgIdx === msgIndex) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIdx(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown characters for spoken reading
    const cleanSpeech = text
      .replace(/[*#_`]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/https?:\/\/\S+/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95;

    utterance.onend = () => {
      setSpeakingMsgIdx(null);
    };

    utterance.onerror = () => {
      setSpeakingMsgIdx(null);
    };

    setSpeakingMsgIdx(msgIndex);
    window.speechSynthesis.speak(utterance);
  };

  const quickPrompts = [
    { label: 'लाड़ली बहना के नियम', text: 'लाड़ली बहना योजना के लिए पात्रता, उम्र और आवश्यक दस्तावेज क्या हैं?' },
    { label: 'देपालपुर व सांवेर किसान योजनाएं', text: 'देपालपुर और सांवेर के किसानों के लिए पीएम-किसान और मालवी गोवंश योजना की जानकारी दीजिए।' },
    { label: 'रेहड़ी / ठेला स्वनिधि लोन', text: 'इंदौर नगर निगम में ठेला लगाने वालों को पीएम स्वनिधि में लोन कैसे मिलता है?' },
    { label: 'आयुष्मान ₹5 लाख मुफ्त इलाज', text: 'आयुष्मान भारत कार्ड से इंदौर के किन अस्पतालों में 5 लाख तक मुफ्त इलाज मिलता है?' },
    { label: 'रेड क्रॉस आरोग्य निधि (कलेक्ट्रेट)', text: 'कलेक्टर साहब की रेड क्रॉस आरोग्य निधि से गंभीर बीमारी में सहायता कैसे मिलती है?' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-6).map(m => ({ sender: m.sender, text: m.text })),
        }),
      });

      if (!response.ok) throw new Error('Network error');
      const data = await response.json();

      const botMsg: Message = {
        sender: 'bot',
        text: data.reply || 'माफ़ कीजिए, उत्तर प्राप्त नहीं हुआ। कृपया पुनः प्रयास करें।',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        retrievedChunks: data.retrievedChunks,
        modelUsed: data.modelUsed,
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: Message = {
        sender: 'bot',
        text: `**योजना मित्र:** वर्तमान में मुख्य AI सेवा व्यस्त है। आप नीचे दिए गए त्वरित विकल्पों पर क्लिक करके भी योजना पात्रता जान सकते हैं।`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[750px]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white border border-white/20">
              <Bot className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-lg font-heading">Yojana Mitra (योजना मित्र)</h3>
                <span className="bg-emerald-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>
                  RAG Grounded
                </span>
              </div>
              <p className="text-xs text-amber-100">
                Hybrid RAG Civic AI Counselor • 6 Governance Tiers • SQLite Database Grounded
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setMessages([
                {
                  sender: 'bot',
                  text: 'नमस्ते! नया संवाद आरंभ किया गया। आप क्या जानना चाहते हैं?',
                  time: 'Just now',
                },
              ]);
            }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition text-xs flex items-center space-x-1"
            title="Reset Chat"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {messages.map((msg, index) => {
            const isBot = msg.sender === 'bot';
            const hasCitations = msg.retrievedChunks && msg.retrievedChunks.length > 0;
            const isCitationsExpanded = expandedChunkMsgIdx === index;

            return (
              <div
                key={index}
                className={`flex items-start space-x-3 ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                {isBot && (
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs sm:text-sm shadow-xs ${
                    isBot
                      ? 'bg-white text-slate-800 border border-slate-200 leading-relaxed'
                      : 'bg-amber-600 text-white font-medium ml-auto'
                  }`}
                >
                  <div className="whitespace-pre-line prose-xs">
                    {msg.text}
                  </div>

                  {/* RAG Retrieved Citations Panel */}
                  {isBot && hasCitations && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => setExpandedChunkMsgIdx(isCitationsExpanded ? null : index)}
                        className="w-full flex items-center justify-between p-2 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/60 text-[11px] font-bold text-amber-900 transition"
                      >
                        <div className="flex items-center space-x-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Verified Civic Citations ({msg.retrievedChunks!.length} Sources Grounded)
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded-full font-mono">
                            {msg.retrievedChunks![0]?.confidencePercent}% Match
                          </span>
                          {isCitationsExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-amber-800" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-amber-800" />
                          )}
                        </div>
                      </button>

                      {isCitationsExpanded && (
                        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
                          {msg.retrievedChunks!.map((item, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 truncate max-w-[200px]">
                                  {item.chunk.schemeTitle}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-100 text-emerald-800 font-bold">
                                  {item.confidencePercent}% Match
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                Level: <strong className="text-slate-700">{item.sourceLevel}</strong> • {item.chunk.chunkType}
                              </div>
                              <p className="text-slate-600 whitespace-pre-line bg-white p-2 rounded-lg border border-slate-100 font-mono text-[10px]">
                                {item.chunk.content.slice(0, 180)}...
                              </p>
                              {item.matchedTerms?.length > 0 && (
                                <div className="text-[9px] text-amber-800">
                                  Matched Terms: {item.matchedTerms.slice(0, 5).join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`text-[10px] mt-2 font-mono flex items-center justify-between ${
                      isBot ? 'text-slate-400' : 'text-amber-200 text-right'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{msg.time}</span>
                      {isBot && (
                        <button
                          onClick={() => handleSpeak(msg.text, index)}
                          title={speakingMsgIdx === index ? 'Stop audio' : 'Listen in Hindi/Malwi audio'}
                          className="p-1 hover:bg-slate-100 rounded-md text-amber-700 hover:text-amber-900 transition flex items-center space-x-1"
                        >
                          {speakingMsgIdx === index ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                              <span className="text-[9px] text-rose-600 font-bold">Stop Audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span className="text-[9px]">Listen Audio</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {isBot && msg.modelUsed && (
                      <span className="text-[9px] text-slate-400">
                        {msg.modelUsed}
                      </span>
                    )}
                  </div>
                </div>

                {!isBot && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center space-x-2 text-xs text-slate-500">
                <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                <span>योजना मित्र: 47+ योजनाओं व इंदौर प्रशासनिक नियमों में खोज जारी है (RAG Ranking)...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Chips Row */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 shrink-0">Ask:</span>
          {quickPrompts.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip.text)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 transition border border-slate-200 shrink-0 whitespace-nowrap"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="योजना संबंधी प्रश्न पूछें (उदा: लाड़ली बहना, आवास, किसान, ऋण, मालवी गाय)..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-900"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
