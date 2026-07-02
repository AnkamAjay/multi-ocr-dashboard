import React, { useEffect } from "react";

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>❓</span> Help & User Guide
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 hover:bg-gray-200 p-2 rounded-full transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 text-gray-700">
          
          {/* Getting Started */}
          <section>
            <h3 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
              <span>🚀</span> Getting Started
            </h3>
            <div className="bg-indigo-50 p-4 rounded-lg text-sm border border-indigo-100">
              <ol className="list-decimal list-inside space-y-1.5 font-medium text-indigo-900">
                <li>Login / Register</li>
                <li>Upload Document</li>
                <li>Select Language & Modality</li>
                <li>Generate OCR Outputs</li>
                <li>Review Fused Result</li>
                <li>Annotate & Save Corrections</li>
                <li>View Statistics</li>
              </ol>
            </div>
          </section>

          {/* Supported File Types */}
          <section>
            <h3 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
              <span>📁</span> Supported Files
            </h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {['JPG', 'JPEG', 'PNG', 'PDF', 'ZIP'].map(ext => (
                <span key={ext} className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-bold text-gray-600">{ext}</span>
              ))}
            </div>
            <ul className="list-disc list-inside text-sm space-y-1 ml-1 text-gray-600">
              <li>PDF pages are processed automatically.</li>
              <li>ZIP files are extracted and processed automatically.</li>
            </ul>
          </section>

          {/* OCR Processing */}
          <section>
            <h3 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
              <span>⚙️</span> OCR Processing
            </h3>
            <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
              <li>Generates multiple OCR outputs.</li>
              <li><strong>Fused Result</strong> is the recommended output.</li>
              <li>You can compare OCR outputs before editing.</li>
            </ul>
          </section>

          {/* Annotation Tools */}
          <section>
            <h3 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
              <span>✏️</span> Annotation Tools
            </h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-start gap-2"><span className="text-indigo-600 font-bold w-16">Select</span> <span className="text-gray-600">Click to select and edit regions.</span></div>
              <div className="flex items-start gap-2"><span className="text-indigo-600 font-bold w-16">Draw</span> <span className="text-gray-600">Click and drag to create new regions.</span></div>
              <div className="flex items-start gap-2"><span className="text-indigo-600 font-bold w-16">Delete</span> <span className="text-gray-600">Remove selected regions.</span></div>
              <div className="flex items-start gap-2"><span className="text-indigo-600 font-bold w-16">Merge</span> <span className="text-gray-600">Combine multiple selected regions.</span></div>
              <div className="flex items-start gap-2"><span className="text-indigo-600 font-bold w-16">Undo</span> <span className="text-gray-600">Revert your last action.</span></div>
            </div>
          </section>

          {/* Text Editing */}
          <section>
            <h3 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
              <span>📝</span> Text Editing
            </h3>
            <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
              <li>OCR text can be edited and corrected.</li>
              <li>Corrections can be saved.</li>
              <li>Multilingual editing is supported.</li>
            </ul>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
              <span>⌨️</span> Keyboard Shortcuts
            </h3>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-bold">
                  <tr>
                    <th className="px-4 py-2 border-b">Shortcut</th>
                    <th className="px-4 py-2 border-b">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2"><kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">V</kbd></td>
                    <td className="px-4 py-2 text-gray-600">Select Tool</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2"><kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">D</kbd></td>
                    <td className="px-4 py-2 text-gray-600">Draw Tool</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2"><kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">M</kbd></td>
                    <td className="px-4 py-2 text-gray-600">Merge Tool</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2"><kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Delete</kbd></td>
                    <td className="px-4 py-2 text-gray-600">Delete Box</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2"><kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Ctrl+Z</kbd></td>
                    <td className="px-4 py-2 text-gray-600">Undo</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2"><kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Ctrl+S</kbd></td>
                    <td className="px-4 py-2 text-gray-600">Save Corrections</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Statistics Dashboard */}
          <section>
            <h3 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
              <span>📊</span> Statistics Dashboard
            </h3>
            <p className="text-sm text-gray-600 mb-2">Tracks your annotation progress, including:</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <ul className="list-disc list-inside space-y-1">
                <li>Pages Corrected</li>
                <li>Boxes Created</li>
                <li>Boxes Deleted</li>
                <li>Boxes Edited</li>
              </ul>
              <ul className="list-disc list-inside space-y-1">
                <li>Text Edits</li>
                <li>Total Corrections</li>
                <li>Time Spent</li>
                <li>Annotation Logs</li>
              </ul>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h3 className="text-lg font-bold text-indigo-700 mb-3 flex items-center gap-2">
              <span>💡</span> FAQ
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-gray-800">What is Fusion Result?</p>
                <p className="text-sm text-gray-600 mt-0.5">An intelligent combination of multiple OCR models for the highest accuracy.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Can I upload PDFs and ZIP files?</p>
                <p className="text-sm text-gray-600 mt-0.5">Yes, both formats are fully supported and automatically processed.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Can I edit text in Indian languages?</p>
                <p className="text-sm text-gray-600 mt-0.5">Yes, multilingual text editing is fully supported.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Where can I see my statistics?</p>
                <p className="text-sm text-gray-600 mt-0.5">Click the &quot;My Statistics&quot; button in the top navigation bar.</p>
              </div>
            </div>
          </section>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow transition-colors"
          >
            Got it, let&apos;s start!
          </button>
        </div>
      </div>
    </>
  );
};

export default HelpPanel;
