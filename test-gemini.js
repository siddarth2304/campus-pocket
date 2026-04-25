import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyAwFyHSTgoRQ0sj-J3QSnAs5grqesQiQlU");

async function testModel(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello");
    console.log(`Success with ${modelName}:`, result.response.text());
  } catch (e) {
    console.log(`Failed with ${modelName}:`, e.message);
  }
}

async function run() {
  await testModel("gemini-1.5-flash");
  await testModel("gemini-1.5-flash-latest");
  await testModel("gemini-pro");
}

run();
