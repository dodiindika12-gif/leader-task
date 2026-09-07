import { Send, Paperclip, Image as ImageIcon } from 'lucide-react';
import { useRef } from 'react';

export default function ChatInput({ input = '', handleInputChange, handleSubmit, isLoading }) {
  const formRef = useRef(null);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        formRef.current?.requestSubmit();
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className="relative flex items-end gap-2 bg-white rounded-2xl border shadow-sm p-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all"
      >
        <button type="button" className="p-3 text-gray-400 hover:text-blue-500 transition-colors rounded-xl hover:bg-blue-50 shrink-0">
          <Paperclip size={20} />
        </button>
        <button type="button" className="p-3 text-gray-400 hover:text-blue-500 transition-colors rounded-xl hover:bg-blue-50 shrink-0 hidden sm:block">
          <ImageIcon size={20} />
        </button>
        
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          placeholder="Message AI..."
          className="flex-1 max-h-48 min-h-[52px] py-3 px-2 resize-none bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
          rows={1}
        />
        
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 shrink-0 shadow-sm mb-[2px]"
        >
          <Send size={18} />
        </button>
      </form>
      <div className="text-center text-xs text-gray-400 mt-3">
        AI can make mistakes. Consider verifying important information.
      </div>
    </div>
  );
}
