import { pool } from "../db.js";

/**
 * Schema Extractor Tool
 * Retrieves database schema information for LLM context
 */
export async function extractSchema() {
  const query = `
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM 
      information_schema.columns
    WHERE 
      table_schema = 'public'
    ORDER BY 
      table_name, ordinal_position;
  `;

  try {
    const result = await pool.query(query);
    
    // Group columns by table
    const schema = {};
    result.rows.forEach((row) => {
      if (!schema[row.table_name]) {
        schema[row.table_name] = [];
      }
      schema[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
        default: row.column_default,
      });
    });

    return schema;
  } catch (error) {
    console.error("Error extracting schema:", error);
    throw error;
  }
}

/**
 * Format schema for LLM prompt
 */
export function formatSchemaForPrompt(schema) {
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
