"use client";

interface ModelResult {
  id: number;
  model_name: string;
  extracted_text: string;
  corrected_text?: string;
  raw_json?: unknown;
}

interface CompareModalProps {
  results: ModelResult[];
  primaryResultId: number | null;
  onSelectModel: (resultId: number) => void;
  onClose: () => void;
}

export default function CompareModal({
  results,
  primaryResultId,
  onSelectModel,
  onClose,
}: CompareModalProps) {
  // Word count for each model (used to show why one is "best")
  const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  const fusedId = results.find(r => r.model_name.includes("Fused Result"))?.id;
  const bestId = fusedId ?? results.reduce((best, cur) =>
    wordCount(cur.extracted_text) > wordCount(best.extracted_text) ? cur : best,
    results[0]
  )?.id;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">All Model Outputs</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Compare all OCR models and select the one you want to edit
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors text-xl font-medium"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Cards grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {results.map((result) => {
            const isActive = result.id === primaryResultId;
            const isBest = result.id === bestId;
            const isFused = result.model_name.includes("Fused Result");
            const wc = wordCount(result.extracted_text);

            return (
              <div
                key={result.id}
                className={`relative flex flex-col rounded-xl border-2 transition-all shadow-sm ${
                  isActive
                    ? "border-indigo-500 bg-indigo-50 shadow-indigo-100"
                    : isFused
                    ? "border-orange-200 bg-yellow-50 hover:border-orange-300"
                    : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                }`}
              >
                {/* Best badge */}
                {isBest && (
                  <div className={`absolute -top-3 left-4 text-[11px] font-bold px-3 py-0.5 rounded-full shadow ${isFused ? 'bg-amber-400 text-amber-900' : 'bg-amber-400 text-amber-900'}`}>
                    {isFused ? "★ Auto Selected / Recommended" : "★ Auto-Selected Best"}
                  </div>
                )}

                {/* Card header */}
                <div className={`px-4 pt-5 pb-3 border-b ${isActive ? 'border-indigo-200' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${isActive ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {result.model_name}
                    </span>
                    {isActive && (
                      <span className="text-[11px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{wc} words extracted</p>
                </div>

                {/* Text preview */}
                <div className="px-4 py-3 flex-1 overflow-hidden">
                  <p
                    className="text-sm text-gray-700 leading-relaxed"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 8,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {result.corrected_text || result.extracted_text}
                  </p>
                </div>

                {/* Action button */}
                <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                  {isActive ? (
                    <div className="w-full py-2 text-center text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg border border-indigo-200">
                      Currently Editing
                    </div>
                  ) : (
                    <button
                      onClick={() => { onSelectModel(result.id); onClose(); }}
                      className="w-full py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors active:scale-95 shadow-sm"
                    >
                      Use This Model
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 shrink-0">
          Tip: Fused Result is auto-selected based on majority voting. Click &quot;Use This Model&quot; to switch and reload the bounding boxes.
        </div>
      </div>
    </div>
  );
}
