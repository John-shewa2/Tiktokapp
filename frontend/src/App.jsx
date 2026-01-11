import { useState, useEffect } from "react";
import axios from "axios";

// Helper to generate a random ID for the project
const generateId = () => Math.random().toString(36).substr(2, 9);

// Configuration - matches your backend URL
const API_URL = "http://localhost:5000";

function App() {
  const [promptsText, setPromptsText] = useState("");
  const [projectId, setProjectId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for updates when a project is active
  useEffect(() => {
    let interval;
    if (projectId) {
      interval = setInterval(fetchStatus, 3000); // Check every 3 seconds
    }
    return () => clearInterval(interval);
  }, [projectId]);

  const fetchStatus = async () => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API_URL}/api/images/${projectId}`);
      setJobs(res.data);
      
      // Stop polling if all completed or failed
      const allFinished = res.data.every(job => 
        job.status === "completed" || job.status === "failed"
      );
      if (allFinished && res.data.length > 0) {
        // Optional: clearInterval here if you want to stop polling strictly
      }
    } catch (err) {
      console.error("Error polling status:", err);
    }
  };

  const handleSubmit = async () => {
    // Split by new line and filter empty strings
    const prompts = promptsText.split("\n").filter(p => p.trim() !== "");

    if (prompts.length === 0) {
      alert("Please enter at least one prompt.");
      return;
    }

    setIsLoading(true);
    const newProjectId = generateId();
    setProjectId(newProjectId);

    try {
      await axios.post(`${API_URL}/api/images`, {
        projectId: newProjectId,
        prompts: prompts
      });
      // Immediate fetch to show pending state
      fetchStatus();
    } catch (err) {
      console.error("Error creating jobs:", err);
      alert("Failed to start generation.");
    } finally {
      setIsLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";
    // Convert local file path to server URL
    // Backend saves as: "generated_images\projectId\image_01.png"
    // We need: "http://localhost:5000/generated_images/projectId/image_01.png"
    const relativePath = imagePath.split("generated_images")[1];
    // Replace backslashes (Windows) with forward slashes for URL
    const cleanPath = relativePath.replace(/\\/g, "/");
    return `${API_URL}/generated_images${cleanPath}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-400">
          AI Image Generator
        </h1>

        {/* Input Section */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg mb-8">
          <label className="block mb-2 text-sm font-medium text-slate-300">
            Enter 11 Prompts (One per line)
          </label>
          <textarea
            className="w-full h-64 p-4 bg-slate-700 rounded border border-slate-600 focus:border-blue-500 focus:outline-none text-sm font-mono"
            placeholder="A cinematic shot of a cyberpunk city...&#10;A cute cat in space..."
            value={promptsText}
            onChange={(e) => setPromptsText(e.target.value)}
          ></textarea>
          
          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-slate-400">
              Count: {promptsText.split("\n").filter(p => p.trim()).length}
            </span>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !!projectId}
              className={`px-6 py-2 rounded font-semibold transition-colors ${
                isLoading || projectId
                  ? "bg-slate-600 cursor-not-allowed text-slate-400"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {isLoading ? "Starting..." : projectId ? "Processing..." : "Generate Images"}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {jobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div 
                key={job._id} 
                className={`bg-slate-800 rounded-lg overflow-hidden shadow-lg border ${
                  job.status === "processing" ? "border-blue-500/50" : "border-slate-700"
                }`}
              >
                <div className="aspect-[9/16] bg-black relative flex items-center justify-center">
                  {job.status === "completed" ? (
                    <img 
                      src={getImageUrl(job.imagePath)} 
                      alt="Generated" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-4">
                      {job.status === "pending" && (
                        <span className="text-yellow-500 animate-pulse">Waiting...</span>
                      )}
                      {job.status === "processing" && (
                        <span className="text-blue-400 animate-pulse">Generating...</span>
                      )}
                      {job.status === "failed" && (
                        <span className="text-red-500">Failed</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3 h-8">
                    {job.prompt}
                  </p>
                  
                  {job.status === "completed" && (
                    <a
                      href={getImageUrl(job.imagePath)}
                      download={`image-${job._id}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm font-medium"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;