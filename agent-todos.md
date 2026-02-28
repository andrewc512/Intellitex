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

Where the agent stands now                                                                                                
   
  The agent is mechanically competent but structurally blind. It can find text, replace it, and compile — but it has no     
  understanding of what it's looking at. It treats a resume as a flat string of characters. Every improvement we've made so 
  far has been about reducing waste (fewer round trips, less token bloat). None of them have made the agent smarter.        
                                                                                                                            
  The core limitation: the agent has no document awareness. It doesn't know that line 35 is a bullet under the Acme Corp    
  experience entry, or that the skills section starts at line 58. It has to infer all of this from raw text every time. This
   is why it miscounts bullets, puts entries in the wrong chronological order, and sometimes breaks structure.

  The 3 highest-impact changes from here

  1. Document outline injection (biggest win)

  This is the single technique that separates good code editors from bad ones. Cursor and Claude Code don't just dump raw
  files — they provide structural context: symbol trees, function signatures, class hierarchies. The model gets a map before
   it sees the territory.

  You already have a parser for .itek files. For .tex files, the section comment markers (%----------HEADING----------) make
   parsing straightforward. Inject a structural outline like:

  Document outline:
    HEADING (lines 16-22): Jane Smith, contact info
    EDUCATION (lines 25-28): UC Berkeley, B.S. CS, GPA 3.82
    EXPERIENCE (lines 32-55):
      - Acme Corp, SWE Intern, Jun-Sep 2025 (lines 33-42, 3 bullets)
      - StartupXYZ, Frontend Dev, Jan-May 2025 (lines 43-55, 2 bullets)
    PROJECTS (lines 58-72):
      - TaskFlow (lines 59-65, 2 bullets)
      - CodeReview Bot (lines 66-72, 2 bullets)
    SKILLS (lines 75-78): Languages, Frameworks, Tools

  This costs ~150 tokens but gives the model:
  - Precise line ranges for targeted edits (no guessing)
  - Entry counts for accurate "how many" questions
  - Chronological ordering awareness
  - Structural context for "add after X" or "remove the Y entry" operations

  This would have prevented the tex-read-03 miscount, the tex-multi-01 chronological ordering issue, and would make every
  "add new entry" operation more reliable.

  2. Few-shot tool use examples

  Right now the system prompt says what the tools do but never shows how to use them correctly. The model has to figure out
  the right tool sequence from scratch every time. Few-shot examples are the single most effective way to improve
  reliability with any model — this is why Claude Code's system prompt is enormous.

  Add 2-3 compact examples directly in the system prompt:

  ## Examples

  User: "Add a bullet under Acme Corp: 'Deployed feature flags reducing rollback time by 40%'"
  Action: str_replace with old_str matching the last bullet + \end{itemize}, new_str adding the bullet before \end{itemize}.
   Then compile_file.

  User: "Change the GPA from 3.82 to 3.95"
  Action: str_replace with old_str "GPA: 3.82" → new_str "GPA: 3.95". Then compile_file.

  This costs ~200 tokens but dramatically reduces tool misuse, especially for str_replace where the model needs to
  understand the "anchor pattern" of including just enough surrounding context.

  3. Post-edit structural validation

  Currently the only validation is compile_file — which only checks LaTeX syntax. A file can compile perfectly while having:
  - Duplicate entries
  - Orphaned bullets outside any entry
  - Broken section structure
  - Missing fields on new entries

  A lightweight structural validator that runs after edits (either as part of compile_file or a separate step) could catch
  these. For .itek files you already have a parser — run it after edits and report structural issues. For .tex files, even a
   simple regex check for balanced \begin{itemize}/\end{itemize} and section structure would help.

  This doesn't need to be a tool — it can be appended to the compile_file result automatically.

  ---
  What this looks like in priority order

  ┌────────────────────────┬─────────────────────────────────────┬───────────────────────────────────┬─────────────────┐
  │         Change         │               Effort                │      Impact on Intelligence       │   Token Cost    │
  ├────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┼─────────────────┤
  │ Document outline       │ Medium — need a lightweight parser  │ High — gives structural awareness │ +150 tokens     │
  │ injection              │ for .tex                            │                                   │                 │
  ├────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┼─────────────────┤
  │ Few-shot examples in   │ Low — just prompt editing           │ High — reduces tool misuse        │ +200 tokens     │
  │ prompt                 │                                     │ significantly                     │                 │
  ├────────────────────────┼─────────────────────────────────────┼───────────────────────────────────┼─────────────────┤
  │ Post-edit validation   │ Medium — extend compile tool        │ Medium — catches semantic errors  │ +50 tokens per  │
  │                        │                                     │                                   │ edit            │
  └────────────────────────┴─────────────────────────────────────┴───────────────────────────────────┴─────────────────┘

  Everything else (PDF preview, smarter retry logic, dynamic MAX_OUTPUT_TOKENS) is lower priority. These three would have
  the most visible effect on the agent actually doing the right thing, not just doing it faster.