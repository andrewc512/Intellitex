# itek Language Reference

**itek** is a domain-specific language for writing resumes. It uses clean, indentation-based syntax that transpiles to LaTeX and compiles to PDF — letting you write an ATS-friendly resume without touching LaTeX directly.

---

## Pipeline

```
.itek source  →  Parser (AST)  →  Transpiler (LaTeX)  →  pdflatex (PDF)
```

1. **Parser** — reads `.itek` source line-by-line into a structured AST
2. **Transpiler** — converts the AST into a Jake's-Resume-style LaTeX document
3. **Compiler** — runs `pdflatex` to produce the final PDF

---

## Syntax

### Document Declaration

Every `.itek` file must begin with:

```
@resume <Full Name>
```

This sets the resume owner's name, rendered as a large centered header in the output.

### Sections

Sections are declared with a single `#`:

```
#socials
#education
#experience
#skills
#projects
#leadership
```

These map to standard resume sections. Any unrecognized section name is treated as a generic section and rendered using the experience layout.

### Entry Markers

Entries group a set of fields and bullet points within a section. They can use **semantic markers** or a **generic marker**:

| Marker                | Intended Section | Example                  |
| --------------------- | ---------------- | ------------------------ |
| `company <name>`      | `#experience`    | `company Google`         |
| `project <name>`      | `#projects`      | `project Artistle`       |
| `organization <name>` | `#leadership`    | `organization SB Hacks`  |
| `## <name>`           | any section      | `## Some Entry`          |

### Fields (Key-Value Pairs)

```
key: value
key: "quoted value"
key: <url-or-email>
```

- Keys are **case-insensitive** (normalized to lowercase internally).
- Values can be plain text, quoted strings, or URLs/emails wrapped in angle brackets.
- Angle-bracket values are recognized as links and rendered as clickable hyperlinks in the PDF.

### Bullet Points

```
* Your accomplishment or description here
```

Bullets belong to the nearest entry above them. If no entry exists, they attach to the section directly.

---

## Section Reference

### `#socials` — Contact Info

Rendered in the document header (not as a standalone section). Fields are joined by `|` dividers.

| Field       | Description    | Format                                |
| ----------- | -------------- | ------------------------------------- |
| `number`    | Phone number   | Auto-formatted to `(XXX) XXX-XXXX`   |
| `email`     | Email address  | `<you@example.com>`                   |
| `linkedin`  | LinkedIn URL   | `<https://linkedin.com/in/...>`       |
| `github`    | GitHub URL     | `<https://github.com/...>`            |
| `website`   | Personal site  | `<https://...>`                       |
| `portfolio` | Portfolio URL  | `<https://...>`                       |

Links are displayed with the protocol stripped (e.g., `linkedin.com/in/jaydentan1206`).

### `#education`

Can use entries (for multiple schools) or top-level fields (for a single school).

| Field     | Aliases      | Description                              |
| --------- | ------------ | ---------------------------------------- |
| `school`  | —            | Institution name                         |
| `loc`     | `location`   | City, State                              |
| `degree`  | —            | Degree title                             |
| `gpa`     | —            | GPA (appended to the degree line)        |
| `grad`    | `graduation` | Graduation date                          |
| `courses` | `coursework` | Relevant coursework (rendered as bullet) |

### `#experience` / `#leadership`

Use `company` or `organization` entry markers respectively.

| Field  | Aliases    | Description |
| ------ | ---------- | ----------- |
| `role` | `title`    | Job title   |
| `loc`  | `location` | City, State |
| `date` | —          | Date range  |

Followed by `*` bullet points for accomplishments.

### `#skills`

No entries — just key-value pairs. Each key becomes a bold label:

```
languages: Python, C++, Java
frameworks: React, Next.js
technologies: PostgreSQL, AWS, Docker
```

### `#projects`

Use `project` entry markers.

| Field   | Aliases                 | Description                                    |
| ------- | ----------------------- | ---------------------------------------------- |
| `stack` | `technologies`, `tech`  | Tech stack (rendered in italics next to name)   |
| `date`  | —                       | Date range                                     |

Followed by `*` bullet points for descriptions.

---

## Full Example

```itek
@resume Jayden Tan

#socials
  number: 9169061635
  email: <jaytan3966@gmail.com>
  linkedin: <https://linkedin.com/in/jaydentan1206>
  github: <https://github.com/jaytan3966>
  website: <https://jaydentan.vercel.app>

#education
  school: "UC Santa Barbara"
  loc: "Santa Barbara, CA"
  degree: "B.S. Computer Science"
  gpa: 3.87
  grad: "June 2027"
  courses: "Data Structures, Algorithms, Computer Architecture"

#experience
  company ConstructWise
    role: "Software Engineering Intern"
    loc: "San Francisco, CA"
    date: "June 2025 – Sep. 2025"
    * Collaborated on full-stack features using NextJS, TailwindCSS, Django REST Framework
    * Built AI-powered cost estimation tool with Claude API, achieving 96% accuracy
    * Automated document extraction pipeline, reducing manual data entry by 70%

  company UCSB Office of the Student Advocate
    role: "Software Developer"
    loc: "Santa Barbara, CA"
    date: "Sep. 2025 – Present"
    * Developing GoGaucho, serving 10,000+ monthly active users
    * Collaborated in biweekly Agile sprints with a team of 4 developers
    * Integrated Vue.js click-to-redirect for course schedule navigation

#skills
  languages: Python, C++, Java, JavaScript, TypeScript, SQL, HTML, CSS
  frameworks: NextJS, ReactJS, ExpressJS, TailwindCSS, Flask, Django
  technologies: PostgreSQL, AWS Lambda, DynamoDB, MongoDB, Supabase, Redis, Git

#projects
  project Artistle
    stack: "NextJS, TailwindCSS, Auth0, AWS Lambda, DynamoDB, Redis, Flask"
    date: "June 2025 – July 2025"
    * Built Wordle-inspired Spotify artist guessing game with serverless AWS backend
    * Reduced API calls by 40% with Redis caching, enabling automatic scaling

  project UCSB-Dine-In
    stack: "NextJS, NodeJS, TailwindCSS, Supabase, UCSB Student Developer API"
    date: "Jan. 2025"
    * Displays 200+ real-time food items across 4 dining halls via UCSB API
    * Led development while mentoring 3 junior teammates in full-stack fundamentals

#leadership
  organization SB Hacks
    role: "Development Officer"
    loc: "Santa Barbara, CA"
    date: "August 2025 – Present"
    * Redesigned NextJS/TailwindCSS website with GitHub Actions CI/CD for 450+ participants
    * Built Firebase backend for secure participant data management
    * Translated Figma designs into responsive NextJS components
```

---

## Design Notes

- **Indentation-based, line-oriented** — no braces, brackets, or semicolons. Whitespace is forgiving; the parser trims every line.
- **Sections define layout** — the transpiler has dedicated renderers for each section type. Unknown sections fall back to the experience layout.
- **Automatic LaTeX escaping** — special characters (`& % $ # _ { } ~ ^ \`) are escaped during transpilation.
- **Field aliases** — multiple keys map to the same concept for flexibility (e.g., `loc`/`location`, `role`/`title`, `grad`/`graduation`, `stack`/`technologies`/`tech`, `courses`/`coursework`).
- **Socials are header-only** — the `#socials` section populates the document header and is not rendered as a standalone LaTeX section.
- **ATS-friendly output** — the generated LaTeX uses Jake's Resume template conventions with clean formatting, proper hyperlinking, and standard section headings.
