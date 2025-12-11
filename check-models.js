import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    console.log("Fetching available models...\n");
    
    // Try to list models
    const models = await genAI.listModels();
    
    console.log("Available models that support generateContent:\n");
    
    for await (const model of models) {
      if (model.supportedGenerationMethods.includes('generateContent')) {
        console.log(`✓ ${model.name}`);
        console.log(`  Display Name: ${model.displayName}`);
        console.log(`  Description: ${model.description}`);
        console.log("");
      }
    }
  } catch (error) {
    console.error("Error listing models:", error.message);
    console.log("\nTrying common model names directly...\n");
    
    // Test common model names
    const testModels = [
      "gemini-pro",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.0-pro",
      "models/gemini-pro",
      "models/gemini-1.5-flash",
    ];
    
    for (const modelName of testModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hello");
        console.log(`✓ ${modelName} - WORKS`);
      } catch (err) {
        console.log(`✗ ${modelName} - ${err.message.split('\n')[0]}`);
      }
    }
  }
}

listModels();
