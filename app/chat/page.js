'use client';
import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Menu, Bot } from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [chatInput, setChatInput] = useState('');
  
  const chatState = useChat({
    api: '/api/chat',
    initialMessages: []
  });

  const { messages, isLoading, setMessages } = chatState;

  const handleInputChange = (e) => {
    setChatInput(e.target.value);
  };

  const handleFormSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!chatInput.trim() || isLoading) return;

    const message = { role: 'user', content: chatInput };
    
    if (typeof chatState.append === 'function') {
      chatState.append(message);
    } else if (typeof chatState.sendMessage === 'function') {
      chatState.sendMessage(message);
    } else if (typeof chatState.appendMessage === 'function') {
      chatState.appendMessage(message);
    } else if (typeof chatState.setMessages === 'function') {
      chatState.setMessages([...messages, { id: Date.now().toString(), ...message }]);
      if (typeof chatState.reload === 'function') chatState.reload();
      if (typeof chatState.regenerate === 'function') chatState.regenerate();
    }
    
    setChatInput('');
  };

  // Automatically scroll to bottom of chat
  useEffect(() => {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [messages]);

  const visibleMessages = messages.filter(m => m.role !== 'system');

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-gray-800 font-sans">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden bg-white shadow-[1px_0_15px_rgba(0,0,0,0.03)] z-20 flex flex-col`}>
        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
          <h2 className="font-semibold text-lg flex items-center gap-2 text-gray-700">
            <MessageSquare size={20} className="text-blue-500" /> AI Chat
          </h2>
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
           {/* Chat history list would go here */}
           <button onClick={() => setMessages([])} className="w-full flex items-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium">
              <Plus size={18}/> New Chat
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-white/70 backdrop-blur-xl border-b z-10 absolute top-0 w-full shadow-sm">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-4">
             <div className="text-sm text-gray-500 font-medium px-3 py-1 bg-gray-100 rounded-full border">
                Model: <span className="text-gray-700">Hermes 3</span>
             </div>
          </div>
        </header>

        {/* Chat Area */}
        <div id="chat-container" className="flex-1 overflow-y-auto pt-20 p-4 md:p-8 space-y-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/40 via-[#F9FAFB] to-[#F9FAFB]">
           {visibleMessages.map(m => (
             <ChatMessage key={m.id} message={m} />
           ))}
           {visibleMessages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-4 animate-in fade-in duration-500">
               <div className="p-6 bg-white rounded-3xl shadow-sm border border-gray-100/50">
                 <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-lg shadow-blue-500/20 text-white mb-4">
                    <MessageSquare size={36} />
                 </div>
                 <h2 className="text-2xl font-medium text-gray-700">How can I help you today?</h2>
                 <p className="mt-2 text-sm max-w-sm text-gray-500">I am powered by Hermes 3. Send a message to start our conversation!</p>
               </div>
             </div>
           )}
           {chatState.error && (
             <div className="flex justify-center my-4 animate-in fade-in zoom-in duration-300">
               <div className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 shadow-sm font-medium">
                 {chatState.error.message || 'An error occurred. Please check your API settings.'}
               </div>
             </div>
           )}
           {isLoading && (
              <div className="flex gap-4 max-w-4xl mx-auto w-full">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                  <Bot size={16} />
                </div>
                <div className="px-5 py-3.5 rounded-2xl shadow-sm bg-white text-gray-800 border border-gray-100 rounded-tl-none flex items-center gap-2">
                   <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                   <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                </div>
              </div>
           )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/70 backdrop-blur-xl border-t pb-8">
          <ChatInput input={chatInput} handleInputChange={handleInputChange} handleSubmit={handleFormSubmit} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
