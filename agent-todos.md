1. handle API failures -- rate limits, etc
2. add a box to enter OPENAI / ANTHROPIC API key if not already used (dont take from dotenv)
3. one thing to note : supports pdflatex as latex compiler, others like xelatex aren't supported
    - main drawback is lack of support for custom fonts
4. 8 turn history limit -- maybe expand?
    - add a message that chat limit length has been exceeded to save tokens

resume tailoring : 
- make sure the agent knows to fill up at least 75% of the page with each line -- add acceptable char count range to 
-  

what claude said : 

Context

 The agent loop in electron/agent/runner.js produces inconsistent results. The core issues are:
 1. The model operates on stale file content after its own edits
 2. Output token limit is too low (4096), causing rushed/truncated tool calls
 3. The summary block is too lossy — drops too much context between turns
 4. No chain-of-thought reasoning step before acting
 