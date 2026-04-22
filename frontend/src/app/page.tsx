"use client";

import { useState } from "react";
import { uploadDocument, processDocument, saveAnnotation } from "../services/api";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocrResults, setOcrResults] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");

  const [language, setLanguage] = useState("hindi");
  const [modality, setModality] = useState("printed");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    setDocumentId(null);
    setOcrResults([]);
    setEditingId(null);
    setPreviewUrl(null);
    setEditedText("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      showError("Please upload a document to proceed.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      // 1. Upload
      const docData = await uploadDocument(file);
      setDocumentId(docData.id);

      // 2. Process
      const results = await processDocument(docData.id, language, modality);
      setOcrResults(results);
      showSuccess("Document processed successfully ✅");
    } catch (error) {
      console.error("Error processing document:", error);
      showError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (resultId: number) => {
    try {
      await saveAnnotation(resultId, editedText);
      setOcrResults((prev) => 
        prev.map((res) => res.id === resultId ? { ...res, corrected_text: editedText } : res)
      );
      setEditingId(null);
      showSuccess("Changes saved successfully ✅");
    } catch (error) {
      console.error("Error saving annotation:", error);
      showError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans text-gray-800 bg-[#f8fafc]">
      {/* SUCCESS / ERROR TOASTS */}
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

      {/* HELP MODAL */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">How to use this tool</h3>
            <ol className="list-decimal pl-5 space-y-2 text-gray-700 mb-6 font-medium">
              <li>Upload a document using the left panel.</li>
              <li>Select the language of the document.</li>
              <li>Select the document type (Printed, Handwritten, etc.).</li>
              <li>Click "Generate OCR Results" button.</li>
              <li>Compare the results on the right side.</li>
              <li>Click a result card to expand it. Then you can edit and save your corrections.</li>
            </ol>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-6">
              <p className="text-sm text-gray-800"><b>Why multiple outputs?</b> Different AI models produce different results. This tool lets you compare them and choose the best one!</p>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setIsHelpOpen(false)} className="px-6 py-2 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded font-medium transition-colors cursor-pointer">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="max-w-[1600px] w-[95%] mx-auto flex flex-col md:flex-row items-center justify-between pb-6 mb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">OCR Comparison Tool</h1>
          <p className="text-gray-500 mt-1">Upload document and compare OCR results easily</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Help & Instructions"
          >
            <span>❓</span> Help
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm transition-colors cursor-pointer" title="About this application">
            About
          </button>
        </div>
      </header>
      
      <main className="max-w-[1600px] w-[95%] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-[75vh]">
        
        {/* LEFT SIDE (Input Panel / Comparison View) */}
        <div className={`col-span-1 ${editingId ? 'lg:col-span-6' : 'lg:col-span-4'} bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6 flex flex-col transition-all duration-300`}>
          
          {editingId ? (
            // ENHANCED PREVIEW MODE FOR EDITING SIDE-BY-SIDE
            <div className="flex flex-col h-full bg-white rounded-xl w-full">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xl font-bold text-gray-800">Original Document Preview</h2>
                 <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Comparison Mode</span>
               </div>
               {/* Make the image w-full and height adjust dynamically but scroll if it breaks boundaries */}
               <div className="flex-1 w-full bg-gray-50 rounded-lg border border-gray-200 overflow-y-auto overflow-x-hidden flex flex-col p-2 min-h-[600px] lg:max-h-[80vh]">
                   {file?.type === "application/pdf" ? (
                       <object data={`${previewUrl}#navpanes=0&scrollbar=0&view=FitH`} type="application/pdf" className="w-full h-[800px] rounded"></object>
                   ) : (
                       <img src={previewUrl || ""} alt="Original Document" className="w-full h-auto rounded shadow-sm object-contain" />
                   )}
               </div>
            </div>
          ) : (
            // REGULAR SETUP VIEW
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700" title="Select the language contained in the document">
                  Select Language
                </label>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#A78BFA] transition-all cursor-pointer shadow-sm"
                  title="Select Language"
                >
                  <option value="hindi">Hindi</option>
                  <option value="telugu">Telugu</option>
                  <option value="english">English</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700" title="Choose type of document: printed, handwritten, or scene text">
                  Choose Type
                </label>
                <select 
                  value={modality} 
                  onChange={(e) => setModality(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#A78BFA] transition-all cursor-pointer shadow-sm"
                  title="Choose type of document: printed, handwritten, or scene text"
                >
                  <option value="printed">Printed Typeset</option>
                  <option value="scenetext">Scene Text (Signs/Billboards)</option>
                  <option value="handwritten">Handwritten Text</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 flex-1 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">
                    Upload Document
                  </label>
                  {file && (
                     <button 
                       onClick={handleReset}
                       className="text-xs text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                     >
                       New File
                     </button>
                  )}
                </div>
                
                {file ? (
                  <div className="flex flex-col flex-1 border border-gray-300 bg-white shadow-sm rounded-xl p-3">
                    {previewUrl && (
                      <div className="flex-1 w-full bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-3 flex items-center justify-center min-h-[200px]">
                         {file.type === "application/pdf" ? (
                             <object data={`${previewUrl}#navpanes=0&scrollbar=0&view=FitH`} type="application/pdf" className="w-full h-full rounded"></object>
                         ) : (
                             <img src={previewUrl} alt="Preview" className="max-w-full max-h-[300px] object-contain rounded" />
                         )}
                      </div>
                    )}
                    <div className="flex items-center justify-center text-sm bg-blue-50 py-2 rounded">
                      <p className="text-[#4F46E5] font-semibold truncate max-w-[90%]" title={file.name}>📄 {file.name}</p>
                    </div>
                  </div>
                ) : (
                  <label 
                    title="Upload your document to extract text"
                    className="flex-1 border-2 border-dashed border-[#A78BFA] rounded-xl flex flex-col items-center justify-center bg-[#eff6ff] hover:bg-blue-100 hover:border-[#4F46E5] transition-colors cursor-pointer p-8 min-h-[200px]"
                  >
                    <input type="file" className="hidden" accept=".jpg,.png,.pdf" onChange={handleFileChange} />
                    <span className="text-4xl mb-3">📄</span>
                    <p className="text-base font-semibold text-[#4F46E5]">Upload your document</p>
                    <p className="text-sm text-gray-500 mt-1">(JPG, PNG, PDF)</p>
                  </label>
                )}
              </div>
              
              <button 
                onClick={handleUploadAndProcess}
                disabled={!file || loading}
                className={`w-full py-3.5 rounded-xl font-bold border border-transparent text-lg shadow-md transition-all flex justify-center items-center gap-2 ${
                  !file ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 
                  'bg-[#4F46E5] hover:bg-[#4338ca] text-white active:scale-95 cursor-pointer shadow-lg'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing... Please wait
                  </>
                ) : (
                  <>⚙️ Generate OCR Results</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDE (Results Panel) */}
        <div className={`col-span-1 flex flex-col transition-all duration-300 ${editingId ? 'lg:col-span-6' : 'lg:col-span-8'}`}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6 flex flex-col h-full min-h-[500px]">
             
             {/* Header */}
             {ocrResults.length > 0 && !editingId && (
               <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-800">Results</h2>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                    {ocrResults.length} Models Processed
                  </span>
               </div>
             )}

             <div className={`flex-1 ${editingId ? 'flex flex-col h-full' : 'grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
               
               {/* Empty State */}
               {ocrResults.length === 0 && !loading && (
                 <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
                    <span className="text-6xl mb-4">🔍</span>
                    <p className="text-xl font-semibold text-gray-600 mb-2">No Results Yet</p>
                    <p className="text-md text-gray-500 max-w-md">Upload a document on the left panel to extract and compare text from different OCR models.</p>
                 </div>
               )}

               {/* Loading State */}
               {loading && ocrResults.length === 0 && (
                 <div className="col-span-full h-full flex flex-col items-center justify-center text-[#4F46E5] bg-[#eff6ff] rounded-xl border border-blue-200 p-10">
                   <svg className="animate-spin mb-4 h-12 w-12 text-[#4F46E5]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   <p className="text-xl font-semibold">Extracting text...</p>
                   <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                 </div>
               )}

               {ocrResults
                 .filter(result => editingId === null || result.id === editingId)
                 .map((result, idx) => {
                   
                   // EDIT MODE
                   if (editingId === result.id) {
                     return (
                       <div key={result.id} className="flex flex-col flex-1 bg-white border-2 border-[#A78BFA] rounded-xl shadow-lg p-2 md:p-6 transition-all duration-300 lg:h-[80vh]">
                         <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 shrink-0">
                           <div>
                             <h3 className="font-bold text-2xl text-[#4F46E5]">{result.model_name}</h3>
                             <p className="text-sm font-medium text-gray-500 mt-1">Editing Corrected Output</p>
                           </div>
                           <span className="bg-purple-100 text-[#A78BFA] px-3 py-1 rounded text-sm font-bold border border-purple-200">
                             Version: Latest
                           </span>
                         </div>
                         <textarea 
                           title="Edit the extracted text"
                           className="w-full flex-1 bg-[#eff6ff] text-gray-900 border border-gray-300 p-5 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:bg-white resize-none min-h-[400px] transition-colors text-lg"
                           value={editedText}
                           onChange={(e) => setEditedText(e.target.value)}
                         />
                         <div className="flex justify-end mt-5 gap-4 pt-4 border-t border-gray-100 shrink-0">
                           <button className="px-6 py-2.5 text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors font-semibold shadow-sm hover:shadow cursor-pointer" onClick={() => setEditingId(null)}>
                             Cancel
                           </button>
                           <button className="px-6 py-2.5 text-white bg-[#4F46E5] hover:bg-[#4338ca] rounded-lg shadow-md hover:shadow-lg transition-colors font-semibold active:scale-95 flex items-center gap-2 cursor-pointer" onClick={() => handleSaveEdit(result.id)}>
                             💾 Save Corrections
                           </button>
                         </div>
                       </div>
                     );
                   }

                   // GRID CARD VIEW
                   return (
                     <div 
                       key={result.id} 
                       className="bg-white rounded-xl border border-gray-200 shadow-md p-5 flex flex-col transition-all duration-200 hover:shadow-lg hover:border-[#4F46E5] hover:-translate-y-1 group cursor-pointer"
                       onClick={() => {
                           setEditingId(result.id);
                           setEditedText(result.corrected_text || result.extracted_text);
                       }}
                       title="Click to view full text and edit"
                     >
                       <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100" title="Different OCR model versions for comparison">
                         <span className="font-bold text-[#4F46E5] text-lg">
                           {result.model_name}
                         </span>
                         <span className="bg-purple-50 border border-purple-100 text-[#A78BFA] px-2 py-0.5 rounded text-xs font-bold shadow-sm">
                           V1.0
                         </span>
                       </div>

                       <div className="text-gray-700 flex-1 flex flex-col gap-2 overflow-hidden bg-gray-50 p-3 rounded-lg border border-gray-100 group-hover:bg-white transition-colors">
                         <p className="whitespace-pre-wrap flex-1 text-sm leading-relaxed overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 7, WebkitBoxOrient: 'vertical'}}>
                           {result.corrected_text || result.extracted_text}
                         </p>
                       </div>
                         
                       <div className="mt-4 flex justify-between items-center px-1">
                         <span className="text-xs text-gray-400 font-medium italic">Click card to edit...</span>
                         <div className="flex items-center gap-1 text-sm font-bold text-[#4F46E5] group-hover:text-[#4338ca] bg-blue-50 px-3 py-1.5 rounded-lg transition-colors transform group-hover:scale-105">
                           <span>✏️</span> Edit
                         </div>
                       </div>
                     </div>
                   );
               })}

             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
