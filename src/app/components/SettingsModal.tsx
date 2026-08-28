import React, { useState } from 'react';
import { Monitor, Type, BookOpen, Settings as SettingsIcon, X, Image as ImageIcon } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'display', label: 'Display & Outputs', icon: <Monitor size={18} /> },
  { id: 'typography', label: 'Typography', icon: <Type size={18} /> },
  { id: 'bible', label: 'Bible Preferences', icon: <BookOpen size={18} /> },
  { id: 'background', label: 'Background', icon: <ImageIcon size={18} /> },
  { id: 'app', label: 'App Settings', icon: <SettingsIcon size={18} /> },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSection, resetSettings } = useSettings();
  const [activeCategory, setActiveCategory] = useState('display');
  const [confirmStep, setConfirmStep] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const handleSave = () => {
    onClose();
  };

  const performReset = async () => {
    const keys = [
      'oflow_serviceItems',
      'oflow_songs',
      'oflow_savedImages',
      'oflow_savedVideos',
      'oflow_savedBackgrounds',
      'oflow_backgroundImage',
      'oflow_clockSettings',
      'oflow_videoState',
      'oflow_activeCameraId',
      'openbeam_settings',
      'openflow_settings',
    ];
    setIsResetting(true);
    setWipeProgress(0);
    for (let i = 0; i < keys.length; i++) {
      if (window.electron) window.electron.storeDelete(keys[i]);
      else localStorage.removeItem(keys[i]);
      setWipeProgress(Math.round(((i + 1) / keys.length) * 100));
      await new Promise(r => setTimeout(r, 80));
    }
    resetSettings();
    await new Promise(r => setTimeout(r, 300));
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {isResetting && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black/85" data-modal="true">
          <div className="w-72">
            <p className="text-sm text-white/80 mb-3 text-center">Clearing all data…</p>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500/80 transition-all duration-150"
                style={{ width: `${wipeProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-white/40 mt-2 text-center font-mono">{wipeProgress}%</p>
            <p className="text-[10px] text-white/40 mt-1 text-center">Restarting…</p>
          </div>
        </div>
      )}
      <div className="flex w-full max-w-4xl h-[600px] bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Sidebar */}
        <div className="w-64 bg-[#14141d] border-r border-white/5 p-4 flex flex-col">
          <div className="flex items-center gap-2 px-2 py-4 mb-4 text-[#7c6af7] font-bold tracking-wide">
            <SettingsIcon size={20} />
            <span>Settings</span>
          </div>
          
          <div className="flex flex-col gap-1 flex-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-[#7c6af7]/20 text-[#9b8df9]'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="p-8 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold text-white/90 mb-8">
              {CATEGORIES.find(c => c.id === activeCategory)?.label}
            </h2>

            {/* Display & Outputs */}
            {activeCategory === 'display' && (
              <div className="space-y-6 max-w-lg">
                <SettingRow label="Aspect Ratio" description="The aspect ratio of the presentation output.">
                  <select 
                    className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-sm text-white/80 w-32 focus:outline-none focus:border-[#7c6af7]"
                    value={settings.display.aspectRatio}
                    onChange={(e) => updateSection('display', { aspectRatio: e.target.value as any })}
                  >
                    <option value="16:9">16:9</option>
                    <option value="16:10">16:10</option>
                    <option value="4:3">4:3</option>
                  </select>
                </SettingRow>
                <SettingRow label="Fullscreen Mode" description="Launch presentation on secondary displays in fullscreen.">
                  <Toggle 
                    checked={settings.display.fullscreen} 
                    onChange={(val) => updateSection('display', { fullscreen: val })} 
                  />
                </SettingRow>
              </div>
            )}

            {/* Typography */}
            {activeCategory === 'typography' && (
              <div className="space-y-6 max-w-lg">
                <SettingRow label="Font Family" description="Default font used for lyrics and scriptures.">
                  <select 
                    className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-sm text-white/80 w-48 focus:outline-none focus:border-[#7c6af7]"
                    value={settings.typography.fontFamily}
                    onChange={(e) => updateSection('typography', { fontFamily: e.target.value })}
                  >
                    <option value="Inter, system-ui, sans-serif">Inter (Modern Sans)</option>
                    <option value="Roboto, sans-serif">Roboto</option>
                    <option value="Georgia, serif">Georgia (Serif)</option>
                    <option value="'Courier New', monospace">Courier (Monospace)</option>
                  </select>
                </SettingRow>

                <SettingRow label="Font Style" description="Boldness and italics settings.">
                  <div className="flex gap-2">
                    <select 
                      className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-sm text-white/80 w-28 focus:outline-none focus:border-[#7c6af7]"
                      value={settings.typography.fontWeight}
                      onChange={(e) => updateSection('typography', { fontWeight: e.target.value })}
                    >
                      <option value="400">Regular</option>
                      <option value="500">Medium</option>
                      <option value="600">SemiBold</option>
                      <option value="700">Bold</option>
                      <option value="800">ExtraBold</option>
                      <option value="900">Black</option>
                    </select>

                    <button
                      onClick={() => updateSection('typography', { italic: !settings.typography.italic })}
                      className={`px-3 py-1.5 rounded border text-sm italic ${
                        settings.typography.italic
                          ? 'bg-[#7c6af7]/20 border-[#7c6af7] text-[#9b8df9]' 
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      Italic
                    </button>
                  </div>
                </SettingRow>
                
                <SettingRow label="Text Alignment" description="How the text is aligned on the screen.">
                  <div className="flex gap-2">
                    {['left', 'center', 'right', 'justify'].map(align => (
                      <button
                        key={align}
                        onClick={() => updateSection('typography', { textAlign: align as any })}
                        className={`px-3 py-1.5 rounded border text-sm capitalize ${
                          settings.typography.textAlign === align 
                            ? 'bg-[#7c6af7]/20 border-[#7c6af7] text-[#9b8df9]' 
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow label="Drop Shadow" description="Apply a subtle shadow behind text for readability over images/video.">
                  <Toggle 
                    checked={settings.typography.dropShadow} 
                    onChange={(val) => updateSection('typography', { dropShadow: val })} 
                  />
                </SettingRow>

                <SettingRow label="Text Stroke" description="Apply a solid dark outline around text.">
                  <Toggle 
                    checked={settings.typography.textStroke} 
                    onChange={(val) => updateSection('typography', { textStroke: val })} 
                  />
                </SettingRow>

                <SettingRow label="Line Height" description="Spacing between lines of text.">
                  <input 
                    type="range" min="1" max="2.5" step="0.1" 
                    value={settings.typography.lineHeight}
                    onChange={(e) => updateSection('typography', { lineHeight: parseFloat(e.target.value) })}
                    className="w-32 accent-[#7c6af7]"
                  />
                  <span className="text-xs text-white/50 ml-2 w-8">{settings.typography.lineHeight.toFixed(1)}</span>
                </SettingRow>

                <SettingRow label="Slide Transition" description="Fade animates between slides; None swaps instantly.">
                  <select 
                    className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-sm text-white/80 w-48 focus:outline-none focus:border-[#7c6af7]"
                    value={settings.typography.transition}
                    onChange={(e) => updateSection('typography', { transition: e.target.value as 'none' | 'fade' })}
                  >
                    <option value="fade">Fade (0.3s)</option>
                    <option value="none">None (instant)</option>
                  </select>
                </SettingRow>
              </div>
            )}

            {/* Bible Preferences */}
            {activeCategory === 'bible' && (
              <div className="space-y-6 max-w-lg">
                <SettingRow label="Default Translation" description="Translation automatically selected on startup.">
                  <select 
                    className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-sm text-white/80 w-48 focus:outline-none focus:border-[#7c6af7]"
                    value={settings.bible.defaultTranslation}
                    onChange={(e) => updateSection('bible', { defaultTranslation: e.target.value })}
                  >
                    <option value="nasb2020">NASB 2020</option>
                    <option value="tamil_bible">Tamil (O.V.)</option>
                    <option value="nasb">NASB (1995)</option>
                  </select>
                </SettingRow>

                <SettingRow label="Show Verse Headings" description="Display the book and chapter heading (e.g., 'Genesis 1').">
                  <Toggle 
                    checked={settings.bible.showHeadings} 
                    onChange={(val) => updateSection('bible', { showHeadings: val })} 
                  />
                </SettingRow>
              </div>
            )}

            {/* Background Settings */}
            {activeCategory === 'background' && (
              <div className="space-y-6 max-w-lg">
                <SettingRow label="Background Video Loop" description="How a looping background video plays when it reaches the end.">
                  <select 
                    className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-sm text-white/80 w-48 focus:outline-none focus:border-[#7c6af7]"
                    value={settings.background.loopMode}
                    onChange={(e) => updateSection('background', { loopMode: e.target.value as 'forward' | 'pingpong' })}
                  >
                    <option value="forward">Loop forward</option>
                    <option value="pingpong">Loop forward &amp; backward</option>
                  </select>
                </SettingRow>
              </div>
            )}

            {/* App Settings */}
            {activeCategory === 'app' && (
              <div className="space-y-6 max-w-lg">
                <SettingRow label="UI Theme" description="Visual style of the main control panel.">
                  <div className="flex gap-2">
                    {['dark', 'oled'].map(theme => (
                      <button
                        key={theme}
                        onClick={() => updateSection('app', { theme: theme as any })}
                        className={`px-3 py-1.5 rounded border text-sm capitalize ${
                          settings.app.theme === theme 
                            ? 'bg-[#7c6af7]/20 border-[#7c6af7] text-[#9b8df9]' 
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </SettingRow>
                
                <SettingRow label="Auto-Blank" description="Automatically blank the screen when clearing all content.">
                  <Toggle 
                    checked={settings.app.autoBlank} 
                    onChange={(val) => updateSection('app', { autoBlank: val })} 
                  />
                </SettingRow>
              </div>
            )}
            
          </div>

          {/* Bottom Action Bar */}
          <div className="border-t border-white/10 p-4 bg-[#14141d] flex items-center justify-between gap-3 shrink-0">
            {confirmStep === 0 ? (
              <button 
                onClick={() => setConfirmStep(1)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/40 hover:bg-red-500/15 hover:text-red-300 transition-colors"
              >
                Reset All Data
              </button>
            ) : (
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs text-red-400/90">
                  {confirmStep === 1
                    ? "Delete all imported songs, saved media, service order, and reset settings?"
                    : "This cannot be undone. Are you really sure?"}
                </span>
                <button 
                  onClick={() => confirmStep === 1 ? setConfirmStep(2) : performReset()}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  {confirmStep === 1 ? "Yes, Reset" : "Yes, Delete Everything"}
                </button>
                <button 
                  onClick={() => setConfirmStep(0)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                disabled={isResetting}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-8 py-2 rounded-lg text-sm font-medium bg-[#7c6af7] text-white hover:bg-[#6a58e0] shadow-lg shadow-[#7c6af7]/20 transition-all active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components

function SettingRow({ label, description, children }: { label: string, description: string, children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 pb-6">
      <div className="flex flex-col pr-8">
        <span className="text-sm font-semibold text-white/90 mb-1">{label}</span>
        <span className="text-xs text-white/40 leading-relaxed">{description}</span>
      </div>
      <div className="flex-shrink-0 flex items-center">
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-[#7c6af7]' : 'bg-white/10'
      }`}
    >
      <span 
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-1'
        }`}
        style={{ transform: `translateX(${checked ? '18px' : '4px'})` }}
      />
    </button>
  );
}
