"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getStatisticsSummary, getStatisticsPages, getStatisticsLogs } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function StatisticsPage() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<any | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<"summary" | "pages" | "logs">("summary");

  // States for Page-wise Details Table
  const [pageSearch, setPageSearch] = useState("");
  const [pageSort, setPageSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "page_number", direction: "asc" });

  // States for Annotation Logs Table
  const [logSearch, setLogSearch] = useState("");
  const [logFilter, setLogFilter] = useState("All");

  useEffect(() => {
    async function fetchData() {
      try {
        const [sumData, pagesData, logsData] = await Promise.all([
          getStatisticsSummary(),
          getStatisticsPages(),
          getStatisticsLogs()
        ]);
        setSummary(sumData);
        setPages(pagesData);
        setLogs(logsData);
      } catch (err) {
        console.error("Failed to fetch statistics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // --- Page Data Processing ---
  const filteredAndSortedPages = useMemo(() => {
    let result = [...pages];
    
    // Search by page number or doc id
    if (pageSearch.trim() !== "") {
      result = result.filter(p => 
        p.page_number.toString().includes(pageSearch) || 
        p.document_id.toString().includes(pageSearch)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[pageSort.key] || 0;
      const bVal = b[pageSort.key] || 0;
      if (aVal < bVal) return pageSort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return pageSort.direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [pages, pageSearch, pageSort]);

  const handlePageSort = (key: string) => {
    setPageSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  const getSortIcon = (key: string) => {
    if (pageSort.key !== key) return "↕";
    return pageSort.direction === "asc" ? "↑" : "↓";
  };

  // --- Logs Data Processing ---
  const filteredAndSortedLogs = useMemo(() => {
    let result = [...logs];

    // Filter by action type
    if (logFilter !== "All") {
      result = result.filter(log => log.action_type.includes(logFilter));
    }

    // Search by content
    if (logSearch.trim() !== "") {
      const lowerSearch = logSearch.toLocaleLowerCase();
      result = result.filter(log => 
        (log.previous_value && log.previous_value.toLocaleLowerCase().includes(lowerSearch)) ||
        (log.updated_value && log.updated_value.toLocaleLowerCase().includes(lowerSearch)) ||
        (log.text_content && log.text_content.toLocaleLowerCase().includes(lowerSearch)) ||
        (log.filename && log.filename.toLocaleLowerCase().includes(lowerSearch)) ||
        (log.page_number && log.page_number.toString().includes(lowerSearch))
      );
    }

    // Sort latest first
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return result;
  }, [logs, logFilter, logSearch]);

  const getActionBadge = (actionType: string) => {
    const t = actionType.toLowerCase();
    if (t.includes("delete")) {
      return <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap">Delete</span>;
    } else if (t.includes("create")) {
      return <span className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap">Create</span>;
    } else if (t === "edit" || t.includes("edit bbox") || t.includes("edit bounding") || t.includes("edit text")) {
      return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap">Edit</span>;
    }
    return <span className="bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap">{actionType}</span>;
  };

  const getTotalCorrectionsBadge = (total: number) => {
    if (total === 0) return <span className="bg-gray-100 text-gray-500 font-bold px-3 py-1 rounded-full text-sm">0</span>;
    if (total <= 5) return <span className="bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full text-sm">{total}</span>;
    if (total <= 15) return <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full text-sm">{total}</span>;
    return <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-sm">{total}</span>;
  };

  // Render a log cell showing text label + coordinate chips together
  const renderLogCell = (log: any, side: 'prev' | 'next') => {
    const coords = side === 'prev' ? log.previous_value : log.updated_value;
    const actionType = (log.action_type || '').toLowerCase();

    // Handle "Deleted" sentinel
    if (coords === 'Deleted' || coords === 'deleted') {
      return <span className="text-red-500 italic font-semibold">Deleted</span>;
    }

    // Handle "None" sentinel (Create's previous)
    if (!coords || coords === 'None' || coords === 'none') {
      return <span className="text-gray-400 italic">None</span>;
    }

    // Determine the text value for this side
    let textValue: string | null = null;
    const rawText = log.text_content || '';

    // Try to parse text_content as JSON (Edit logs encode {old_text, new_text})
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') {
        textValue = side === 'prev'
          ? (parsed.old_text ?? null)
          : (parsed.new_text ?? null);
      }
    } catch {
      // Plain text — use for the 'next' side (Create/Delete store final/prev text directly)
      if (side === 'next' && (actionType === 'create' || actionType.includes('create'))) {
        textValue = rawText || null;
      } else if (side === 'prev' && (actionType === 'delete' || actionType.includes('delete'))) {
        textValue = rawText || null;
      } else if (side === 'next') {
        textValue = rawText || null;
      }
    }

    // Render coord chips
    const coordChips = coords.toLowerCase().startsWith('x:')
      ? coords.split(',').map((s: string) => s.trim()).filter(Boolean)
      : null;

    const textColorClass = side === 'prev' ? 'text-red-600' : 'text-emerald-700 font-semibold';

    return (
      <div className="flex flex-col gap-1">
        {textValue && textValue !== '[Empty]' && (
          <div className={`text-[11px] ${textColorClass} max-w-[200px] truncate`} title={textValue}>
            <span className="text-gray-400 font-normal">Text: </span>{textValue}
          </div>
        )}
        {textValue === '[Empty]' && (
          <div className="text-[11px] text-gray-400 italic">Text: [Empty]</div>
        )}
        {coordChips ? (
          <div className="flex gap-1 flex-wrap">
            {coordChips.map((p: string, i: number) => (
              <span key={i} className="bg-gray-100 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider">
                {p}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-500 text-[11px]">{coords}</span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-semibold">Loading your statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-800 font-sans p-4 md:p-8">
      {/* HEADER */}
      <header className="max-w-[1600px] w-[95%] mx-auto flex items-center justify-between pb-6 mb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Annotation Statistics & Analytics</h1>
          <p className="text-gray-500 mt-1">Track your OCR correction workflow and audit history</p>
        </div>
        <div className="flex gap-3 items-center">
          {user && (
            <span className="font-semibold text-gray-700 mr-2 flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
              👤 {user.username}
            </span>
          )}
          <Link 
            href="/" 
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl shadow-sm transition-all font-bold cursor-pointer"
          >
            <span>←</span> Back to Annotation
          </Link>
          {user && (
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-xl shadow-sm transition-colors cursor-pointer font-bold"
            >
              🚪 Logout
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] w-[95%] mx-auto flex flex-col gap-8 pb-12">
        
        {/* TAB NAVIGATION */}
        <div className="flex bg-gray-200/50 p-1.5 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab("summary")} 
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'summary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Summary
          </button>
          <button 
            onClick={() => setActiveTab("pages")} 
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'pages' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Page Details <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'pages' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200/80 text-gray-500'}`}>{pages.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab("logs")} 
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Logs <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'logs' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200/80 text-gray-500'}`}>{logs.length}</span>
          </button>
        </div>

        {/* SECTION 1: SUMMARY STATISTICS */}
        {activeTab === "summary" && (
          <section className="flex flex-col gap-4 animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>📊</span> Summary Statistics
            </h2>
            <div className="flex overflow-x-auto flex-nowrap gap-5 pb-4 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              
              <div className="min-w-[200px] flex-shrink-0 flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
                <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-2">📄 Pages</span>
                <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.total_pages_corrected || 0}</span>
              </div>

              <div className="min-w-[200px] flex-shrink-0 flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
                <span className="text-sm font-semibold text-red-600 uppercase tracking-wider flex items-center gap-2">🗑️ Deleted</span>
                <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.bbox_deleted || 0}</span>
              </div>

              <div className="min-w-[200px] flex-shrink-0 flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
                <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">➕ Created</span>
                <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.bbox_created || 0}</span>
              </div>

              <div className="min-w-[200px] flex-shrink-0 flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                <span className="text-sm font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-2">📐 Edited</span>
                <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.bbox_edited || 0}</span>
              </div>

              <div className="min-w-[200px] flex-shrink-0 flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2">📝 Text</span>
                <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.text_edited || 0}</span>
              </div>

              <div className="min-w-[220px] flex-shrink-0 flex-1 bg-violet-50 p-6 rounded-2xl shadow-sm border border-violet-100 flex flex-col justify-between border-l-4 border-l-violet-500 hover:shadow-md transition-shadow">
                <span className="text-sm font-semibold text-violet-600 uppercase tracking-wider flex items-center gap-2">📊 Total Corrections</span>
                <span className="text-4xl font-extrabold text-violet-700 mt-2">{summary?.total_corrections || 0}</span>
              </div>

              <div className="min-w-[220px] flex-shrink-0 flex-1 bg-fuchsia-50 p-6 rounded-2xl shadow-sm border border-fuchsia-100 flex flex-col justify-between border-l-4 border-l-fuchsia-500 hover:shadow-md transition-shadow">
                <span className="text-sm font-semibold text-fuchsia-600 uppercase tracking-wider flex items-center gap-2">⏱️ Total Time</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl font-extrabold text-fuchsia-700">{summary?.total_time_spent?.toFixed(1) || 0}</span>
                  <span className="text-lg font-bold text-fuchsia-600">min</span>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* SECTION 2: PAGE-WISE DETAILS */}
        {activeTab === "pages" && (
          <section className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>📄</span> Page-wise Details
              </h2>
              <div className="flex items-center">
                <input 
                  type="text" 
                  placeholder="Search by Page No..." 
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
                <table className="w-full text-left border-collapse text-sm min-w-[800px]">
                  <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 z-10 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.1)]">
                    <tr>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("page_number")}>Page No {getSortIcon("page_number")}</th>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("source_file_type")}>Type {getSortIcon("source_file_type")}</th>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("total_pages")}>Total Pages {getSortIcon("total_pages")}</th>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("bbox_deleted")}>Deleted {getSortIcon("bbox_deleted")}</th>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("bbox_created")}>Created {getSortIcon("bbox_created")}</th>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("bbox_edited")}>Edited {getSortIcon("bbox_edited")}</th>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("text_edited")}>Text Edited {getSortIcon("text_edited")}</th>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("total_corrections")}>Total {getSortIcon("total_corrections")}</th>
                      <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handlePageSort("time_spent")}>Time {getSortIcon("time_spent")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAndSortedPages.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No page details found.</td>
                      </tr>
                    ) : (
                      filteredAndSortedPages.map((p, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/50 transition-colors even:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">Page {p.page_number} <span className="text-xs text-gray-400 ml-1">(Doc #{p.document_id})</span></td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-semibold uppercase">{p.source_file_type || "IMAGE"}</td>
                          <td className="px-4 py-3 text-gray-600">{p.total_pages || 1}</td>
                          <td className="px-4 py-3 text-gray-600">{p.bbox_deleted}</td>
                          <td className="px-4 py-3 text-gray-600">{p.bbox_created}</td>
                          <td className="px-4 py-3 text-gray-600">{p.bbox_edited}</td>
                          <td className="px-4 py-3 text-gray-600">{p.text_edited}</td>
                          <td className="px-4 py-3">{getTotalCorrectionsBadge(p.total_corrections)}</td>
                          <td className="px-4 py-3 text-gray-600">{p.time_spent?.toFixed(1)} min</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: ANNOTATION LOGS */}
        {activeTab === "logs" && (
          <section className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>⏳</span> Annotation Logs
              </h2>
              <div className="flex items-center gap-3">
                <select 
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option value="All">All Actions</option>
                  <option value="Create">Create</option>
                  <option value="Delete">Delete</option>
                  <option value="Edit">Edit</option>
                </select>
                <input 
                  type="text" 
                  placeholder="Search values..." 
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                <table className="w-full text-left border-collapse text-sm min-w-[700px]">
                  <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 z-10 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.1)]">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Previous</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAndSortedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No logs found.</td>
                      </tr>
                    ) : (
                      filteredAndSortedLogs.map((log, idx) => {
                        const ts = log.timestamp;
                        // Ensure the timestamp is parsed as UTC: append 'Z' if no timezone info present
                        const utcTs = ts && !ts.endsWith('Z') && !ts.includes('+') ? ts + 'Z' : ts;
                        const timeStr = utcTs
                          ? new Date(utcTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : '';
                        // Build a user-friendly location: "filename - Page N" or just filename
                        const locationName = log.filename
                          ? (log.page_number && log.page_number > 1
                              ? `${log.filename} - Page ${log.page_number}`
                              : log.filename)
                          : 'Unknown';
                        return (
                          <tr key={idx} className="hover:bg-indigo-50/50 transition-colors even:bg-gray-50/50 align-top">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{timeStr}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              <div className="flex flex-col max-w-[160px]">
                                <span className="font-semibold truncate" title={locationName}>{locationName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {getActionBadge(log.action_type)}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {renderLogCell(log, 'prev')}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {renderLogCell(log, 'next')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
