import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, X, Send, Bot, User, RotateCcw, Sparkles, Coffee } from 'lucide-react';
import chatService from '../../service/chatService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'AI',
  text: 'Xin chào! Mình là trợ lý AI của **CoffeeHouse**. Bạn muốn tìm đồ uống theo khẩu vị, xem món nổi bật hay cần tư vấn chọn món?',
};

const QUICK_SUGGESTIONS = [
  'Gợi ý đồ uống bán chạy',
  'Món nào ít ngọt, thanh mát?',
  'Cà phê giúp tỉnh táo làm việc',
];

const ChatWidget = () => {
  const { user, token } = useAuth();
  const claims = token ? parseJwt(token) : null;
  const accountId = claims?.accountId ?? claims?.id ?? user?.accountId ?? null;
  const storageSessionKey = accountId ? `cf_chat_session_${accountId}` : 'cf_chat_session_token';

  const [isOpen, setIsOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState(
    () => localStorage.getItem(storageSessionKey) || null
  );
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    setSessionToken(localStorage.getItem(storageSessionKey) || null);
    setMessages([WELCOME_MESSAGE]);
  }, [storageSessionKey]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendChatText = useCallback(
    async (rawText) => {
      const trimmed = rawText.trim();
      if (!trimmed || sending || !accountId) return;

      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'USER',
          text: trimmed,
        },
      ]);
      setInput('');
      setSending(true);

      try {
        const response = await chatService.sendMessage({
          sessionToken,
          accountId,
          message: trimmed,
        });

        const chatResult = response?.result;
        if (chatResult?.sessionToken) {
          setSessionToken(chatResult.sessionToken);
          localStorage.setItem(storageSessionKey, chatResult.sessionToken);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'AI',
            text: chatResult?.reply || 'Xin lỗi, hiện tại mình chưa có câu trả lời phù hợp.',
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'AI',
            text: err?.message || 'Hệ thống AI đang bận, bạn vui lòng thử lại sau nhé.',
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [accountId, sending, sessionToken, storageSessionKey]
  );

  useEffect(() => {
    const handleOpenChatEvent = (event) => {
      setIsOpen(true);
      const presetMessage = event.detail?.message;
      if (presetMessage) {
        sendChatText(presetMessage);
      }
    };

    window.addEventListener('open-coffee-chat', handleOpenChatEvent);
    return () => window.removeEventListener('open-coffee-chat', handleOpenChatEvent);
  }, [sendChatText]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendChatText(input);
  };

  const handleResetChat = () => {
    localStorage.removeItem(storageSessionKey);
    setSessionToken(null);
    setMessages([WELCOME_MESSAGE]);
  };

  if (!accountId) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {isOpen && (
        <div className="mb-3.5 w-[350px] sm:w-[400px] h-[540px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(28,25,23,0.18)] border border-stone-200/80 flex flex-col overflow-hidden transition-all duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white px-4 py-3.5 flex items-center justify-between border-b border-amber-900/30">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0 shadow-md shadow-amber-950/40">
                <Coffee className="w-5 h-5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-stone-900" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-1.5 text-amber-50">
                  <span>Trợ lý CoffeeHouse</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </h3>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  Tư vấn thực đơn & khẩu vị cá nhân
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="Cuộc trò chuyện mới"
                className="p-2 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Thu gọn"
                className="p-2 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Danh sách tin nhắn */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-gradient-to-b from-stone-50 to-amber-50/20">
            {messages.map((msg) => {
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 border border-amber-300/60 flex items-center justify-center shrink-0 shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed ${
                      isUser
                        ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white rounded-br-sm shadow-sm whitespace-pre-line'
                        : 'bg-white text-stone-800 border border-stone-200/90 shadow-xs rounded-bl-sm'
                    }`}
                  >
                    {isUser ? (
                      msg.text
                    ) : (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => (
                            <strong className="font-semibold text-amber-900">{children}</strong>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-4 space-y-1.5 my-1.5">{children}</ol>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-4 space-y-1.5 my-1.5">{children}</ul>
                          ),
                          li: ({ children }) => <li className="pl-0.5">{children}</li>,
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="flex items-end gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 border border-amber-300/60 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-stone-200/90 shadow-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Gợi ý nhanh */}
          {messages.length === 1 && !sending && (
            <div className="px-3.5 py-2.5 bg-white/80 backdrop-blur-xs border-t border-stone-100 flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => sendChatText(item)}
                  className="text-xs px-3 py-1.5 rounded-full bg-amber-50/90 text-amber-900 border border-amber-200/80 hover:bg-amber-100 hover:border-amber-300 transition-all cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {/* Ô nhập tin nhắn */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white border-t border-stone-200/80 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi về thực đơn, vị ngọt, caffeine..."
              disabled={sending}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/80 focus:border-transparent disabled:bg-stone-100 transition-all"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Gửi tin nhắn"
              className="p-2.5 rounded-xl bg-gradient-to-br from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 disabled:from-stone-300 disabled:to-stone-300 text-white shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Nút mở Chat */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="ml-auto flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white shadow-lg shadow-amber-950/25 hover:shadow-xl transition-all duration-200 cursor-pointer"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <>
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-semibold hidden sm:inline">Tư vấn AI</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;  