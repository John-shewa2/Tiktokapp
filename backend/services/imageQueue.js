import ImageJob from "../models/ImageJob.js";
import { generateImageFromComfy } from "./comfyClient.js";
import fs from "fs";
import path from "path";

let isProcessing = false;

export async function processImageQueue() {
  // FIX: Read env variable inside the function to ensure .env is loaded
  const comfyOutputDir = process.env.COMFY_OUTPUT_DIR;

  if (!comfyOutputDir) {
    console.error("❌ COMFY_OUTPUT_DIR is not defined in .env");
    return;
  }

  if (isProcessing) return;
  isProcessing = true;

  try {
    const job = await ImageJob.findOne({ status: "pending" }).sort({ createdAt: 1 });
    if (!job) {
      isProcessing = false;
      return;
    }

    console.log("🎨 Generating image for:", job.prompt);

    // Mark job as processing
    job.status = "processing";
    await job.save();

    // Snapshot files in Comfy output dir before generation so we can reliably
    // detect newly created images rather than picking an unrelated existing file.
    const beforeFiles = new Set();
    let startTime = Date.now();
    
    // Ensure output dir exists before trying to read it
    if (fs.existsSync(comfyOutputDir)) {
      for (const f of fs.readdirSync(comfyOutputDir).filter(f => f.endsWith('.png'))) {
        beforeFiles.add(f);
      }
    } else {
       console.warn(`⚠️ Comfy output directory not found at start: ${comfyOutputDir}`);
    }

    // Generate image via ComfyUI (rethrow on error)
    try {
      await generateImageFromComfy(job.prompt);
    } catch (err) {
      console.error('❌ generateImageFromComfy threw:', err.message);
      job.status = 'failed';
      job.error = err.message;
      await job.save();
      isProcessing = false;
      // schedule next check and return
      setTimeout(processImageQueue, 1000);
      return;
    }

    // Wait for ComfyUI output folder to contain a new image (created after startTime)
    let attempts = 0;
    let latestFile = null;

    while (attempts < 60) { // wait up to ~60 seconds
      if (fs.existsSync(comfyOutputDir)) {
        const files = fs.readdirSync(comfyOutputDir)
          .filter(f => f.endsWith('.png'))
          .map(f => ({
            name: f,
            time: fs.statSync(path.join(comfyOutputDir, f)).mtime.getTime()
          }))
          .sort((a, b) => b.time - a.time);

        // find the first file that was not present before and has mtime > startTime
        const newFile = files.find(f => !beforeFiles.has(f.name) || f.time >= startTime);
        if (newFile) {
          latestFile = newFile.name;
          break;
        }
      } else {
        console.warn('Comfy output dir does not exist:', comfyOutputDir);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!latestFile) {
      throw new Error("No image found in ComfyUI output folder after waiting.");
    }

    // Prepare project folder
    const projectDir = path.join("generated_images", job.projectId);
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

    // Count existing images for sequential naming
    const existingFiles = fs.readdirSync(projectDir).filter(f => f.endsWith(".png"));
    const imageNumber = (existingFiles.length + 1).toString().padStart(2, "0");

    const oldPath = path.join(comfyOutputDir, latestFile);
    const newFileName = `image_${imageNumber}.png`;
    const newPath = path.join(projectDir, newFileName);

    // Move file
    // Note: Using renameSync across different drives (e.g. C: to D:) can fail. 
    // If your project and ComfyUI are on different drives, use copyFileSync + unlinkSync instead.
    fs.renameSync(oldPath, newPath);

    // Update job
    job.status = "completed";
    job.imagePath = newPath;
    await job.save();

    console.log("✅ Image saved to:", newPath);

  } catch (err) {
    console.error("❌ Image generation failed:", err.message);
    // Mark the current processing job as failed
    await ImageJob.findOneAndUpdate({ status: "processing" }, { status: "failed" });
  } finally {
    isProcessing = false;
    // Continue processing next job after 1 second
    setTimeout(processImageQueue, 1000);
  }
}