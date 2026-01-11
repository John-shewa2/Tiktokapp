import express from "express";
import { createImageJobs } from "../controllers/imageController.js";

const router = express.Router();

/**
 * @route   POST /api/images
 * @desc    Create image jobs for a project and start the ComfyUI queue
 * @body    { projectId: String, prompts: [String] }
 */
router.post("/", createImageJobs);

export default router;
