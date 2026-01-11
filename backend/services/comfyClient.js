import fs from "fs";
import path from "path";
import axios from "axios";

// Path to your exported workflow JSON (Must be the API FORMAT version)
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

    // 2️⃣ Load workflow (Expects API Format JSON)
    let workflow;
    try {
      workflow = JSON.parse(fs.readFileSync(workflowPath, "utf-8"));
    } catch (e) {
      throw new Error("Failed to parse workflow JSON. Make sure it is valid JSON.");
    }

    // 3️⃣ Update nodes in the API workflow structure
    // In API format, 'workflow' is an object where keys are node IDs.
    const nodeIds = Object.keys(workflow);
    let promptSet = false;

    for (const id of nodeIds) {
      const node = workflow[id];
      
      // Update Text Prompts
      if (node.class_type === "CLIPTextEncode") {
        // In API format, inputs are stored in the "inputs" object
        if (node.inputs) {
            // Note: Depending on your workflow, you might want to differentiate 
            // between positive and negative prompts here. 
            // For now, this sets ALL text nodes to your prompt.
            // You might want to filter by specific node IDs if you have a negative prompt node.
            node.inputs.text = promptText;
            promptSet = true;
        }
      }

      // Update KSampler (Optional: Randomize seed)
      if (node.class_type === "KSampler") {
        if (node.inputs) {
            node.inputs.seed = Math.floor(Math.random() * 1000000000000000); // Random integer seed
        }
      }
    }

    if (!promptSet) {
        console.warn("⚠️ No CLIPTextEncode nodes found to update. Sending workflow as-is.");
    }

    // 4️⃣ Send workflow to ComfyUI
    // IMPORTANT: The key must be "prompt", not "workflow"
    const payload = { 
        prompt: workflow,
        client_id: "tiktok_app_backend" // Optional but good practice
    };

    console.log(`🚀 Sending generation request to ${comfyUrl}...`);

    let response;
    try {
      response = await axios.post(`${comfyUrl}/prompt`, payload, { 
        headers: { "Content-Type": "application/json" },
        timeout: 30000 
      });
    } catch (err) {
      console.error("❌ Failed to send workflow to ComfyUI:", err.message);
      if (err.response) {
          console.error("ComfyUI Response Data:", JSON.stringify(err.response.data, null, 2));
      }
      throw err;
    }

    if (response.status !== 200) {
      throw new Error(`ComfyUI returned ${response.status}`);
    }

    console.log("✅ ComfyUI accepted job:", response.data);

  } catch (err) {
    console.error("❌ ComfyUI image generation failed:", err.message);
    throw err;
  }
}