import ImageJob from "../models/ImageJob.js";
import { processImageQueue } from "../services/imageQueue.js";

/**
 * Create multiple image jobs from a list of prompts for a project.
 * Starts the image generation queue automatically.
 */
export async function createImageJobs(req, res) {
  try {
    const { prompts, projectId } = req.body;

    // Validate projectId
    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({ message: "projectId is required and must be a string" });
    }

    // Validate prompts
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ message: "Prompts array is required" });
    }

    // Create ImageJob entries in MongoDB
    const createdJobs = [];
    for (const prompt of prompts) {
      const job = await ImageJob.create({
        prompt,
        projectId,
        status: "pending",
      });
      createdJobs.push(job);
    }

    // Start processing queue (if not already running)
    processImageQueue();

    return res.status(201).json({
      message: "Image jobs created and queue started",
      jobsCreated: createdJobs.length,
      projectId,
    });
  } catch (err) {
    console.error("Error creating image jobs:", err);
    return res.status(500).json({
      message: "Server error creating image jobs",
      error: err.message,
    });
  }
}
