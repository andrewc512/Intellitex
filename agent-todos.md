1. handle API failures -- rate limits, etc
2. add a box to enter OPENAI / ANTHROPIC API key if not already used (dont take from dotenv)
3. one thing to note : supports pdflatex as latex compiler, others like xelatex aren't supported
    - main drawback is lack of support for custom fonts
4. 8 turn history limit -- maybe expand?
    - add a message that chat limit length has been exceeded to save tokens

resume tailoring : 
- make sure the agent knows to fill up at least 75% of the page with each line -- add acceptable char count range to 
-  