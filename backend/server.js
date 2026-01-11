import express from "express";
import dotenv from "dotenv";
import cors from "cors"; // Added cors
import path from "path"; // Added path
import connectDB from "./config/db.js";
import imageRoutes from "./routes/imageRoutes.js";
import { processImageQueue } from "./services/imageQueue.js";

dotenv.config();
connectDB();

const app = express();

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Serve generated images statically so frontend can display them
// Access at: http://localhost:5000/generated_images/PROJECT_ID/IMAGE_NAME.png
const __dirname = path.resolve();
app.use("/generated_images", express.static(path.join(__dirname, "generated_images")));

// Routes
app.use("/api/images", imageRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start processing queue automatically
  processImageQueue();
});