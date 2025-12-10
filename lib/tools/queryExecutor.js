import { pool } from "../db.js";

/**
 * Query Execution Tool
 * Safely executes approved SQL queries
 */
export async function executeQuery(sqlQuery) {
  try {
    const startTime = Date.now();
    const result = await pool.query(sqlQuery);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime: `${executionTime}ms`,
      fields: result.fields?.map((f) => ({
        name: f.name,
        dataType: f.dataTypeID,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      detail: error.detail,
    };
  }
}

/**
 * Execute query with row limit safety
 */
export async function executeQuerySafe(sqlQuery, maxRows = 100) {
  // Add LIMIT if not present
  const normalizedQuery = sqlQuery.trim().toUpperCase();
  let safeQuery = sqlQuery.trim();
  
  if (!normalizedQuery.includes("LIMIT")) {
    // Remove trailing semicolon if present
    safeQuery = safeQuery.replace(/;$/, "");
    safeQuery += ` LIMIT ${maxRows}`;
  }

  return executeQuery(safeQuery);
}
