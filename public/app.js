// Session stats
let totalQueries = 0;
let successfulQueries = 0;

// DOM Elements
const questionInput = document.getElementById('questionInput');
const askButton = document.getElementById('askButton');
const debugMode = document.getElementById('debugMode');
const maxRows = document.getElementById('maxRows');

const loadingSpinner = document.getElementById('loadingSpinner');
const responseCard = document.getElementById('responseCard');
const errorCard = document.getElementById('errorCard');

const answerText = document.getElementById('answerText');
const sqlQuery = document.getElementById('sqlQuery');
const dataTable = document.getElementById('dataTable');
const rowCount = document.getElementById('rowCount');
const executionTime = document.getElementById('executionTime');
const debugSection = document.getElementById('debugSection');
const debugTrace = document.getElementById('debugTrace');

const errorText = document.getElementById('errorText');
const errorDetails = document.getElementById('errorDetails');

const copyButton = document.getElementById('copyButton');
const exampleButtons = document.querySelectorAll('.example-btn');

// API endpoint
const API_URL = '/ask';

// Event Listeners
askButton.addEventListener('click', askQuestion);
questionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        askQuestion();
    }
});

copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(sqlQuery.textContent);
    copyButton.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
    setTimeout(() => {
        copyButton.innerHTML = '<i class="fas fa-copy mr-1"></i>Copy';
    }, 2000);
});

exampleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        questionInput.value = btn.textContent.trim();
        askQuestion();
    });
});

// Main function
async function askQuestion() {
    const question = questionInput.value.trim();
    
    if (!question) {
        showError('Please enter a question');
        return;
    }

    // Update UI
    hideAll();
    loadingSpinner.classList.remove('hidden');
    askButton.disabled = true;
    askButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question,
                debug: debugMode.checked,
                maxRows: parseInt(maxRows.value) || 100,
            }),
        });

        const data = await response.json();

        // Update stats
        totalQueries++;
        if (data.success) {
            successfulQueries++;
            displaySuccess(data);
        } else {
            displayError(data);
        }

        updateStats();

    } catch (error) {
        displayError({
            error: 'Network Error',
            details: error.message,
        });
    } finally {
        loadingSpinner.classList.add('hidden');
        askButton.disabled = false;
        askButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Ask Question';
    }
}

// Display success response
function displaySuccess(data) {
    hideAll();
    responseCard.classList.remove('hidden');

    // Answer
    answerText.innerHTML = formatAnswer(data.answer);

    // SQL Query
    sqlQuery.textContent = data.query;

    // Data table
    if (data.data && data.data.rows && data.data.rows.length > 0) {
        dataTable.innerHTML = createTable(data.data.rows);
        rowCount.textContent = `(${data.data.rowCount} rows)`;
        executionTime.innerHTML = `<i class="fas fa-clock mr-1"></i>Executed in ${data.data.executionTime}`;
    } else {
        dataTable.innerHTML = '<p class="text-gray-400 p-4">No data returned</p>';
        rowCount.textContent = '';
        executionTime.textContent = '';
    }

    // Debug trace
    if (data.trace && debugMode.checked) {
        debugSection.classList.remove('hidden');
        debugTrace.textContent = JSON.stringify(data.trace, null, 2);
    }

    // Warnings
    if (data.metadata && data.metadata.warnings && data.metadata.warnings.length > 0) {
        const warningsDiv = document.createElement('div');
        warningsDiv.className = 'mt-4 bg-yellow-900/20 border border-yellow-700 rounded-lg p-3';
        warningsDiv.innerHTML = `
            <h4 class="text-yellow-400 font-semibold mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>Warnings</h4>
            <ul class="text-yellow-300 text-sm space-y-1">
                ${data.metadata.warnings.map(w => `<li>• ${w}</li>`).join('')}
            </ul>
        `;
        responseCard.appendChild(warningsDiv);
    }
}

// Display error
function displayError(data) {
    hideAll();
    errorCard.classList.remove('hidden');

    errorText.textContent = data.error || 'An error occurred';

    if (data.details) {
        errorDetails.classList.remove('hidden');
        errorDetails.textContent = typeof data.details === 'string' 
            ? data.details 
            : JSON.stringify(data.details, null, 2);
    }

    if (data.trace) {
        const traceDiv = document.createElement('pre');
        traceDiv.className = 'bg-gray-900 rounded-lg p-4 text-gray-400 font-mono text-xs overflow-x-auto mt-3';
        traceDiv.textContent = JSON.stringify(data.trace, null, 2);
        errorCard.appendChild(traceDiv);
    }
}

// Helper: Format answer with markdown-like rendering
function formatAnswer(text) {
    // Convert markdown-style formatting to HTML
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-blue-300">$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/\n/g, '<br>');
    
    // Convert markdown tables to HTML
    if (text.includes('|')) {
        const lines = text.split('<br>');
        let tableHTML = '';
        let inTable = false;
        
        for (let line of lines) {
            if (line.includes('|')) {
                if (!inTable) {
                    tableHTML += '<table class="min-w-full mt-3 mb-3 text-sm"><tbody>';
                    inTable = true;
                }
                const cells = line.split('|').filter(c => c.trim());
                if (cells.some(c => c.includes('---'))) continue; // Skip separator
                
                tableHTML += '<tr>';
                cells.forEach(cell => {
                    tableHTML += `<td class="border border-gray-700 px-3 py-2">${cell.trim()}</td>`;
                });
                tableHTML += '</tr>';
            } else {
                if (inTable) {
                    tableHTML += '</tbody></table>';
                    inTable = false;
                }
                tableHTML += line + '<br>';
            }
        }
        if (inTable) tableHTML += '</tbody></table>';
        text = tableHTML;
    }
    
    return text;
}

// Helper: Create HTML table from rows
function createTable(rows) {
    if (!rows || rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    
    let html = '<table class="min-w-full text-sm"><thead class="bg-gray-700">';
    html += '<tr>';
    headers.forEach(header => {
        html += `<th class="px-4 py-2 text-left text-gray-300 font-semibold">${header}</th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach((row, idx) => {
        html += `<tr class="${idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}">`;
        headers.forEach(header => {
            const value = row[header];
            const displayValue = value === null ? '<span class="text-gray-500">NULL</span>' : value;
            html += `<td class="px-4 py-2 text-gray-300">${displayValue}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

// Helper: Hide all result containers
function hideAll() {
    responseCard.classList.add('hidden');
    errorCard.classList.add('hidden');
    debugSection.classList.add('hidden');
    errorDetails.classList.add('hidden');
}

// Helper: Update session stats
function updateStats() {
    document.getElementById('totalQueries').textContent = totalQueries;
    const rate = totalQueries > 0 ? Math.round((successfulQueries / totalQueries) * 100) : 100;
    document.getElementById('successRate').textContent = `${rate}%`;
}

// Helper: Show temporary error
function showError(message) {
    const tempError = document.createElement('div');
    tempError.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse';
    tempError.textContent = message;
    document.body.appendChild(tempError);
    setTimeout(() => tempError.remove(), 3000);
}
