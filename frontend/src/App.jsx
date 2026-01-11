import { useState, useEffect, useRef } from "react";
import axios from "axios";

// Helper: Generate random ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper: Clean Google Sheets paste artifacts (e.g., wrapping quotes)
const cleanCSVInput = (text) => {
  return text.split("\n").map(line => {
    let clean = line.trim();
    // Remove wrapping double quotes often added by Excel/Sheets
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.slice(1, -1);
      // Unescape double double-quotes ("") to single quote (")
      clean = clean.replace(/""/g, '"');
    }
    return clean;
  }).join("\n");
};

// Config
const API_URL = "http://localhost:5000";

function App() {
  const [promptsText, setPromptsText] = useState("");
  const [projectId, setProjectId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  
  // Refs for syncing scroll between line numbers and textarea
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Sync scroll
  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Poll for status
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

  const handlePaste = (e) => {
    // Optional: Intercept paste to clean immediately, 
    // but standard onChange + helper usually handles it fine.
    // This allows the user to see the raw paste, then we clean it on render/submit 
    // or we can clean it right here:
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const cleaned = cleanCSVInput(pastedData);
    
    // Insert cleaned text at cursor position (simple version: just append or replace)
    // For simplicity in this specific use case (bulk import), we append or set.
    // If input is empty, just set it.
    if (!promptsText) {
        setPromptsText(cleaned);
    } else {
        // Standard behavior fallback if they are editing mid-string is complex,
        // so let's just append or let React handle it via standard onChange if strictly needed.
        // But for "Paste from Sheets", replacing/appending is common.
        // Let's stick to standard behavior but allow the user to click "Clean" if needed,
        // OR just parse correctly on submit. 
        // Actually, let's just let the default paste happen and clean on Submit.
        // Reverting preventDefault to allow normal pasting.
    }
  };

  const handleSubmit = async () => {
    // 1. Clean the input first
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
    } catch (err) {
      console.error("Error creating jobs:", err);
      alert("Failed to start generation.");
      setProjectId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Start a new batch? This will clear current results.")) {
        setProjectId(null);
        setJobs([]);
        setPromptsText("");
        setProgress({ completed: 0, total: 0 });
    }
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

  // derived state for line numbers
  const lines = promptsText.split("\n");
  const lineCount = Math.max(lines.length, 11); // Minimum 11 lines for visual cue

  return (
    <div className="min-h-screen bg-gray-100 text-slate-800 font-sans p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
               Sheet
             </div>
             <h1 className="text-2xl font-bold text-slate-800">Batch Image Generator</h1>
          </div>
          {projectId && (
            <button 
                onClick={handleReset}
                className="text-sm font-medium text-slate-500 hover:text-red-500 transition-colors border px-4 py-2 rounded-lg hover:border-red-200"
            >
                Start New Batch
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Spreadsheet Input */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Input Container */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-300 overflow-hidden flex flex-col h-[600px]">
              {/* Toolbar */}
              <div className="bg-gray-50 border-b border-gray-200 p-3 flex justify-between items-center">
                 <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Paste from Sheets
                 </span>
                 <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-mono">
                    {lines.filter(l => l.trim()).length} Rows
                 </span>
              </div>

              {/* Editor Area */}
              <div className="flex-1 flex relative">
                {/* Line Numbers */}
                <div 
                    ref={lineNumbersRef}
                    className="w-12 bg-gray-50 border-r border-gray-200 text-right pt-4 pb-4 pr-2 text-gray-400 font-mono text-sm leading-6 select-none overflow-hidden"
                >
                    {Array.from({ length: lineCount }).map((_, i) => (
                        <div key={i} className="h-6">{i + 1}</div>
                    ))}
                </div>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    onScroll={handleScroll}
                    className="flex-1 p-4 bg-white resize-none focus:outline-none font-mono text-sm leading-6 text-slate-700 whitespace-nowrap overflow-auto"
                    placeholder="Paste your column here..."
                    value={promptsText}
                    onChange={(e) => setPromptsText(e.target.value)}
                    disabled={!!projectId}
                    style={{ minHeight: "100%" }}
                    wrap="off" 
                ></textarea>
              </div>

              {/* Footer / Action */}
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !!projectId}
                  className={`w-full py-3 rounded-lg font-bold shadow-sm transition-all ${
                    isLoading || projectId
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white shadow-green-600/20"
                  }`}
                >
                  {isLoading ? "Validating..." : projectId ? "Processing..." : "Generate Images"}
                </button>
              </div>
            </div>
            
            {/* Progress Bar (Only visible when active) */}
            {projectId && (
                <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase">
                        <span>Progress</span>
                        <span>{Math.round((progress.completed / progress.total) * 100) || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-center mt-3 text-xs text-gray-400">
                        {progress.completed} / {progress.total} Completed
                    </p>
                </div>
            )}
          </div>

          {/* RIGHT COLUMN: Results Grid */}
          <div className="lg:col-span-8">
            {jobs.length === 0 ? (
                <div className="h-full bg-white rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 min-h-[500px]">
                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <p className="font-medium">Waiting for data...</p>
                    <p className="text-sm">Paste prompts from Sheets to the left</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {jobs.map((job, idx) => (
                    <div 
                        key={job._id} 
                        className="group relative aspect-[9/16] bg-gray-900 rounded-xl overflow-hidden shadow-md border border-gray-200"
                    >
                        {job.status === "completed" ? (
                            <>
                                <img 
                                    src={getImageUrl(job.imagePath)} 
                                    alt={`Gen ${idx}`} 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        onClick={() => forceDownload(getImageUrl(job.imagePath), `image_${idx + 1}.png`)}
                                        className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-transform shadow-xl"
                                    >
                                        Download
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gray-50">
                                {job.status === "pending" && (
                                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
                                )}
                                {job.status === "processing" && (
                                    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                )}
                                {job.status === "failed" && (
                                    <span className="text-red-500 font-bold">Failed</span>
                                )}
                                <span className="mt-2 text-xs text-gray-400 font-mono uppercase">
                                    {job.status}
                                </span>
                            </div>
                        )}
                        {/* Row Number Badge */}
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono backdrop-blur-sm">
                            Row {idx + 1}
                        </div>
                    </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;