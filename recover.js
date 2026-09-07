const fs = require('fs');
const readline = require('readline');

async function recover() {
    const fileStream = fs.createReadStream('../.gemini/antigravity-ide/brain/46be89e2-f015-441e-ab7b-b0a187d30d76/.system_generated/logs/transcript_full.jsonl');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    
    let bestCode = null;

    for await (const line of rl) {
        try {
            const entry = JSON.parse(line);
            if (entry.tool_calls) {
                for (const call of entry.tool_calls) {
                    if ((call.name === 'write_to_file' || call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') && 
                        call.args.TargetFile && call.args.TargetFile.includes('app/page.js')) {
                        
                        // If it's a full write or large replace, it might contain the components
                        const content = call.args.CodeContent || call.args.ReplacementContent || (call.args.ReplacementChunks && JSON.stringify(call.args.ReplacementChunks));
                        if (content && content.includes('const MainDashboard =')) {
                            bestCode = content;
                        }
                    }
                }
            }
        } catch (e) {}
    }

    if (bestCode) {
        fs.writeFileSync('recovered_components.js', bestCode);
        console.log('Saved to recovered_components.js');
    } else {
        console.log('Not found in tool calls.');
    }
}
recover();
