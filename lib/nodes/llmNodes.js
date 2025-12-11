import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini client (must be latest SDK)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use latest stable model
const model = genAI.getGenerativeModel({
  model: "gemini-flash-latest",
});

// Small helper: Retry API call (Gemini sometimes drops requests)
async function safeGenerate(model, prompt, retries = 2) {
  try {
    return await model.generateContent(prompt);
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 300));
      return await safeGenerate(model, prompt, retries - 1);
    }
    throw err;
  }
}

/**
 * Query Generator Node
 * Converts natural language question to SQL query
 */
export async function generateQuery(
  question,
  schema,
  previousAttempt = null,
  feedback = null
) {
  const schemaContext = formatSchemaForPrompt(schema);

  let prompt = `You are a PostgreSQL SQL expert. Generate a SQL query based on the user's question.

${schemaContext}

Rules:
- Generate ONLY SELECT queries (no INSERT, UPDATE, DELETE, DROP, etc.)
- Use proper PostgreSQL syntax
- Include appropriate WHERE clauses, JOINs, and aggregations as needed
- Return ONLY the SQL query with no markdown, no explanation
- Do not include semicolons at the end
- Use table and column names exactly as shown in the schema

User Question: ${question}
`;

  // Append correction context if needed
  if (previousAttempt && feedback) {
    prompt += `
Previous attempt failed:
${previousAttempt}

Feedback:
${feedback}

Generate a corrected SQL query only.
`;
  }

  try {
    const result = await safeGenerate(model, prompt);
    const sqlQuery = result.response.text().trim();

    return {
      success: true,
      query: cleanSQL(sqlQuery),
      rawResponse: sqlQuery,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Summary Node
 * Converts query results to natural language answer
 */
export async function summarizeResults(question, queryResults, sqlQuery) {
  const prompt = `
You are a helpful assistant that explains database query results in natural, simple language.

User Question:
${question}

SQL Query:
${sqlQuery}

Query Results:
${JSON.stringify(queryResults.rows, null, 2)}

Row Count: ${queryResults.rowCount}
Execution Time: ${queryResults.executionTime}

Task:
Provide a clear, meaningful summary for the user based on these results.
`;

  try {
    const result = await safeGenerate(model, prompt);
    return {
      success: true,
      summary: result.response.text().trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Helper: Format schema into readable text
 */
function formatSchemaForPrompt(schema) {
  let formatted = "Database Schema:\n\n";

  for (const [tableName, columns] of Object.entries(schema)) {
    formatted += `Table: ${tableName}\n`;
    formatted += "Columns:\n";
    columns.forEach((col) => {
      formatted += `  - ${col.column} (${col.type})${
        col.nullable ? " NULL" : " NOT NULL"
      }`;
      if (col.default) formatted += ` DEFAULT ${col.default}`;
      formatted += "\n";
    });
    formatted += "\n";
  }

  return formatted;
}

/**
 * Helper: Clean LLM output to valid SQL
 */
function cleanSQL(text) {
  let sql = text.trim();

  sql = sql.replace(/```sql/gi, "");
  sql = sql.replace(/```/g, "");
  sql = sql.replace(/;$/, "");

  return sql.trim();
}
