import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import imageRoutes from "./routes/imageRoutes.js";
import { processImageQueue } from "./services/imageQueue.js";

dotenv.config();
connectDB();

const app = express();
app.use(express.json());

// Routes
app.use("/api/images", imageRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start processing queue automatically
  processImageQueue();
});
