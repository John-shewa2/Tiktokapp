import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { format } from "date-fns"; // Optional: npm install date-fns for nice dates, or use native JS

// Helper: Generate random ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper: Clean Google Sheets paste artifacts
const cleanCSVInput = (text) => {
  return text.split("\n").map(line => {
    let clean = line.trim();
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.slice(1, -1).replace(/""/g, '"');
    }
    return clean;
  }).join("\n");
};

const API_URL = "http://localhost:5000";

function App() {
  const [promptsText, setPromptsText] = useState("");
  const [projectId, setProjectId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]); // Store past batches
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [showHistory, setShowHistory] = useState(false); // Toggle sidebar on mobile

  // Refs for editor sync
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // 1. Fetch History on Load
  useEffect(() => {
    fetchHistory();
  }, [projectId]); // Refresh history when a project changes/finishes

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/images/history`);
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  // 2. Poll for Status
  useEffect(() => {
    let interval;
    if (projectId) {
      fetchStatus();
      interval = setInterval(fetchStatus, 2000);
    }
    return () => clearInterval(interval);
  }, [projectId]);

  const fetchStatus = async () => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API_URL}/api/images/${projectId}`);
      const currentJobs = res.data;
      setJobs(currentJobs);

      const completed = currentJobs.filter(j => j.status === "completed" || j.status === "failed").length;
      setProgress({ completed, total: currentJobs.length });
    } catch (err) {
      console.error("Error polling status:", err);
    }
  };

  const handleSubmit = async () => {
    const rawLines = promptsText.split("\n");
    const cleanedPrompts = rawLines
      .map(line => {
        let p = line.trim();
        if (p.startsWith('"') && p.endsWith('"')) {
            p = p.slice(1, -1).replace(/""/g, '"');
        }
        return p;
      })
      .filter(p => p !== "");

    if (cleanedPrompts.length === 0) {
      alert("Please enter at least one prompt.");
      return;
    }

    setIsLoading(true);
    const newProjectId = generateId();
    setProjectId(newProjectId);
    setJobs([]);
    setProgress({ completed: 0, total: cleanedPrompts.length });

    try {
      await axios.post(`${API_URL}/api/images`, {
        projectId: newProjectId,
        prompts: cleanedPrompts
      });
      // Refresh history immediately so the new one appears
      fetchHistory();
    } catch (err) {
      console.error("Error creating jobs:", err);
      alert("Failed to start generation.");
      setProjectId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoryItem = (histProjectId) => {
    if (projectId === histProjectId) return;
    if (projectId && !window.confirm("Switching batches will clear your current view. Continue?")) return;
    
    setProjectId(histProjectId);
    // Fetch the jobs for this ID immediately
    // Note: We don't populate promptsText because we don't have the original raw text easily, 
    // but the user can see the prompts in the result cards.
    setPromptsText(""); 
  };

  const handleReset = () => {
    setProjectId(null);
    setJobs([]);
    setPromptsText("");
    setProgress({ completed: 0, total: 0 });
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";
    const relativePath = imagePath.split("generated_images")[1];
    return `${API_URL}/generated_images${relativePath.replace(/\\/g, "/")}`;
  };

  const forceDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  // Derived state
  const lines = promptsText.split("\n");
  const lineCount = Math.max(lines.length, 11);

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-slate-800 overflow-hidden">
      
      {/* SIDEBAR: History */}
      <div className={`w-64 bg-slate-900 flex-shrink-0 flex flex-col transition-all duration-300 border-r border-slate-800 ${showHistory ? 'translate-x-0' : '-translate-x-64'} fixed md:relative md:translate-x-0 z-20 h-full`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-white font-bold text-lg">Batch History</h2>
            <button onClick={() => setShowHistory(false)} className="md:hidden text-slate-400">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <button 
                onClick={handleReset}
                className="w-full text-left p-3 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-3 transition-colors border border-dashed border-slate-700 hover:border-blue-500 hover:text-white"
            >
                <span className="text-xl">+</span> New Batch
            </button>
            
            {history.map((item) => (
                <button
                    key={item._id}
                    onClick={() => loadHistoryItem(item._id)}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all ${
                        projectId === item._id 
                        ? "bg-blue-600 text-white shadow-lg" 
                        : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                >
                    {/* Tiny Thumbnail */}
                    <div className="w-10 h-10 rounded bg-slate-950 flex-shrink-0 overflow-hidden border border-slate-700">
                        {item.thumbnail ? (
                            <img src={getImageUrl(item.thumbnail)} className="w-full h-full object-cover opacity-80" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs">?</div>
                        )}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-bold truncate">Batch {item._id.substring(0,6)}</p>
                        <p className="text-[10px] opacity-70">
                            {new Date(item.createdAt).toLocaleDateString()} • {item.completedImages}/{item.totalImages}
                        </p>
                    </div>
                </button>
            ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Mobile Sidebar Toggle */}
        <button 
            onClick={() => setShowHistory(!showHistory)}
            className="md:hidden absolute top-4 left-4 z-10 bg-slate-900 text-white p-2 rounded shadow-lg"
        >
            ☰
        </button>

        <header className="flex-shrink-0 bg-white border-b border-gray-200 p-4 md:px-8 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3 pl-10 md:pl-0">
             <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded flex items-center justify-center text-white font-bold text-sm shadow-sm">
               AI
             </div>
             <h1 className="text-xl font-bold text-slate-800 tracking-tight">Image Generator</h1>
          </div>
          {projectId && (
             <div className="text-xs font-mono bg-gray-100 px-3 py-1 rounded text-gray-500">
                ID: {projectId}
             </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: Input (Only Show if NO project selected, or allow view-only?) */}
            {/* Design Choice: If looking at history, hide input to focus on results, or disable it. */}
            <div className="lg:col-span-4 space-y-4">
                <div className={`bg-white rounded-xl shadow-lg border border-gray-300 overflow-hidden flex flex-col h-[600px] transition-opacity ${projectId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div className="bg-gray-50 border-b border-gray-200 p-3 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase">Input</span>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-mono">
                            {lines.filter(l => l.trim()).length} Rows
                        </span>
                    </div>

                    <div className="flex-1 flex relative">
                        <div 
                            ref={lineNumbersRef}
                            className="w-10 bg-gray-50 border-r border-gray-200 text-right pt-4 pb-4 pr-2 text-gray-400 font-mono text-sm leading-6 select-none"
                        >
                            {Array.from({ length: lineCount }).map((_, i) => (
                                <div key={i} className="h-6">{i + 1}</div>
                            ))}
                        </div>
                        <textarea
                            ref={textareaRef}
                            onScroll={handleScroll}
                            className="flex-1 p-4 bg-white resize-none focus:outline-none font-mono text-sm leading-6 text-slate-700 whitespace-nowrap overflow-auto"
                            placeholder="Paste your 11 prompts here..."
                            value={promptsText}
                            onChange={(e) => setPromptsText(e.target.value)}
                            style={{ minHeight: "100%" }}
                            wrap="off" 
                        ></textarea>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                        <button
                        onClick={handleSubmit}
                        disabled={isLoading || !!projectId}
                        className="w-full py-3 rounded-lg font-bold shadow-sm transition-all bg-green-600 hover:bg-green-700 text-white"
                        >
                        {isLoading ? "Starting..." : projectId ? "Viewing Batch" : "Generate Batch"}
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                {projectId && (
                    <div className="bg-white p-4 rounded-xl shadow border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase">
                            <span>Status</span>
                            <span>{Math.round((progress.completed / progress.total) * 100) || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-center mt-3 text-xs text-gray-400">
                            {progress.completed} of {progress.total} Completed
                        </p>
                    </div>
                )}
            </div>

            {/* RIGHT COLUMN: Results */}
            <div className="lg:col-span-8 h-full">
                {jobs.length === 0 ? (
                    <div className="h-full bg-white rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 min-h-[500px]">
                        <p className="font-medium">No Data Selected</p>
                        <p className="text-sm">Create a new batch or select from history.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4 pb-20">
                        {jobs.map((job, idx) => (
                        <div key={job._id} className="group relative aspect-[9/16] bg-gray-900 rounded-xl overflow-hidden shadow-md border border-gray-200 hover:shadow-xl transition-shadow">
                            {job.status === "completed" ? (
                                <>
                                    <img src={getImageUrl(job.imagePath)} alt={`Gen ${idx}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                                        <button
                                            onClick={() => forceDownload(getImageUrl(job.imagePath), `image_${idx + 1}.png`)}
                                            className="bg-white text-gray-900 px-4 py-2 rounded-full font-bold text-xs transform hover:scale-105 transition-all mb-2"
                                        >
                                            Download
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                                    {job.status === "pending" && <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>}
                                    {job.status === "processing" && <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
                                    {job.status === "failed" && <span className="text-red-500 font-bold">Failed</span>}
                                    <span className="mt-2 text-xs text-gray-400 uppercase">{job.status}</span>
                                </div>
                            )}
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm">
                                #{idx + 1}
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[10px] text-gray-300 line-clamp-2">{job.prompt}</p>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
            </div>
            </div>
        </main>
      </div>
    </div>
  );
}

export default App;