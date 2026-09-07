const fs = require('fs');
const readline = require('readline');

async function recover() {
    const fileStream = fs.createReadStream('../.gemini/antigravity-ide/brain/46be89e2-f015-441e-ab7b-b0a187d30d76/.system_generated/logs/transcript_full.jsonl');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    
    let bestCode = null;

    for await (const line of rl) {
        try {
            const entry = JSON.parse(line);
            
            // Check tool calls
            if (entry.tool_calls) {
                for (const call of entry.tool_calls) {
                    const str = JSON.stringify(call);
                    if (str.includes('const MainDashboard =')) {
                        bestCode = str;
                    }
                }
            }
            
            // Check model content
            if (entry.content && entry.content.includes('const MainDashboard =')) {
                bestCode = entry.content;
            }
        } catch (e) {}
    }

    if (bestCode) {
        fs.writeFileSync('recovered_components.js', bestCode);
        console.log('Saved to recovered_components.js');
    } else {
        console.log('Not found.');
    }
}
recover();
