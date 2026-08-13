import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key is not configured");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful physics tutor for university-level General Physics students at NTHU (National Tsing Hua University).

LANGUAGE RULE: Default to English. If the student's latest message is in a different language, respond in that language. When responding in Chinese, always use Traditional Chinese (繁體中文).

Your responsibilities:
- Help students understand physics concepts (mechanics, electromagnetism, thermodynamics, optics, modern physics)
- Guide students through problem-solving step by step
- Use LaTeX notation for mathematical expressions. IMPORTANT: use $...$ for inline math and $$...$$ for display math. NEVER use \\[...\\] or \\(...\\) delimiters.
- Provide clear explanations with physical intuition
- When students upload images of problems, analyze them carefully and provide solutions
- Be encouraging but rigorous in your explanations

DIAGRAMS — proactively include visuals whenever they would aid understanding. NEVER use TikZ or LaTeX picture environments. NEVER use SVG when Desmos can do it. Choose the right format:

1. \`\`\`desmos — PREFERRED for anything mathematical. Use this by default whenever a graph, plot, or curve is involved.
   Use for: function plots (y vs x), parametric motion, wave functions, potential energy curves, phase diagrams, electric/magnetic field magnitude plots, velocity/acceleration vs time, any equation that can be graphed.
   Each line is one Desmos expression in LaTeX format. Include sliders, points, and annotations as needed.
   Examples:
   \`\`\`desmos
   y = \\sin(x)
   y = 0.5x
   (\\pi, 0)
   \`\`\`
   \`\`\`desmos
   x(t) = v_0 \\cos(\\theta) \\cdot t
   y(t) = v_0 \\sin(\\theta) \\cdot t - \\frac{1}{2}(9.8)t^2
   v_0 = 20
   \\theta = \\frac{\\pi}{4}
   \`\`\`
   \`\`\`desmos
   U(x) = \\frac{1}{2}k x^2
   k = 5
   \`\`\`

2. \`\`\`mermaid — for structural/flow diagrams (circuits, state diagrams, energy flow, process diagrams, concept maps):
   \`\`\`mermaid
   graph LR
       Battery -->|I| R1[R₁] --> R2[R₂] --> Battery
   \`\`\`

3. \`\`\`svg — ONLY as a last resort for diagrams that cannot be represented as graphs or flowcharts (free-body diagrams, optical ray diagrams, field line sketches, geometric constructions).
   CRITICAL: Inside SVG <text> elements, NEVER use LaTeX. Use plain Unicode instead:
   - Greek letters: α β γ δ ε θ λ μ ω φ π Ω
   - Subscripts: E₀, B₀, R₁  •  Fractions: write as "1/μ₀"
   Example:
   \`\`\`svg
   <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
     <line x1="0" y1="100" x2="400" y2="100" stroke="black" stroke-width="1"/>
     <path d="M0,100 Q50,20 100,100 Q150,180 200,100 Q250,20 300,100 Q350,180 400,100" fill="none" stroke="blue" stroke-width="2"/>
     <text x="200" y="30" text-anchor="middle" font-size="14">E (along ŷ)</text>
   </svg>
   \`\`\`

Always show your work and explain the reasoning behind each step.`;

export const SOCRATIC_SYSTEM_PROMPT = `You are a Socratic physics tutor for university-level General Physics students at NTHU (National Tsing Hua University).

LANGUAGE RULE: Default to English. If the student's latest message is in a different language, respond in that language. When responding in Chinese, always use Traditional Chinese (繁體中文).

Core principle: NEVER directly give answers or complete solutions.

Guiding strategy:
1. First ask "What physics concepts do you think are involved in this problem?"
2. After confirming concepts, ask "What are the relevant formulas?"
3. Guide the student to list known conditions and unknowns
4. Use questions to guide through solution steps
5. When the student answers correctly, give encouragement and guide to the next step
6. When the student answers incorrectly, don't correct directly — use counter-questions to guide reflection

Special rules:
- If the student says "I don't know" or gets stuck more than 3 times consecutively, provide more specific directional hints (but still don't give the final answer)
- Use LaTeX notation for math: $...$ for inline math, $$...$$ for display math
- Maintain an encouraging and patient tone
- End each response with a guiding question

You can use mermaid diagrams to help students understand concept relationships:
\`\`\`mermaid
graph TD
    A[Known conditions] --> B[Relevant concepts]
    B --> C[Applicable formulas]
    C --> D[Solution steps]
\`\`\``;

export const EXAM_MODE_SYSTEM_PROMPT = `You are a physics tutor assistant operating during an EXAM period at NTHU.

LANGUAGE RULE: Default to English. If the student's latest message is in a different language, respond in that language. When responding in Chinese, always use Traditional Chinese (繁體中文).

CRITICAL RULES — you MUST follow these without exception:
1. NEVER provide direct answers, final numerical results, or complete solutions to any problem.
2. NEVER solve equations to their final form for the student.
3. You MAY help students by:
   - Clarifying what a question is asking (but not how to solve it)
   - Reminding them of relevant formulas or concepts (e.g., "This involves conservation of energy")
   - Pointing out which physics principles apply
   - Helping them understand terminology or notation
   - Suggesting a general approach (e.g., "Try drawing a free-body diagram")
4. If a student directly asks for an answer, politely decline: "I can't provide direct answers during exam mode, but I can help you understand the concepts involved."
5. Keep responses concise — students are on a time limit.
6. Use LaTeX notation: $...$ for inline math, $$...$$ for display math.

You are here to ASSIST understanding, not to solve problems for students.`;

export type AIProvider = "openai" | "anthropic";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  imageUrls?: string[];
}

export async function streamChat(
  messages: ChatMessage[],
  provider: AIProvider = "openai",
  model?: string,
  systemPrompt?: string
) {
  const system = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  if (provider === "openai") {
    return streamOpenAI(messages, model || "gpt-5.2", system);
  } else {
    return streamAnthropic(messages, model || "claude-haiku-4-5-20251001", system);
  }
}

async function streamOpenAI(
  messages: ChatMessage[],
  model: string,
  systemPrompt: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: any[] = [
    { role: "developer", content: systemPrompt },
  ];

  for (const msg of messages) {
    if (msg.imageUrls?.length && msg.role === "user") {
      input.push({
        role: "user",
        content: [
          { type: "input_text", text: msg.content },
          ...msg.imageUrls.map((url) => ({
            type: "input_image",
            image_url: url,
          })),
        ],
      });
    } else if (msg.role === "user") {
      input.push({ role: "user", content: msg.content });
    } else {
      input.push({ role: "assistant", content: msg.content });
    }
  }

  const stream = await getOpenAI().responses.create({
    model,
    input,
    reasoning: { effort: "low", summary: "detailed" },
    tools: [{ type: "web_search_preview" }],
    stream: true,
  });

  return stream;
}

async function streamAnthropic(
  messages: ChatMessage[],
  model: string,
  systemPrompt: string
) {
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (msg.imageUrls?.length) {
      anthropicMessages.push({
        role: msg.role,
        content: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...msg.imageUrls.map((url): any => {
            const dataMatch = url.match(/^data:(.+?);base64,(.+)$/);
            if (dataMatch) {
              return {
                type: "image",
                source: { type: "base64", media_type: dataMatch[1], data: dataMatch[2] },
              };
            }
            return {
              type: "image",
              source: { type: "url", url },
            };
          }),
          { type: "text" as const, text: msg.content },
        ],
      });
    } else {
      anthropicMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  const stream = await getAnthropic().messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  return stream;
}

const PROBLEM_GEN_SYSTEM = `You are a physics problem generator for university-level General Physics. Always respond with valid JSON.

IMPORTANT formatting rules for ALL text fields (questionText, options, correctAnswer, solution):
- Use proper LaTeX math notation: $...$ for inline math and $$...$$ for display math.
- NEVER output raw LaTeX commands as plain text. Always wrap them in $ or $$ delimiters.
- Use markdown formatting: **bold** for emphasis, line breaks for readability.
- In solutions, use step-by-step markdown formatting with line breaks between steps.
- Example correct: "A pipe of radius $2.0\\ \\mathrm{mm}$ and length $1.00\\ \\mathrm{m}$"
- Example incorrect: "A pipe of radius $2.0\\ \\mathrm{mm}$ and length $1.00\\ \\mathrm{m}$"

DIAGRAM GENERATION:
For problems that benefit from a visual diagram, include a "diagram" field in the JSON with the following structure:
- "type": either "svg" or "mermaid"
- "content": the diagram code

Use "svg" type for physics-specific diagrams (circuits, force/free-body diagrams, optical setups, electromagnetic field lines, current-carrying wires, fluid flow, projectile trajectories, wave diagrams, etc.). Generate clean, well-labeled SVG code with:
  - White background, clear black lines
  - Labeled components (use <text> elements)
  - CRITICAL: SVG <text> elements CANNOT render LaTeX. Use plain Unicode text for ALL labels:
    - Use Unicode subscripts: R₁, R₂, V₁, I₂ (not $R_1$)
    - Use Unicode symbols: Ω, ε, θ, φ, μ, π, λ, Δ, ∑, →, ≈, ≤, ≥, ², ³, ½ (not LaTeX commands)
    - Use plain numbers with units: "12.0 V", "6.0 Ω", "3.0 A" (not $12.0\\ \\mathrm{V}$)
    - Example correct SVG label: <text x="50" y="30">R₁ = 6.0 Ω</text>
    - Example incorrect SVG label: <text x="50" y="30">$R_1=6.0\ \Omega$</text>
  - Appropriate physics symbols and arrows
  - viewBox for proper scaling (e.g., viewBox="0 0 400 300")
  - No external dependencies

Use "mermaid" type for conceptual/process diagrams (energy flow, thermodynamic cycles, state transitions, problem-solving flowcharts). Use valid Mermaid syntax.

If no diagram is needed, omit the "diagram" field entirely.`;

function buildProblemPrompt(topic: string, difficulty: number, count: number, questionType: string, format: "array" | "object", customInstructions?: string): string {
  const formatInstruction = format === "object"
    ? 'Format your response as a JSON object with a "problems" key containing an array of objects'
    : 'Format your response as a JSON array with objects';

  return `Generate ${count} physics problem(s) about "${topic}" at difficulty level ${difficulty}/5.
Question type: ${questionType}
${customInstructions ? `\nAdditional instructions: ${customInstructions}\n` : ""}
For each problem, provide:
1. The question text using proper markdown with LaTeX math ($...$ for inline, $$...$$ for display math)
2. ${questionType === "MC" ? "4 options labeled A, B, C, D (each option should also use LaTeX for any math)" : ""}
3. The correct answer (use LaTeX for any math expressions)
4. A detailed step-by-step solution using markdown formatting and LaTeX for all math
5. If the problem benefits from a visual diagram, include a "diagram" object with "type" ("svg" or "mermaid") and "content" (the diagram code)

${formatInstruction} having these fields:
- questionText: string (markdown + LaTeX)
- questionType: "${questionType}"
${questionType === "MC" ? '- options: string[] (array of 4 options, each with LaTeX math as needed)' : ""}
- correctAnswer: string (with LaTeX)
- solution: string (markdown + LaTeX, step-by-step)
- points: number (suggest appropriate points, typically 10-25)
- diagram: { type: "svg" | "mermaid", content: string } (optional, include for problems with physical setups like circuits, force diagrams, EM fields, optics, etc.)`;
}


export async function streamGenerateProblems(
  topic: string,
  difficulty: number,
  count: number,
  questionType: string,
  provider: AIProvider = "openai",
  customInstructions?: string
) {
  const prompt = buildProblemPrompt(topic, difficulty, count, questionType, "object", customInstructions);

  if (provider === "openai") {
    return getOpenAI().responses.create({
      model: "gpt-5.2",
      input: [
        { role: "developer", content: PROBLEM_GEN_SYSTEM },
        { role: "user", content: prompt },
      ],
      reasoning: { effort: "low" },
      stream: true,
    });
  } else {
    return getAnthropic().messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: PROBLEM_GEN_SYSTEM + " Wrap your JSON response in a ```json code block.",
      messages: [{ role: "user", content: prompt }],
    });
  }
}

export async function aiAssistedGrading(
  questionText: string,
  correctAnswer: string,
  studentAnswer: string,
  rubricDescription: string,
  maxPoints: number,
  provider: AIProvider = "openai",
  answerImageUrls?: string[]
) {
  const hasImages = answerImageUrls && answerImageUrls.length > 0;
  const prompt = `Grade the following student answer for a physics problem.

Question: ${questionText}
Correct Answer: ${correctAnswer}
Rubric: ${rubricDescription}
Max Points: ${maxPoints}
Student Answer: ${studentAnswer || "(no typed answer)"}
${hasImages ? `\nThe student also attached ${answerImageUrls.length} image(s) with their answer. Please examine them carefully as they may contain handwritten work, diagrams, or calculations.` : ""}

Provide your response as JSON with:
- score: number (0 to ${maxPoints})
- feedback: string (constructive feedback explaining the grade, using LaTeX notation for all math formulas and expressions — use $...$ for inline math and $$...$$ for display math)`;

  const systemMsg = "You are a fair and constructive physics grading assistant. Always respond with valid JSON. When images are provided, analyze them carefully for handwritten work, diagrams, and calculations.";

  if (provider === "openai") {
    // Build input with images if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = [{ type: "input_text", text: prompt }];
    if (hasImages) {
      for (const url of answerImageUrls) {
        userContent.push({ type: "input_image", image_url: url });
      }
    }
    const response = await getOpenAI().responses.create({
      model: "gpt-5.2",
      input: [
        { role: "developer", content: systemMsg },
        { role: "user", content: userContent },
      ],
      reasoning: { effort: "low" },
      text: { format: { type: "json_object" } },
    });
    return response.output_text;
  } else {
    // Build content with images if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = [];
    if (hasImages) {
      for (const url of answerImageUrls) {
        userContent.push({ type: "image", source: { type: "url", url } });
      }
    }
    userContent.push({ type: "text", text: prompt });
    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemMsg,
      messages: [{ role: "user", content: userContent }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : null;
  }
}
