import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const imageModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-image-preview",
});

const run = async () => {
  try {
    const result = await imageModel.generateContent(
      "A minimalist illustration of a philosopher sitting under a night sky"
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  }
};

run();
