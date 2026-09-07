import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, settings, onSave }) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
          <h3 className="font-semibold text-lg text-gray-800">Model Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input 
              type="password" 
              value={localSettings.apiKey}
              onChange={e => setLocalSettings({...localSettings, apiKey: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-gray-800"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
            <input 
              type="text" 
              value={localSettings.endpointUrl}
              onChange={e => setLocalSettings({...localSettings, endpointUrl: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-gray-800"
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
            <input 
              type="text" 
              value={localSettings.modelName}
              onChange={e => setLocalSettings({...localSettings, modelName: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow text-gray-800"
              placeholder="e.g. google/gemini-pro"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt (Skill)</label>
            <textarea 
              value={localSettings.systemPrompt}
              onChange={e => setLocalSettings({...localSettings, systemPrompt: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow min-h-24 resize-y text-gray-800"
              placeholder="You are a helpful assistant..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium">Cancel</button>
          <button 
            onClick={() => { onSave(localSettings); onClose(); }} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm font-medium"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
