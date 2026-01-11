import express from "express";
import { createImageJobs, getProjectStatus, getAllProjects } from "../controllers/imageController.js";

const router = express.Router();

/**
 * @route   POST /api/images
 * @desc    Create image jobs for a project and start the ComfyUI queue
 * @body    { projectId: String, prompts: [String] }
 */
router.post("/", createImageJobs);

/**
 * @route   GET /api/images/:projectId
 * @desc    Get status of all images in a project
 */

router.get("/history", getAllProjects);
router.get("/:projectId", getProjectStatus);

export default router;