import ReactMarkdown from 'react-markdown';
import { User, Bot } from 'lucide-react';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-4 max-w-4xl mx-auto w-full animate-in slide-in-from-bottom-2 duration-300 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isUser ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="text-xs text-gray-500 font-medium px-1">
          {isUser ? 'You' : 'AI Assistant'}
        </div>
        <div 
          className={`px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed break-words
            ${isUser 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
            }
          `}
        >
        <div className={`prose prose-sm max-w-none prose-p:my-0 prose-pre:my-0 prose-headings:my-1 prose-ul:my-0 prose-ol:my-0 ${isUser ? 'prose-invert' : ''}`}>
          <ReactMarkdown>
            {message.content}
          </ReactMarkdown>
        </div>
        </div>
      </div>
    </div>
  );
}
