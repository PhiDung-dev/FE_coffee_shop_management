import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, User, RotateCcw, Sparkles } from 'lucide-react';
import chatService from '../../service/chatService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'AI',
  text: 'Xin chào! Mình là trợ lý AI của CoffeeHouse. Bạn muốn tìm đồ uống theo khẩu vị, xem món nổi bật hay cần tư vấn chọn món?',
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
    <div className="fixed bottom-5 right-5 z-40">
      {isOpen && (
        <div className="mb-3 w-[340px] sm:w-[390px] h-[500px] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-stone-900 text-white px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight flex items-center gap-1.5">
                  <span>Trợ lý CoffeeHouse</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </h3>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Sẵn sàng tư vấn đồ uống
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="Cuộc trò chuyện mới"
                className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Thu gọn"
                className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Danh sách tin nhắn */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
            {messages.map((msg) => {
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                      isUser
                        ? 'bg-amber-700 text-white rounded-br-sm'
                        : 'bg-white text-stone-800 border border-stone-200 shadow-sm rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
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
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-stone-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Gợi ý nhanh */}
          {messages.length === 1 && !sending && (
            <div className="px-3 py-2 bg-stone-50 border-t border-stone-100 flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => sendChatText(item)}
                  className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {/* Ô nhập tin nhắn */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white border-t border-stone-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              disabled={sending}
              className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent disabled:bg-stone-100"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Gửi tin nhắn"
              className="p-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white transition-colors cursor-pointer"
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
        className="ml-auto flex items-center gap-2 px-4 py-3 rounded-full bg-amber-700 hover:bg-amber-800 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer"
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