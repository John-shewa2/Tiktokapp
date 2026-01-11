import mongoose from "mongoose";

const imageJobSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
    },
    projectId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"], // 'processing' added
      default: "pending",
    },
    imagePath: {
      type: String, // path where the generated image is saved
    },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

const ImageJob = mongoose.models.ImageJob || mongoose.model("ImageJob", imageJobSchema);

export default ImageJob;
