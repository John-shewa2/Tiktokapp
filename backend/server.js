import express from "express";
import dotenv from "dotenv";
import cors from "cors"; // Import cors
import path from "path"; // Import path
import connectDB from "./config/db.js";
import imageRoutes from "./routes/imageRoutes.js";
import { processImageQueue } from "./services/imageQueue.js";

dotenv.config();
connectDB();

const app = express();

// 1. Configure CORS to allow your Frontend to talk to the Backend
app.use(cors({
  origin: "http://localhost:5173", // Allow the Vite frontend URL
  methods: ["GET", "POST"],       // Allow these HTTP methods
  allowedHeaders: ["Content-Type"] // Allow standard headers
}));

app.use(express.json());

// 2. Serve the generated images folder statically
// This allows the frontend to load images via http://localhost:5000/generated_images/...
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