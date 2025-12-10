import express from "express";
import dotenv from "dotenv";
import { sqlQueryAgent } from "./lib/agent.js";

dotenv.config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/**
 * SQL Query Agent Endpoint
 * Accepts natural language questions and returns SQL query results
 */
app.post("/ask", async (req, res) => {
  try {
    const { question, debug = false, maxRows = 100 } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "Missing 'question' field in request body",
      });
    }

    console.log(`\n📊 Processing question: "${question}"`);

    const result = await sqlQueryAgent(question, {
      debug,
      maxRows,
      maxRetries: 3,
    });

    if (result.success) {
      console.log(`✓ Success! Returned ${result.data.rowCount} rows in ${result.data.executionTime}`);
      
      res.json({
        success: true,
        answer: result.answer,
        query: result.query,
        data: result.data,
        metadata: result.metadata,
        trace: result.trace,
      });
    } else {
      console.log(`✗ Failed: ${result.error}`);
      
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        trace: result.trace,
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message,
    });
  }
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "SQL Query Agent" });
});

/**
 * Root endpoint with API documentation
 */
app.get("/", (req, res) => {
  res.json({
    service: "SQL Query Agent API",
    version: "1.0.0",
    endpoints: {
      "POST /ask": {
        description: "Ask a question in natural language and get SQL query results",
        body: {
          question: "string (required) - Your question about the database",
          debug: "boolean (optional) - Enable debug trace output",
          maxRows: "number (optional) - Maximum rows to return (default: 100)",
        },
        example: {
          question: "How many users are in the database?",
          debug: false,
          maxRows: 100,
        },
      },
      "GET /health": "Health check endpoint",
    },
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 SQL Query Agent Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`\n💡 Try: POST /ask with { "question": "your question here" }\n`);
});
