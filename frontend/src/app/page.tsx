"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  uploadDocument,
  processDocument,
  createDocumentStream,
  saveAnnotation,
  saveBboxCorrections,
  getResults,
  saveStatistics,
  AnnotationLogCreate,
  getBaseUrl
} from "../services/api";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import BboxCanvas, { BBox, BBoxStatus } from "../components/BboxCanvas";
import BboxToolbar from "../components/BboxToolbar";
import CompareModal from "../components/CompareModal";
import HelpPanel from "../components/HelpPanel";
import InteractiveTextViewer from "../components/InteractiveTextViewer";
import { ReactTransliterate } from "react-transliterate";
import "react-transliterate/dist/index.css";

const getTransliterateLang = (lang: string) => {
  if (lang === "hindi") return "hi";
  if (lang === "telugu") return "te";
  return "en";
};

export default function Home() {
  const { user, logout, loading: authLoading } = useAuth();
  const [hasRestored, setHasRestored] = useState(false);
  // Unconditionally true on initial render to guarantee server/client match (no hydration error).
  // The restore effect will quickly set this to false if no saved session exists.
  const [isRestoring, setIsRestoring] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  // ── Batch state ──
  const [batchDocIds, setBatchDocIds] = useState<number[]>([]);
  const [batchFilePaths, setBatchFilePaths] = useState<string[]>([]);
  const [batchFilenames, setBatchFilenames] = useState<string[]>([]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [isBatch, setIsBatch] = useState(false);
  const [sourceFileType, setSourceFileType] = useState<string>("IMAGE");
  const [totalPages, setTotalPages] = useState<number>(1);
  const [batchProgress, setBatchProgress] = useState<{ done: number, total: number } | null>(null);

  const activeDocId = batchDocIds[activeDocIndex] ?? null;
  const baseUrl = getBaseUrl();
  const previewUrl = batchFilePaths[activeDocIndex] ? `${baseUrl}${batchFilePaths[activeDocIndex]}?v=${activeDocId}` : null;

  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<Record<number, any[]>>({});
  const ocrResults: any[] = activeDocId ? (batchResults[activeDocId] ?? []) : [];

  // ── Best Model & Edit State ──
  const [primaryResultId, setPrimaryResultId] = useState<number | null>(null);
  const [manualSelectedId, setManualSelectedIdState] = useState<number | null>(null);
  const manualSelectedIdRef = useRef<number | null>(null);
  const setManualSelectedId = (id: number | null) => {
    manualSelectedIdRef.current = id;
    setManualSelectedIdState(id);
  };
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [cachedCorrectionsForDoc, setCachedCorrectionsForDoc] = useState<BBox[] | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imgDimensions, setImgDimensions] = useState<{ w: number, h: number } | null>(null);

  // ── BBox Canvas State ──
  const [bboxList, setBboxList] = useState<BBox[]>([]);
  const [selectedBboxIds, setSelectedBboxIds] = useState<string[]>([]);
  const [toolMode, setToolMode] = useState<"select" | "draw">("select");
  const [bboxHistory, setBboxHistory] = useState<BBox[][]>([]);
  const [miniEditorText, setMiniEditorText] = useState("");

  // ── Statistics Tracking State ──
  const [initialBboxList, setInitialBboxList] = useState<BBox[]>([]);
  const [editStartTime, setEditStartTime] = useState<number | null>(null);

  // Helper: format bbox coords as a compact string
  const fmtCoords = (b: BBox) =>
    `x:${Math.round(b.x)}, y:${Math.round(b.y)}, w:${Math.round(b.w)}, h:${Math.round(b.h)}`;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.25));
  const handleZoomReset = () => setZoomLevel(1);

  const [language, setLanguage] = useState("hindi");
  const [modality, setModality] = useState("printed");

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleReset = () => {
    setFile(null);
    setBatchDocIds([]);
    setBatchFilePaths([]);
    setBatchFilenames([]);
    setActiveDocIndex(0);
    setIsBatch(false);
    setBatchProgress(null);
    setBatchResults({});
    setEditingId(null);
    setPrimaryResultId(null);
    setManualSelectedId(null);
    setCachedCorrectionsForDoc(null);
    setEditedText("");
    setZoomLevel(1);
    setImgDimensions(null);
    setBboxList([]);
    setSelectedBboxIds([]);
    setBboxHistory([]);
    setMiniEditorText("");
    setInitialBboxList([]);
    setEditStartTime(null);
    setSourceFileType("IMAGE");
    setTotalPages(1);
  };

  // Sync state to localStorage — only after initial restoration has completed
  // so we never wipe saved session data during the first render before restoreSession runs.
  useEffect(() => {
    if (!hasRestored) return;
    if (batchDocIds.length > 0) {
      localStorage.setItem('batchDocIds', JSON.stringify(batchDocIds));
      localStorage.setItem('batchFilePaths', JSON.stringify(batchFilePaths));
      localStorage.setItem('batchFilenames', JSON.stringify(batchFilenames));
      localStorage.setItem('activeDocIndex', activeDocIndex.toString());
      localStorage.setItem('isBatch', isBatch.toString());
      localStorage.setItem('sourceFileType', sourceFileType);
      localStorage.setItem('totalPages', totalPages.toString());
      localStorage.setItem('language', language);
      localStorage.setItem('modality', modality);
      if (file) {
        localStorage.setItem('file_name', file.name);
        localStorage.setItem('file_type', file.type);
      }
    } else {
      localStorage.removeItem('batchDocIds');
      localStorage.removeItem('batchFilePaths');
      localStorage.removeItem('batchFilenames');
      localStorage.removeItem('activeDocIndex');
      localStorage.removeItem('isBatch');
      localStorage.removeItem('sourceFileType');
      localStorage.removeItem('totalPages');
      localStorage.removeItem('language');
      localStorage.removeItem('modality');
      localStorage.removeItem('file_name');
      localStorage.removeItem('file_type');
    }
  }, [hasRestored, batchDocIds, batchFilePaths, batchFilenames, activeDocIndex, isBatch, file, sourceFileType, totalPages, language, modality]);

  // Restore state from localStorage on mount
  useEffect(() => {
    if (authLoading || hasRestored) return;
    setHasRestored(true);

    const savedBatchDocIds = localStorage.getItem('batchDocIds');
    if (savedBatchDocIds) {
      try {
        const docIds = JSON.parse(savedBatchDocIds);
        if (docIds && docIds.length > 0) {
          const filePaths = JSON.parse(localStorage.getItem('batchFilePaths') || '[]');
          const filenames = JSON.parse(localStorage.getItem('batchFilenames') || '[]');
          const docIndex = parseInt(localStorage.getItem('activeDocIndex') || '0', 10);
          const batch = localStorage.getItem('isBatch') === 'true';
          const fname = localStorage.getItem('file_name') || '';
          const ftype = localStorage.getItem('file_type') || '';
          const sft = localStorage.getItem('sourceFileType') || 'IMAGE';
          const tp = parseInt(localStorage.getItem('totalPages') || '1', 10);
          const savedLang = localStorage.getItem('language') || 'hindi';
          const savedModality = localStorage.getItem('modality') || 'printed';

          const restoreSession = async () => {
            setIsRestoring(true);
            const resultsMap: Record<number, any[]> = {};
            let hasValidDoc = false;
            let cachedCorrectedJson: BBox[] | null = null;
            let hasCachedCorrection = false;

            try {
              await Promise.all(docIds.map(async (id: number) => {
                try {
                  const res = await getResults(id);
                  if (res && res.id) {
                    hasValidDoc = true;
                    if (res.ocr_results && res.ocr_results.length > 0) {
                      resultsMap[id] = res.ocr_results;
                    }
                    if (id === docIds[docIndex] && res.is_corrected && res.corrected_json) {
                      hasCachedCorrection = true;
                      cachedCorrectedJson = res.corrected_json;
                    }
                  }
                } catch (e) {
                  console.error(`Failed to fetch doc ${id}`, e);
                }
              }));

              if (!hasValidDoc) {
                throw new Error("Invalid session docs or no docs found");
              }

              setBatchDocIds(docIds);
              setBatchFilePaths(filePaths);
              setBatchFilenames(filenames);
              setActiveDocIndex(docIndex);
              setIsBatch(batch);
              setSourceFileType(sft);
              setTotalPages(tp);
              setLanguage(savedLang);
              setModality(savedModality);
              if (fname) {
                setFile({ name: fname, type: ftype } as any);
              }
              setBatchResults(resultsMap);

              const currentDocId = docIds[docIndex];
              const draftKey = `annotation_draft_${user?.id || 'guest'}_${currentDocId}`;
              const savedDraftStr = localStorage.getItem(draftKey);
              let restoredFromDraft = false;

              if (savedDraftStr) {
                try {
                  const draft = JSON.parse(savedDraftStr);
                  if (draft && draft.editingId !== undefined) {
                    setEditingId(draft.editingId);
                    setPrimaryResultId(draft.editingId);
                    setBboxList(draft.bboxList || []);
                    setEditedText(draft.editedText || "");
                    setInitialBboxList(draft.initialBboxList || []);
                    setEditStartTime(draft.editStartTime || null);
                    setBboxHistory([draft.bboxList || []]);
                    restoredFromDraft = true;
                  }
                } catch (e) {
                  console.error("Failed to parse draft", e);
                }
              }

              // Always load cached corrections if available so they're ready for the home page or cancel actions
              if (hasCachedCorrection && cachedCorrectedJson) {
                setCachedCorrectionsForDoc(cachedCorrectedJson);
              }

              // Single mutually-exclusive priority chain — identical to handleSelectDocument():
              //   Priority 1: localStorage draft  (already handled above, restoredFromDraft=true)
              //   Priority 2: Saved Gold Standard (is_corrected)
              //   Priority 3: Existing OCR/fused results
              // The fused OCR primaryResultId must NOT be set when a Gold Standard exists.
              if (restoredFromDraft) {
                // Draft already restored the active editing session — nothing more to do.
              } else if (hasCachedCorrection && cachedCorrectedJson) {
                // Gold Standard path — mirrors handleSelectDocument's corrected-doc branch exactly.
                setBboxList(cachedCorrectedJson);
                setInitialBboxList(cachedCorrectedJson);
                setEditedText((cachedCorrectedJson as BBox[]).map((b: BBox) => b.text).join('\n'));
                setEditingId(-1);
                setPrimaryResultId(-1);
                setEditStartTime(Date.now());
              } else if (resultsMap[currentDocId] && resultsMap[currentDocId].length > 0) {
                // OCR results path — only reached when no Gold Standard exists.
                autoSelectBestModel(resultsMap[currentDocId]);
              }
            } catch (err) {
              console.error("Failed to restore session, resetting:", err);
              localStorage.removeItem('batchDocIds');
              localStorage.removeItem('batchFilePaths');
              localStorage.removeItem('batchFilenames');
              localStorage.removeItem('activeDocIndex');
              localStorage.removeItem('isBatch');
              localStorage.removeItem('sourceFileType');
              localStorage.removeItem('totalPages');
              localStorage.removeItem('language');
              localStorage.removeItem('modality');
              localStorage.removeItem('file_name');
              localStorage.removeItem('file_type');
            } finally {
              setIsRestoring(false);
            }
          };
          restoreSession();
        } else {
          setIsRestoring(false);
        }
      } catch (e) {
        console.error("Error parsing localStorage state:", e);
        setIsRestoring(false);
      }
    } else {
      setIsRestoring(false);
    }
  }, [authLoading, hasRestored, user]);

  // Auto-save draft — only after initial restoration has completed
  // so we never overwrite a valid draft with empty state on first mount.
  useEffect(() => {
    if (!hasRestored) return;
    if (!activeDocId || editingId === null) return;
    const draftKey = `annotation_draft_${user?.id || 'guest'}_${activeDocId}`;
    const draftData = {
      editingId,
      bboxList,
      editedText,
      initialBboxList,
      editStartTime,
      timestamp: Date.now()
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));
  }, [activeDocId, editingId, bboxList, editedText, initialBboxList, editStartTime, user]);

  // SSE Stream Effect for active document
  useEffect(() => {
    if (!activeDocId) return;

    // Check if we already have fused result (fully complete)
    if (batchResults[activeDocId] && batchResults[activeDocId].some((r: any) => r.model_name.includes("Fused Result"))) {
      return;
    }

    const stream = createDocumentStream(activeDocId);

    const handleModelUpdate = (e: MessageEvent) => {
      const result = JSON.parse(e.data);
      setBatchResults(prev => {
        const current = prev[activeDocId] || [];
        if (!current.find((r: any) => r.id === result.id)) {
          let next;
          if (result.model_name.includes("Fused Result")) {
            next = [result, ...current];
          } else {
            next = [...current, result];
          }
          autoSelectBestModel(next);
          return { ...prev, [activeDocId]: next };
        }
        return prev;
      });
    };

    const handlePageCompleted = () => {
      stream.close();
    };

    stream.addEventListener("MODEL_COMPLETED", handleModelUpdate);
    stream.addEventListener("FUSION_COMPLETED", handleModelUpdate);
    stream.addEventListener("PAGE_COMPLETED", handlePageCompleted);

    return () => {
      stream.close();
    };
  }, [activeDocId]); // ONLY activeDocId, so it doesn't reconnect on every state update

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setBatchDocIds([]);
      setBatchFilePaths([]);
      setBatchFilenames([]);
      setActiveDocIndex(0);
      setPrimaryResultId(null);
      setManualSelectedId(null);
      setEditingId(null);
      setSourceFileType("IMAGE");
      setTotalPages(1);
    }
  };

  const handleSelectDocument = async (index: number) => {
    const docId = batchDocIds[index];
    setActiveDocIndex(index);
    setEditingId(null);
    setPrimaryResultId(null);
    setManualSelectedId(null);
    setBboxList([]);
    setInitialBboxList([]);

    const draftKey = `annotation_draft_${user?.id || 'guest'}_${docId}`;
    const savedDraftStr = localStorage.getItem(draftKey);
    let restoredFromDraft = false;

    if (savedDraftStr) {
      try {
        const draft = JSON.parse(savedDraftStr);
        if (draft && draft.editingId !== undefined) {
          setEditingId(draft.editingId);
          setPrimaryResultId(draft.editingId);
          setBboxList(draft.bboxList || []);
          setEditedText(draft.editedText || "");
          setInitialBboxList(draft.initialBboxList || []);
          setEditStartTime(draft.editStartTime || null);
          setBboxHistory([draft.bboxList || []]);
          restoredFromDraft = true;
        }
      } catch (e) { }
    }

    if (docId && (!batchResults[docId] || batchResults[docId].length === 0)) {
      try {
        const data = await getResults(docId);

        // Always load cached corrections if available so they are ready for the home page/cancel actions
        if (data.is_corrected && data.corrected_json) {
          setCachedCorrectionsForDoc(data.corrected_json);
        }

        // Priority 1: Gold Standard (is_corrected) — must be checked BEFORE ocr_results
        // because a corrected document always has both ocr_results AND corrected_json in the response.
        if (data.is_corrected && data.corrected_json && !restoredFromDraft) {
          setBboxList(data.corrected_json);
          setEditingId(-1);
          setPrimaryResultId(-1);
          setEditedText(data.corrected_json.map((b: BBox) => b.text).join('\n'));
          setInitialBboxList(data.corrected_json);
          setEditStartTime(Date.now());
        } else if (data.ocr_results && data.ocr_results.length > 0) {
          // Priority 2: Existing OCR/fused results
          setBatchResults(prev => ({ ...prev, [docId]: data.ocr_results }));

          // Only update best model if the fetched docId is still the active one and we didn't restore a draft
          if (!restoredFromDraft && (!data.is_corrected || !data.corrected_json)) {
            setBatchDocIds(prevIds => {
              if (prevIds[index] === docId) {
                autoSelectBestModel(data.ocr_results);
              }
              return prevIds;
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch results:", err);
      }
    } else if (batchResults[docId] && batchResults[docId].length > 0 && !restoredFromDraft) {
      // Results already in state — but if this is a Gold Standard doc, restore that instead
      // of auto-selecting the fused result (which would overwrite primaryResultId(-1)).
      if (cachedCorrectionsForDoc) {
        setBboxList(cachedCorrectionsForDoc);
        setInitialBboxList(cachedCorrectionsForDoc);
        setEditedText(cachedCorrectionsForDoc.map((b: BBox) => b.text).join('\n'));
        setEditingId(-1);
        setPrimaryResultId(-1);
        setEditStartTime(Date.now());
      } else {
        autoSelectBestModel(batchResults[docId]);
      }
    }
  };

  const autoSelectBestModel = (results: any[]) => {
    if (manualSelectedIdRef.current !== null) return;
    if (!results || results.length === 0) return;
    const fused = results.find(r => r.model_name.includes("Fused Result"));
    if (fused) {
      setPrimaryResultId(fused.id);
      return;
    }

    const wordCount = (t: string) => (t || "").trim().split(/\s+/).filter(Boolean).length;

    const best = results.reduce((b: any, c: any) => {
      const confB = parseInt(b.model_name.match(/Confidence:\s*(\d+)/)?.[1] || "0", 10);
      const confC = parseInt(c.model_name.match(/Confidence:\s*(\d+)/)?.[1] || "0", 10);

      if (confC > confB) return c;
      if (confB > confC) return b;

      return wordCount(c.extracted_text) > wordCount(b.extracted_text) ? c : b;
    }, results[0]);

    setPrimaryResultId(best.id);
  };

  const handleUploadAndProcess = async () => {
    if (!file && batchDocIds.length === 0) {
      showError("Please upload a document to proceed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let documentIdsToProcess = batchDocIds;
      let total = batchDocIds.length;
      let isBatchLocal = isBatch;

      // If no doc IDs exist, this is a fresh file selection that needs to be uploaded.
      if (batchDocIds.length === 0) {
        if (!file) throw new Error("No file selected");
        const batchData = await uploadDocument(file);

        setBatchDocIds(batchData.document_ids);
        setBatchFilePaths(batchData.file_paths);
        setBatchFilenames(batchData.filenames);
        setIsBatch(batchData.is_batch);
        setActiveDocIndex(0);
        setSourceFileType(batchData.source_file_type || "IMAGE");
        setTotalPages(batchData.total_pages || 1);

        documentIdsToProcess = batchData.document_ids;
        total = batchData.document_ids.length;
        isBatchLocal = batchData.is_batch;

        // Cache Hit Check (only applicable for fresh uploads)
        if (batchData.is_cached && batchData.cached_corrected_json) {
          setCachedCorrectionsForDoc(batchData.cached_corrected_json);
          setBboxList(batchData.cached_corrected_json);
          setEditingId(-1); // Indicates cached doc editing
          setPrimaryResultId(-1);
          setEditedText(batchData.cached_corrected_json.map((b: BBox) => b.text).join('\n'));
          setInitialBboxList(batchData.cached_corrected_json);
          setEditStartTime(Date.now());
          showSuccess("✅ Previous corrections loaded. No OCR needed.");
          setLoading(false);
          return;
        }
      }

      // Fire all process endpoints so they enqueue in the background
      let anyStarted = false;
      await Promise.all(
        documentIdsToProcess.map(async (docId: number) => {
          try {
            const res = await processDocument(docId, language, modality);
            if (res?.status === "cached" || res?.status === "completed") {
              // Document is already processed or cached
            } else {
              anyStarted = true;
            }
          } catch (err) {
            console.error(`Error enqueuing document ${docId}:`, err);
            anyStarted = true;
          }
        })
      );

      if (anyStarted) {
        setBatchResults({});
        setBatchProgress({ done: 0, total });
        setCachedCorrectionsForDoc(null);
        setBboxList([]);
        if (isBatchLocal) {
          showSuccess(`Batch processing started for ${total} documents. Streaming results... 🚀`);
        } else {
          showSuccess("Document processing started. Streaming results... 🚀");
        }
      } else {
        // No new processing started. Everything was cached or completed!
        // We re-invoke handleSelectDocument for the active doc so it restores draft OR loads the existing result
        // We only do this if it was already uploaded (batchDocIds.length > 0 originally)
        if (batchDocIds.length > 0) {
          await handleSelectDocument(activeDocIndex);
        }
        showSuccess("✅ Existing results loaded. No OCR needed.");
      }
    } catch (error) {
      console.error("Error processing document:", error);
      showError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditing = (resultId: number) => {
    setEditingId(resultId);

    // If it's the cached doc, we already have bboxList setup
    if (resultId === -1 && cachedCorrectionsForDoc) {
      return;
    }

    const result = ocrResults.find(r => r.id === resultId);
    if (!result) return;

    const source = result.raw_json?.regions ?? [];
    const bboxes: BBox[] = source.map((region: any, i: number) => ({
      id: `original-${Date.now()}-${i}`,
      x: region.bounding_box?.x ?? region.bbox?.left ?? region.bbox?.x ?? 0,
      y: region.bounding_box?.y ?? region.bbox?.top ?? region.bbox?.y ?? 0,
      w: region.bounding_box?.w ?? region.bbox?.width ?? region.bbox?.w ?? 50,
      h: region.bounding_box?.h ?? region.bbox?.height ?? region.bbox?.h ?? 20,
      text: region.words?.map((w: any) => w.text).join(' ') || region.text || region.label || '',
      status: 'original' as BBoxStatus,
    }));
    setBboxList(bboxes);
    setBboxHistory([bboxes]);
    setEditedText(result.corrected_text || result.extracted_text);
    setSelectedBboxIds([]);
    setMiniEditorText("");
    setInitialBboxList(bboxes);
    setEditStartTime(Date.now());
  };

  // ── BBox Handlers ──
  const pushHistory = (newList: BBox[]) => {
    setBboxHistory(prev => [...prev.slice(-9), newList]); // Keep last 10
  };

  const updateBboxList = (newList: BBox[]) => {
    pushHistory(bboxList);
    setBboxList(newList);
  };

  const handleDeleteBbox = () => {
    if (selectedBboxIds.length === 0) return;
    const newList = bboxList.map(b =>
      selectedBboxIds.includes(b.id) ? { ...b, status: "deleted" as BBoxStatus, lastModified: Date.now() } : b
    );
    pushHistory(bboxList);
    setBboxList(newList);
    setSelectedBboxIds([]);
    setMiniEditorText("");
  };

  const sortBboxesInReadingOrder = (bboxes: BBox[]) => {
    if (!bboxes || bboxes.length === 0) return [];
    const sortedByY = [...bboxes].sort((a, b) => a.y - b.y);
    const lines: BBox[][] = [];

    sortedByY.forEach(box => {
      let placed = false;
      if (lines.length > 0) {
        const currentLine = lines[lines.length - 1];
        // Use the average y and h of the line, or just the first element to avoid outlier boxes expanding the line indefinitely
        const referenceY = currentLine[0].y;
        const referenceH = currentLine[0].h;
        // If the box's y is within a reasonable threshold (e.g. half the height of the reference box), it belongs to the same line
        if (Math.abs(box.y - referenceY) < Math.max(15, referenceH * 0.6)) {
          currentLine.push(box);
          placed = true;
        }
      }
      if (!placed) {
        lines.push([box]);
      }
    });

    return lines.map(line => line.sort((a, b) => a.x - b.x)).flat();
  };

  const handleMergeBbox = () => {
    if (selectedBboxIds.length < 2) return;

    const selected = bboxList.filter(b => selectedBboxIds.includes(b.id));
    const sorted = sortBboxesInReadingOrder(selected);

    const x = Math.min(...sorted.map(b => b.x));
    const y = Math.min(...sorted.map(b => b.y));
    const xMax = Math.max(...sorted.map(b => b.x + b.w));
    const yMax = Math.max(...sorted.map(b => b.y + b.h));

    const mergedText = sorted.map(b => b.text).join(' ');

    const mergedBbox: BBox = {
      id: `merged-${Date.now()}`,
      x, y, w: xMax - x, h: yMax - y,
      text: mergedText,
      status: 'new',
      lastModified: Date.now()
    };

    const newList = [
      ...bboxList.filter(b => !selectedBboxIds.includes(b.id)),
      mergedBbox
    ];

    pushHistory(bboxList);
    setBboxList(newList);
    setSelectedBboxIds([mergedBbox.id]);
    setMiniEditorText(mergedBbox.text);
  };

  const handleUndo = () => {
    if (bboxHistory.length === 0) return;
    const previous = bboxHistory[bboxHistory.length - 1];
    setBboxList(previous);
    setBboxHistory(prev => prev.slice(0, -1));
    setSelectedBboxIds([]);
    setMiniEditorText("");
  };

  // Update mini editor text when selection changes
  useEffect(() => {
    if (selectedBboxIds.length === 1) {
      const b = bboxList.find(x => x.id === selectedBboxIds[0]);
      if (b && b.status !== 'deleted') {
        setMiniEditorText(b.text);
      }
    } else {
      setMiniEditorText("");
    }
  }, [selectedBboxIds, bboxList]);

  const handleMiniEditorChange = (val: string) => {
    setMiniEditorText(val);
    if (selectedBboxIds.length === 1) {
      setBboxList(prev => prev.map(b =>
        b.id === selectedBboxIds[0] ? { ...b, text: val, status: b.status === 'original' ? 'modified' : b.status, lastModified: Date.now() } : b
      ));
    }
  };

  const generateFullText = (bboxes: BBox[]) => {
    const validBboxes = bboxes.filter(b => b.status !== 'deleted');
    if (validBboxes.length === 0) return "";

    const sortedLines: BBox[][] = [];
    const sortedByY = [...validBboxes].sort((a, b) => a.y - b.y);

    sortedByY.forEach(box => {
      let placed = false;
      if (sortedLines.length > 0) {
        const currentLine = sortedLines[sortedLines.length - 1];
        const referenceY = currentLine[0].y;
        const referenceH = currentLine[0].h;
        if (Math.abs(box.y - referenceY) < Math.max(15, referenceH * 0.6)) {
          currentLine.push(box);
          placed = true;
        }
      }
      if (!placed) {
        sortedLines.push([box]);
      }
    });

    return sortedLines.map(line => {
      return line.sort((a, b) => a.x - b.x).map(b => b.text).join(' ');
    }).join('\n\n');
  };

  useEffect(() => {
    if (editingId !== null && bboxList.length > 0) {
      setEditedText(generateFullText(bboxList));
    }
  }, [bboxList, editingId]);

  const handleSaveCorrections = async () => {
    if (!activeDocId) return;

    try {
      const finalBboxes = bboxList.filter(b => b.status !== 'deleted');
      const fullText = generateFullText(finalBboxes);

      await saveBboxCorrections(activeDocId, finalBboxes, fullText);

      if (editingId && editingId !== -1) {
        await saveAnnotation(editingId, fullText);
      }

      // ── Calculate Statistics via Diffing ──
      let bbox_created = 0;
      let bbox_deleted = 0;
      let bbox_edited = 0;
      let text_edited = 0;

      const finalMap = new Map<string, BBox>();
      bboxList.forEach(b => finalMap.set(b.id, b));

      // 1. Check initial bboxes for deletions and modifications
      initialBboxList.forEach(initBox => {
        const finalBox = finalMap.get(initBox.id);
        if (!finalBox || finalBox.status === 'deleted') {
          bbox_deleted += 1;
        } else {
          // Check position edit
          const isPosChanged = Math.abs(initBox.x - finalBox.x) > 2 ||
            Math.abs(initBox.y - finalBox.y) > 2 ||
            Math.abs(initBox.w - finalBox.w) > 2 ||
            Math.abs(initBox.h - finalBox.h) > 2;
          if (isPosChanged) {
            bbox_edited += 1;
          }
          // Check text edit
          if (initBox.text !== finalBox.text) {
            text_edited += 1;
          }
        }
      });

      // 2. Check for creations (newly added bboxes)
      const initialMapCheck = new Map<string, BBox>();
      initialBboxList.forEach(b => initialMapCheck.set(b.id, b));

      bboxList.forEach(finalBox => {
        if (finalBox.status !== 'deleted' && !initialMapCheck.has(finalBox.id)) {
          bbox_created += 1;
        }
      });

      const currentFilename = isBatch && batchFilenames.length > activeDocIndex ? batchFilenames[activeDocIndex] : (file?.name || "Unknown");

      // ── State-based Audit Log Generation ──
      // Compare initialBboxList (snapshot at start) vs current bboxList (final state)
      // to generate ONE clean log entry per bbox: Create, Edit, or Delete.
      const auditLogs: AnnotationLogCreate[] = [];
      const initialMap = new Map<string, BBox>();
      initialBboxList.forEach(b => initialMap.set(b.id, b));

      // Check for deletions and edits (bboxes that existed in initial state)
      initialBboxList.forEach(initBox => {
        const finalBox = finalMap.get(initBox.id);
        if (!finalBox || finalBox.status === 'deleted') {
          // DELETED – log previous text + coords; updated = "Deleted"
          auditLogs.push({
            action_type: "Delete",
            previous_value: fmtCoords(initBox),
            updated_value: "Deleted",
            text_content: initBox.text || "[Empty]",
            page_number: activeDocIndex + 1,
            filename: currentFilename,
            timestamp: new Date(finalBox?.lastModified || Date.now()).toISOString()
          });
        } else {
          // Check what changed
          const posChanged = Math.abs(initBox.x - finalBox.x) > 1 ||
            Math.abs(initBox.y - finalBox.y) > 1 ||
            Math.abs(initBox.w - finalBox.w) > 1 ||
            Math.abs(initBox.h - finalBox.h) > 1;
          const textChanged = initBox.text !== finalBox.text;

          if (posChanged || textChanged) {
            // EDITED – ONE entry covering coords + text in prev and updated
            auditLogs.push({
              action_type: "Edit",
              previous_value: fmtCoords(initBox),
              updated_value: fmtCoords(finalBox),
              // Encode both old and new text as JSON so the display can render them
              text_content: JSON.stringify({
                old_text: initBox.text || "[Empty]",
                new_text: finalBox.text || "[Empty]"
              }),
              page_number: activeDocIndex + 1,
              filename: currentFilename,
              timestamp: new Date(finalBox.lastModified || Date.now()).toISOString()
            });
          }
        }
      });

      // Check for newly created bboxes (not present in initial state)
      bboxList.forEach(finalBox => {
        if (finalBox.status !== 'deleted' && !initialMap.has(finalBox.id)) {
          // CREATED – previous = "None"; updated = final coords + final text
          auditLogs.push({
            action_type: "Create",
            previous_value: "None",
            updated_value: fmtCoords(finalBox),
            text_content: finalBox.text || "[Empty]",
            page_number: activeDocIndex + 1,
            filename: currentFilename,
            timestamp: new Date(finalBox.lastModified || Date.now()).toISOString()
          });
        }
      });

      const timeSpent = editStartTime ? parseFloat(((Date.now() - editStartTime) / 60000).toFixed(2)) : 0.1;

      const statsPayload = {
        document_id: batchDocIds[0] || activeDocId || 1,
        page_number: activeDocIndex + 1,
        filename: currentFilename,
        bbox_deleted,
        bbox_created,
        bbox_edited,
        text_edited,
        time_spent: timeSpent,
        logs: auditLogs,
        source_file_type: sourceFileType,
        total_pages: totalPages || batchDocIds.length || 1
      };

      await saveStatistics(statsPayload);

      setInitialBboxList(finalBboxes);
      setEditStartTime(Date.now());

      if (activeDocId) {
        localStorage.removeItem(`annotation_draft_${user?.id || 'guest'}_${activeDocId}`);
      }

      showSuccess("Gold Standard corrections & statistics saved ✅");
      setEditedText(fullText);
    } catch (error) {
      console.error("Error saving corrections:", error);
      showError("Failed to save corrections.");
    }
  };

  useEffect(() => {
    // Only bind shortcuts when editingId is not null, since shortcuts only apply to annotation interface
    if (editingId === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // 2. Handle Ctrl+S globally (prevent browser save)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCorrections();
        return;
      }

      // 3. Handle Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      // 4. Ignore other shortcuts if typing
      if (isInput) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          setToolMode('select');
          break;
        case 'd':
          setToolMode('draw');
          break;
        case 'delete':
        case 'backspace':
          handleDeleteBbox();
          break;
        case 'm':
          handleMergeBbox();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case '0':
          handleZoomReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingId, handleSaveCorrections, handleUndo, handleDeleteBbox, handleMergeBbox, handleZoomIn, handleZoomOut, handleZoomReset]);

  const primaryResult = (primaryResultId === -1 && cachedCorrectionsForDoc)
    ? {
        id: -1,
        model_name: "Cached Corrections",
        corrected_text: editedText || cachedCorrectionsForDoc.map((b: BBox) => b.text).join('\n'),
        raw_json: {
          regions: cachedCorrectionsForDoc.map((b: BBox) => ({
            bounding_box: { x: b.x, y: b.y, w: b.w, h: b.h },
            text: b.text
          }))
        }
      }
    : (ocrResults.find(r => r.id === primaryResultId) || ocrResults[0]);
  return (
    <div className="min-h-screen p-4 md:p-8 font-sans text-gray-800 bg-[#f8fafc]">
      {/* TOASTS */}
      {successMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-6 py-3 rounded shadow-lg z-50">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded shadow-lg z-50">
          {errorMessage}
        </div>
      )}

      {/* HEADER */}
      <header className="max-w-[1600px] w-[95%] mx-auto flex flex-col md:flex-row items-center justify-between pb-6 mb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Annotation Tool</h1>
          <p className="text-gray-500 mt-1">Upload document and create Gold Standard corrections</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0 items-center">
          {user && (
            <span className="font-semibold text-gray-700 mr-2 flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
              👤 {user.username}
            </span>
          )}
          <Link
            href="/statistics"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer font-bold"
          >
            📊 My Statistics
          </Link>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <span>❓</span> Help
          </button>
          {user && (
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg shadow-sm transition-colors cursor-pointer font-medium"
            >
              🚪 Logout
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] w-[95%] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-[75vh]">

        {/* LEFT PANEL */}
        <div className={`col-span-1 ${editingId !== null ? 'lg:col-span-6' : 'lg:col-span-4'} bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6 flex flex-col transition-all duration-300`}>

          {editingId !== null ? (
            <div className="flex flex-col h-full bg-white rounded-xl w-full">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-xl font-bold text-gray-800">Original Document Preview</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button onClick={handleZoomOut} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded shadow-sm text-xl">-</button>
                    <span className="text-sm font-semibold px-2">{Math.round(zoomLevel * 100)}%</span>
                    <button onClick={handleZoomIn} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded shadow-sm text-xl">+</button>
                    <button onClick={handleZoomReset} className="ml-1 px-3 py-1.5 text-xs hover:bg-white rounded shadow-sm">Reset</button>
                  </div>
                </div>
              </div>

              {isBatch && batchDocIds.length > 0 && (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 mb-3 shadow-inner select-none animate-fade-in">
                  <button
                    onClick={() => handleSelectDocument(Math.max(0, activeDocIndex - 1))}
                    disabled={activeDocIndex === 0}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${activeDocIndex === 0
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white hover:bg-indigo-100 border-indigo-200 text-indigo-700 cursor-pointer shadow-sm active:scale-95'
                      }`}
                  >
                    ◀ Prev Page
                  </button>

                  <span className="text-xs font-semibold text-indigo-900 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm">
                    Page <strong className="text-indigo-600 font-bold">{activeDocIndex + 1}</strong> of <strong className="text-indigo-900 font-bold">{batchDocIds.length}</strong>
                  </span>

                  <button
                    onClick={() => handleSelectDocument(Math.min(batchDocIds.length - 1, activeDocIndex + 1))}
                    disabled={activeDocIndex === batchDocIds.length - 1}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${activeDocIndex === batchDocIds.length - 1
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white hover:bg-indigo-100 border-indigo-200 text-indigo-700 cursor-pointer shadow-sm active:scale-95'
                      }`}
                  >
                    Next Page ▶
                  </button>
                </div>
              )}

              <div className="mb-3">
                <BboxToolbar
                  toolMode={toolMode}
                  selectedIds={selectedBboxIds}
                  bboxCount={bboxList.filter(b => b.status !== 'deleted').length}
                  onModeChange={setToolMode}
                  onDelete={handleDeleteBbox}
                  onMerge={handleMergeBbox}
                  onUndo={handleUndo}
                  canUndo={bboxHistory.length > 0}
                />
              </div>

              <div className="flex-1 w-full bg-gray-50 rounded-lg border border-gray-200 overflow-auto p-2 min-h-[600px] lg:max-h-[80vh]">
                <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
                  <BboxCanvas
                    imageUrl={previewUrl || ""}
                    bboxList={bboxList}
                    selectedIds={selectedBboxIds}
                    toolMode={toolMode}
                    onBboxChange={updateBboxList}
                    onSelectChange={setSelectedBboxIds}
                  />
                </div>
              </div>
            </div>
          ) : isRestoring ? (
            /* Session restoration in progress — prevent upload screen from flashing */
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12 text-center">
              <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              <p className="text-base font-semibold text-indigo-600">Restoring your previous session…</p>
              <p className="text-xs text-gray-400">Please wait while your document and annotations are loaded.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700">Select Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-white border border-gray-300 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#A78BFA]">
                  <option value="hindi">Hindi</option>
                  <option value="telugu">Telugu</option>
                  <option value="english">English</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700">Choose Type</label>
                <select value={modality} onChange={(e) => setModality(e.target.value)} className="bg-white border border-gray-300 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#A78BFA]">
                  <option value="printed">Printed Typeset</option>
                  <option value="scenetext">Scene Text</option>
                  <option value="handwritten">Handwritten Text</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 flex-1 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">Upload Document</label>
                  {file && (
                    <button onClick={handleReset} className="text-xs text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-semibold">New File</button>
                  )}
                </div>

                {file ? (
                  <div className="flex flex-col flex-1 border border-gray-300 bg-white shadow-sm rounded-xl p-3 gap-2">
                    {batchDocIds.length > 0 && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 mb-2 text-xs font-semibold text-indigo-800 flex justify-between items-center shadow-inner select-none animate-fade-in">
                        <span>📁 File Type: <strong className="uppercase">{sourceFileType}</strong></span>
                        <span>📄 Pages/Images: <strong>{totalPages}</strong></span>
                      </div>
                    )}

                    {isBatch && batchFilenames.length > 0 ? (
                      <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto">
                        {batchFilenames.map((fname, idx) => (
                          <button key={idx} onClick={() => handleSelectDocument(idx)} className={`text-left text-xs px-3 py-2 rounded-lg border transition-all ${idx === activeDocIndex ? 'bg-[#4F46E5] text-white font-bold shadow-sm' : 'bg-gray-50 hover:bg-blue-50 text-gray-700'}`}>📄 {fname}</button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center text-sm bg-blue-50 py-2 rounded"><p className="text-[#4F46E5] font-semibold">📄 {file.name}</p></div>
                    )}
                  </div>
                ) : (
                  <label className="flex-1 border-2 border-dashed border-[#A78BFA] rounded-xl flex flex-col items-center justify-center bg-[#eff6ff] hover:bg-blue-100 hover:border-[#4F46E5] cursor-pointer p-8 min-h-[200px] transition-all duration-300">
                    <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.zip" onChange={handleFileChange} />
                    <span className="text-4xl mb-3 animate-bounce">📄</span>
                    <p className="text-base font-semibold text-[#4F46E5]">Upload your document</p>
                    <p className="text-xs text-gray-400 mt-2">Supports: JPG, JPEG, PNG, PDF, ZIP</p>
                  </label>
                )}
              </div>

              <button
                onClick={handleUploadAndProcess}
                disabled={!file || loading}
                className={`w-full py-3.5 rounded-xl font-bold border border-transparent text-lg shadow-md transition-all flex justify-center items-center gap-2 ${!file ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#4F46E5] hover:bg-[#4338ca] text-white active:scale-95 cursor-pointer'}`}
              >
                {loading ? 'Processing...' : '⚙️ Generate OCR Results'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className={`col-span-1 flex flex-col transition-all duration-300 ${editingId !== null ? 'lg:col-span-6' : 'lg:col-span-8'}`}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6 flex flex-col h-full min-h-[500px]">

            {/* Edit Mode View */}
            {editingId !== null && (
              <div className="flex flex-col flex-1 bg-white border-2 border-indigo-300 rounded-xl shadow-lg p-2 md:p-6 transition-all duration-300">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 shrink-0">
                  <div>
                    <h3 className="font-bold text-2xl text-indigo-700">
                      {primaryResult?.model_name || "Cached Corrections"}
                    </h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">Editing Gold Standard</p>
                  </div>
                  {!cachedCorrectionsForDoc && ocrResults.length > 1 && (
                    <button
                      onClick={() => setIsCompareModalOpen(true)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded text-sm font-bold border border-indigo-200"
                    >
                      🔍 Compare All Models
                    </button>
                  )}
                </div>

                {/* Mini Text Editor for Selected BBox */}
                {selectedBboxIds.length === 1 && (
                  <div className="mb-4 bg-indigo-50 border border-indigo-200 p-3 rounded-lg shrink-0 shadow-sm">
                    <label className="text-xs font-bold text-indigo-700 mb-1 block uppercase tracking-wider">Edit Selected Region</label>
                    {language === "english" ? (
                      <textarea
                        className="w-full bg-white border border-indigo-200 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16"
                        value={miniEditorText}
                        onChange={(e) => handleMiniEditorChange(e.target.value)}
                        placeholder="Text for the selected bounding box..."
                      />
                    ) : (
                      <ReactTransliterate
                        value={miniEditorText}
                        onChangeText={(text) => handleMiniEditorChange(text)}
                        lang={getTransliterateLang(language) as any}
                        renderComponent={(props) => (
                          <textarea
                            {...props}
                            className="w-full bg-white border border-indigo-200 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16"
                            placeholder="Text for the selected bounding box..."
                          />
                        )}
                      />
                    )}
                  </div>
                )}

                {/* Full Text Viewer */}
                <div className="flex flex-col flex-1 shrink-0 min-h-[250px]">
                  <label className="text-xs font-bold text-gray-500 mb-1 block uppercase tracking-wider">Full Page Text (Preview)</label>
                  <InteractiveTextViewer
                    bboxList={bboxList}
                    selectedIds={selectedBboxIds}
                    onSelectChange={setSelectedBboxIds}
                  />
                </div>

                <div className="flex justify-between mt-5 pt-4 border-t border-gray-100 shrink-0 items-center">
                  <button className="px-6 py-2.5 text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg font-semibold" onClick={() => {
                    setEditingId(null);
                    if (activeDocId) {
                      localStorage.removeItem(`annotation_draft_${user?.id || 'guest'}_${activeDocId}`);
                    }
                  }}>
                    Cancel
                  </button>
                  <button className="px-6 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md font-semibold flex items-center gap-2" onClick={handleSaveCorrections}>
                    💾 Save Corrections
                  </button>
                </div>
              </div>
            )}

            {/* Primary Card View (Before clicking Edit) */}
            {editingId === null && primaryResult && !loading && (
              <div className="flex flex-col h-full animate-fade-in">
                {isBatch && batchDocIds.length > 0 && (
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4 shadow-sm select-none shrink-0">
                    <button
                      onClick={() => handleSelectDocument(Math.max(0, activeDocIndex - 1))}
                      disabled={activeDocIndex === 0}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg border transition-all ${activeDocIndex === 0
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white hover:bg-indigo-100 border-indigo-200 text-indigo-700 cursor-pointer shadow-sm active:scale-95'
                        }`}
                    >
                      ◀ Prev Page
                    </button>

                    <span className="text-sm font-semibold text-indigo-900 bg-white border border-indigo-200 px-4 py-1.5 rounded-lg shadow-sm">
                      Page <strong className="text-indigo-600 font-bold">{activeDocIndex + 1}</strong> of <strong className="text-indigo-900 font-bold">{batchDocIds.length}</strong>
                    </span>

                    <button
                      onClick={() => handleSelectDocument(Math.min(batchDocIds.length - 1, activeDocIndex + 1))}
                      disabled={activeDocIndex === batchDocIds.length - 1}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg border transition-all ${activeDocIndex === batchDocIds.length - 1
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white hover:bg-indigo-100 border-indigo-200 text-indigo-700 cursor-pointer shadow-sm active:scale-95'
                        }`}
                    >
                      Next Page ▶
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-200 shrink-0">
                  <h2 className="text-xl font-bold text-gray-800">Best OCR Result</h2>
                  <button onClick={() => setIsCompareModalOpen(true)} className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold border border-indigo-100 hover:bg-indigo-100 shrink-0">
                    🔍 Compare All Models
                  </button>
                </div>

                <div className={`rounded-xl border-2 shadow-md p-6 flex flex-col flex-1 ${primaryResult.model_name.includes("Fused Result")
                  ? "bg-yellow-50 border-orange-200"
                  : "bg-white border-indigo-200"
                  }`}>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <span className={`font-bold text-2xl ${primaryResult.model_name.includes("Fused Result") ? "text-orange-700" : "text-indigo-700"}`}>{primaryResult.model_name}</span>
                      <span className={`ml-3 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${manualSelectedId === primaryResult.id ? "bg-indigo-100 text-indigo-700" : "bg-amber-400 text-amber-900"}`}>
                        {manualSelectedId === primaryResult.id 
                          ? "Selected" 
                          : (primaryResult.model_name.includes("Fused Result") ? "★ Auto Selected / Recommended" : "★ Auto-Selected Best")}
                      </span>
                    </div>

                  </div>

                  {(() => {
                    const source = primaryResult.raw_json?.regions ?? [];
                    if (source.length === 0) {
                      return (
                        <div className="text-gray-700 flex-1 flex flex-col gap-2 overflow-auto bg-gray-50 p-5 rounded-lg border border-gray-100 lg:max-h-[60vh]">
                          <p className="whitespace-pre-wrap flex-1 text-base leading-relaxed">
                            {primaryResult.corrected_text || primaryResult.extracted_text}
                          </p>
                        </div>
                      );
                    }
                    const previewBboxes: BBox[] = source.map((region: any, i: number) => ({
                      id: `preview-${primaryResult.id}-${i}`,
                      x: region.bounding_box?.x ?? region.bbox?.left ?? region.bbox?.x ?? 0,
                      y: region.bounding_box?.y ?? region.bbox?.top ?? region.bbox?.y ?? 0,
                      w: region.bounding_box?.w ?? region.bbox?.width ?? region.bbox?.w ?? 50,
                      h: region.bounding_box?.h ?? region.bbox?.height ?? region.bbox?.h ?? 20,
                      text: region.words?.map((w: any) => w.text).join(' ') || region.text || region.label || '',
                      status: 'original' as BBoxStatus,
                    }));
                    return (
                      <div className="flex-1 flex flex-col min-h-[250px]">
                        <InteractiveTextViewer
                          bboxList={previewBboxes}
                          selectedIds={[]}
                          onSelectChange={() => { }}
                        />
                      </div>
                    );
                  })()}

                  <div className="mt-6 flex justify-end">
                    <button onClick={() => handleStartEditing(primaryResult.id)} className="flex items-center gap-2 px-6 py-3 text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all active:scale-95">
                      ✏️ Edit Text & Bboxes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State / Processing State */}
            {ocrResults.length === 0 && !loading && !cachedCorrectionsForDoc && (
              <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
                {batchDocIds.length > 0 ? (
                  <>
                    <span className="text-6xl mb-4 animate-spin">⏳</span>
                    <p className="text-xl font-semibold text-indigo-600 mb-2">Processing OCR in Background...</p>
                    <p className="text-md text-gray-500 max-w-md">Models will appear here progressively as they complete.</p>
                  </>
                ) : (
                  <>
                    <span className="text-6xl mb-4">🔍</span>
                    <p className="text-xl font-semibold text-gray-600 mb-2">No Results Yet</p>
                    <p className="text-md text-gray-500 max-w-md">Upload a document on the left panel to extract text.</p>
                  </>
                )}
              </div>
            )}

            {loading && (
              <div className="col-span-full h-full flex flex-col items-center justify-center text-indigo-600 bg-indigo-50 rounded-xl border border-indigo-200 p-10">
                <p className="text-xl font-semibold">Uploading document...</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODALS */}
      {isCompareModalOpen && (
        <CompareModal
          results={ocrResults}
          primaryResultId={primaryResultId}
          manualSelectedId={manualSelectedId}
          onSelectModel={(id) => {
            setPrimaryResultId(id);
            setManualSelectedId(id);
            if (editingId !== null) {
              handleStartEditing(id); // Reload canvas
            }
          }}
          onClose={() => setIsCompareModalOpen(false)}
        />
      )}

      <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
