"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStatisticsSummary, getStatisticsPages, getStatisticsLogs } from "../../services/api";

export default function StatisticsPage() {
  const [summary, setSummary] = useState<any | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      <header className="max-w-[1600px] w-[95%] mx-auto flex items-center justify-between pb-6 mb-8 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Annotation Statistics & Analytics</h1>
          <p className="text-gray-500 mt-1">Track your OCR correction workflow and audit history</p>
        </div>
        <Link 
          href="/" 
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl shadow-sm transition-all font-bold cursor-pointer"
        >
          <span>←</span> Back to Annotation
        </Link>
      </header>

      <main className="max-w-[1600px] w-[95%] mx-auto flex flex-col gap-10 pb-12">
        
        {/* SECTION 1: SUMMARY STATISTICS */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>📊</span> Summary Statistics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Pages Corrected</span>
              <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.total_pages_corrected || 0}</span>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">BBoxes Deleted</span>
              <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.bbox_deleted || 0}</span>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">BBoxes Created</span>
              <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.bbox_created || 0}</span>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">BBoxes Edited</span>
              <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.bbox_edited || 0}</span>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Text Edits</span>
              <span className="text-4xl font-extrabold text-gray-900 mt-2">{summary?.text_edited || 0}</span>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-violet-500 hover:shadow-md transition-shadow">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Corrections</span>
              <span className="text-4xl font-extrabold text-violet-600 mt-2">{summary?.total_corrections || 0}</span>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between border-l-4 border-l-fuchsia-500 hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Time Spent</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-gray-900">{summary?.total_time_spent?.toFixed(1) || 0}</span>
                <span className="text-lg font-bold text-gray-500">min</span>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 2: PAGE-WISE DETAILS */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>📄</span> Page-wise Details
          </h2>
          {pages.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-500 shadow-sm">
              No page corrections recorded yet. Start annotating to see page-wise breakdown.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pages.map((p, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span className="font-bold text-lg text-indigo-600">Doc #{p.document_id} — Page {p.page_number}</span>
                    <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
                      {p.time_spent?.toFixed(1)} min
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between bg-gray-50 p-2.5 rounded-lg">
                      <span className="text-gray-500 font-medium">Deleted:</span>
                      <span className="font-bold text-gray-900">{p.bbox_deleted}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 p-2.5 rounded-lg">
                      <span className="text-gray-500 font-medium">Created:</span>
                      <span className="font-bold text-gray-900">{p.bbox_created}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 p-2.5 rounded-lg">
                      <span className="text-gray-500 font-medium">Edited:</span>
                      <span className="font-bold text-gray-900">{p.bbox_edited}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 p-2.5 rounded-lg">
                      <span className="text-gray-500 font-medium">Text Edited:</span>
                      <span className="font-bold text-gray-900">{p.text_edited}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Corrections</span>
                    <span className="font-extrabold text-violet-600 text-base">{p.total_corrections}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: ANNOTATION LOGS */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>⏳</span> Annotation Logs (Audit Trail)
          </h2>
          {logs.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-500 shadow-sm">
              No annotation activity logged yet.
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">
                {logs.map((log, idx) => {
                  const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div key={idx} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded shrink-0">
                          {timeStr}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            {log.action_type === "Delete Bounding Box" && <span className="text-red-500">🗑️</span>}
                            {log.action_type === "Create Bounding Box" && <span className="text-emerald-500">➕</span>}
                            {log.action_type === "Edit Bounding Box" && <span className="text-amber-500">📐</span>}
                            {log.action_type === "Edit Text" && <span className="text-blue-500">📝</span>}
                            {log.action_type}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">Doc #{log.document_id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-100 self-start sm:self-auto max-w-full overflow-x-auto">
                        {log.previous_value && log.previous_value !== "None" && (
                          <>
                            <span className="text-red-600 line-through truncate max-w-[200px]">{log.previous_value}</span>
                            <span className="text-gray-400 font-bold">→</span>
                          </>
                        )}
                        <span className="text-emerald-600 font-bold truncate max-w-[200px]">{log.updated_value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
