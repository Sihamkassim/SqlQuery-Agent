import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

/**
 * Query Generator Node
 * Converts natural language question to SQL query
 */
export async function generateQuery(question, schema, previousAttempt = null, feedback = null) {
  const schemaContext = formatSchemaForPrompt(schema);
  
  let prompt = `You are a PostgreSQL SQL expert. Generate a SQL query based on the user's question.

${schemaContext}

Rules:
- Generate ONLY SELECT queries (no INSERT, UPDATE, DELETE, DROP, etc.)
- Use proper PostgreSQL syntax
- Include appropriate WHERE clauses, JOINs, and aggregations as needed
- Return ONLY the SQL query without explanation or markdown formatting
- Do not include semicolons at the end
- Use table and column names exactly as shown in the schema

User Question: ${question}
`;

  if (previousAttempt && feedback) {
    prompt += `\nPrevious attempt failed safety check:\n${previousAttempt}\n\nFeedback: ${feedback}\n\nGenerate a corrected query.`;
  }

  try {
    const result = await model.generateContent(prompt);
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
  const prompt = `You are a helpful assistant that explains database query results in natural language.

User's Question: ${question}

SQL Query Executed:
${sqlQuery}

Query Results:
${JSON.stringify(queryResults.rows, null, 2)}

Row Count: ${queryResults.rowCount}
Execution Time: ${queryResults.executionTime}

Task: Provide a clear, concise answer to the user's question based on these results. 
- Use natural language, not technical jargon
- Highlight key findings
- If there are many rows, summarize the data meaningfully
- Be direct and helpful

Answer:`;

  try {
    const result = await model.generateContent(prompt);
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
 * Helper: Format schema for prompt
 */
function formatSchemaForPrompt(schema) {
  let formatted = "Database Schema:\n\n";
  
  for (const [tableName, columns] of Object.entries(schema)) {
    formatted += `Table: ${tableName}\n`;
    formatted += "Columns:\n";
    columns.forEach((col) => {
      formatted += `  - ${col.column} (${col.type})${col.nullable ? " NULL" : " NOT NULL"}`;
      if (col.default) formatted += ` DEFAULT ${col.default}`;
      formatted += "\n";
    });
    formatted += "\n";
  }
  
  return formatted;
}

/**
 * Helper: Clean SQL from LLM response
 */
function cleanSQL(text) {
  let sql = text.trim();
  
  // Remove markdown code blocks
  sql = sql.replace(/```sql\n?/gi, "");
  sql = sql.replace(/```\n?/g, "");
  
  // Remove trailing semicolon
  sql = sql.replace(/;$/, "");
  
  // Remove extra whitespace
  sql = sql.trim();
  
  return sql;
}
