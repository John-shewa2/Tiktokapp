import fs from "fs";
import path from "path";
import axios from "axios";

// Path to your exported workflow JSON
const workflowPath = path.join("comfy", "tiktok_image_workflow.json");
const comfyUrl = process.env.COMFY_URL || "http://127.0.0.1:8188";

/**
 * Generate an image using ComfyUI workflow.
 * Replaces prompt in CLIPTextEncode nodes and sets KSampler parameters.
 * @param {string} promptText - The text prompt to generate an image
 */
export async function generateImageFromComfy(promptText) {
  try {
    // 1️⃣ Check if workflow exists
    if (!fs.existsSync(workflowPath)) {
      throw new Error(`Workflow JSON not found at ${workflowPath}`);
    }
    // 2️⃣ Load workflow
    const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf-8"));

    // 3️⃣ Update nodes in the exported workflow structure (workflow.nodes is an array)
    const clipPrompts = [];
    if (Array.isArray(workflow.nodes)) {
      for (const node of workflow.nodes) {
        // CLIPTextEncode stores prompt in widgets_values[0]
        if (node.type === "CLIPTextEncode") {
          // preserve the trailing newline pattern seen in the exported workflow
          const value = `${promptText}\n`;
          if (!Array.isArray(node.widgets_values)) node.widgets_values = [value];
          else node.widgets_values[0] = value;
          clipPrompts.push(value);
        }

        // KSampler widgets_values from exported file look like:
        // [seed, sampler_mode, steps, cfg, sampler_name, scheduler, denoise]
        if (node.type === "KSampler") {
          if (!Array.isArray(node.widgets_values)) node.widgets_values = [];
          node.widgets_values[0] = -1;    // seed: -1 => random
          node.widgets_values[2] = 20;    // steps
          node.widgets_values[3] = 7.5;   // cfg scale
        }
      }
    } else {
      // Fallback: try to handle older/simpler formats
      console.warn("Comfy workflow shape unexpected: missing nodes array");
    }

    // Write the prepared workflow to disk for debugging inspection
    try {
      const debugPath = path.join("comfy", "last_sent_workflow.json");
      fs.writeFileSync(debugPath, JSON.stringify(workflow, null, 2), "utf-8");
      console.log("Saved prepared workflow for inspection:", debugPath);
    } catch (writeErr) {
      console.warn("Could not write debug workflow file:", writeErr.message);
    }

    // Log CLIP prompts that will be sent to Comfy
    if (clipPrompts.length > 0) {
      console.log("CLIP prompts set in workflow:", clipPrompts);
    } else {
      console.warn("No CLIPTextEncode nodes found in workflow to set prompt.");
    }

    // 4️⃣ Send workflow to ComfyUI and throw on non-200 so callers can handle failure
    const payload = { workflow };
    let response;
    try {
      response = await axios.post(`${comfyUrl}/prompt`, payload, { timeout: 30000 });
    } catch (err) {
      console.error("❌ Failed to send workflow to ComfyUI:", err.message);
      if (err.response) console.error("ComfyUI response:", err.response.status, err.response.data);
      throw err;
    }

    if (response.status !== 200) {
      console.error("❌ ComfyUI returned non-200 status:", response.status, response.data);
      throw new Error(`ComfyUI returned ${response.status}`);
    }

    console.log("✅ ComfyUI workflow sent successfully for prompt:", promptText);

  } catch (err) {
    console.error("❌ ComfyUI image generation failed:", err.message);
    // rethrow so the caller can mark job failed and avoid waiting for an image
    throw err;
  }
}
