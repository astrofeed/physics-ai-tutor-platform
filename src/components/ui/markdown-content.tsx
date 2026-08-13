"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Check, Copy, Play, Edit3, Save } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import dynamic from "next/dynamic";
import "katex/dist/katex.min.css";
import DOMPurify from "dompurify";

const SyntaxHighlighter = dynamic(
  () => import("react-syntax-highlighter").then((mod) => mod.Prism),
  { ssr: false, loading: () => <pre className="p-4 bg-gray-950 text-gray-100 text-sm font-mono rounded-xl overflow-auto"><code>Loading...</code></pre> }
);

const MermaidDiagram = dynamic(() => import("@/components/chat/MermaidDiagram"), { ssr: false });
const DesmosGraph = dynamic(() => import("@/components/chat/DesmosGraph"), { ssr: false });

const RUNNABLE_LANGUAGES = ["python", "javascript", "js", "typescript", "ts"];
const CODE_BLOCK_BG = "#0a0a0a";

function normalizeLatex(content: string): string {
  // Convert \[...\] to $$...$$ and \(...\) to $...$
  content = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  content = content.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`);

  // Ensure $$ display math delimiters are on their own lines.
  // remark-math requires $$ to start at the beginning of a line.
  // First, handle matched $$...$$ pairs (including multi-line).
  content = content.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    return `\n$$\n${math.trim()}\n$$\n`;
  });

  // Clean up excessive blank lines created by the replacements
  content = content.replace(/\n{3,}/g, "\n\n");

  return content.trim();
}

function CodeBlock({
  language,
  code: initialCode
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [style, setStyle] = useState<Record<string, React.CSSProperties> | null>(null);
  const [showRunConfirm, setShowRunConfirm] = useState(false);

  useEffect(() => {
    import("react-syntax-highlighter/dist/esm/styles/prism").then((mod) => setStyle(mod.vscDarkPlus));
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRunnable = RUNNABLE_LANGUAGES.includes(language.toLowerCase());

  const handleRun = async () => {
    if (!sessionStorage.getItem('code-run-acknowledged')) {
      setShowRunConfirm(true);
      return;
    }
    await executeCode();
  };

  const executeCode = async () => {
    setRunning(true);
    setOutput(null);

    try {
      const res = await fetch("/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });

      const data = await res.json();
      setOutput(data.output || data.error || "No output");
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : "Failed to run code"}`);
    } finally {
      setRunning(false);
    }
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {language || "code"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleEdit}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium transition-colors"
            title={isEditing ? "Save and view" : "Edit code"}
          >
            {isEditing ? (
              <>
                <Save className="h-3 w-3" />
                Save
              </>
            ) : (
              <>
                <Edit3 className="h-3 w-3" />
                Edit
              </>
            )}
          </button>
          {isRunnable && (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              title="Run code"
            >
              <Play className="h-3 w-3" />
              {running ? "Running..." : "Run"}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      {isEditing ? (
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full p-4 bg-gray-950 dark:bg-black text-gray-100 text-sm font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={Math.max(code.split('\n').length, 5)}
          spellCheck={false}
        />
      ) : style ? (
        <SyntaxHighlighter
          language={language}
          style={style}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: CODE_BLOCK_BG,
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
          showLineNumbers
          wrapLines
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <pre className="p-4 overflow-auto text-sm font-mono leading-relaxed" style={{ margin: 0, background: CODE_BLOCK_BG }}>
          <code className="text-gray-100">{code}</code>
        </pre>
      )}

      {/* Output */}
      {output !== null && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-900 dark:bg-gray-950">
          <div className="px-4 py-2 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Output
            </span>
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-green-400">
            {output}
          </pre>
        </div>
      )}
      <AlertDialog open={showRunConfirm} onOpenChange={setShowRunConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run Code in Sandbox</AlertDialogTitle>
            <AlertDialogDescription>
              Code will be executed in a secure sandbox environment (Piston API). Note: Code is sent to a third-party service for execution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:text-white dark:hover:bg-amber-700"
              onClick={() => { sessionStorage.setItem('code-run-acknowledged', 'true'); executeCode(); }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Make math elements clickable to copy
    // Use setTimeout to ensure ReactMarkdown and KaTeX have finished rendering
    const timer = setTimeout(() => {
      const container = contentRef.current;
      if (!container) return;

      const mathElements = container.querySelectorAll('.katex-display, .katex:not(.katex-display .katex)');

      mathElements.forEach((mathEl) => {
        // Skip if already processed
        if (mathEl.parentElement?.classList.contains('math-wrapper')) return;

        // Get the LaTeX source from the annotation element
        const annotation = mathEl.querySelector('annotation[encoding="application/x-tex"]');
        const latex = annotation?.textContent || '';

        if (!latex) return;

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'math-wrapper relative inline-block cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-1';
        wrapper.title = 'Click to copy formula';

        if (mathEl.classList.contains('katex-display')) {
          wrapper.className = 'math-wrapper relative block cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-2 py-1 my-4';
        }

        // Create "Copied!" indicator
        const copiedIndicator = document.createElement('span');
        copiedIndicator.className = 'absolute top-1 right-1 text-xs font-medium text-green-600 dark:text-green-400 bg-white dark:bg-gray-900 px-2 py-1 rounded shadow-sm opacity-0 transition-opacity pointer-events-none';
        copiedIndicator.textContent = 'Copied!';

        // Handle click to copy
        wrapper.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await navigator.clipboard.writeText(latex);

          // Show copied indicator
          copiedIndicator.style.opacity = '1';
          setTimeout(() => {
            copiedIndicator.style.opacity = '0';
          }, 1500);
        };

        // Wrap the math element
        mathEl.parentNode?.insertBefore(wrapper, mathEl);
        wrapper.appendChild(mathEl);
        wrapper.appendChild(copiedIndicator);
      });
    }, 100); // Delay to ensure ReactMarkdown has rendered

    return () => clearTimeout(timer);
  }, [content]);

  return (
    <div ref={contentRef} className={`min-w-0 ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
          code: ({ className, children, ...props }) => {
            const code = String(children).replace(/\n$/, "");
            if (className?.includes("language-svg")) {
              const trimmed = code.trim();
              if (trimmed.startsWith("<svg")) {
                const sanitized = DOMPurify.sanitize(trimmed, {
                  USE_PROFILES: { svg: true, svgFilters: true },
                  ADD_TAGS: ["use"],
                });
                return (
                  <div
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-auto max-w-full my-3 flex justify-center"
                    dangerouslySetInnerHTML={{ __html: sanitized }}
                  />
                );
              }
            }
            if (className?.includes("language-mermaid")) {
              return <MermaidDiagram content={code} />;
            }
            if (className?.includes("language-desmos")) {
              return <DesmosGraph code={code} />;
            }
            const isBlock = className?.includes("language-");
            if (isBlock) {
              const match = className?.match(/language-(\w+)/);
              const language = match ? match[1] : "";
              return <CodeBlock language={language} code={code} />;
            }
            return (
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ""}
              className="rounded-lg max-w-full my-3 border border-gray-200 dark:border-gray-700"
            />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-500 dark:text-gray-400 my-2 py-1">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-gray-200 dark:border-gray-700" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 align-top">{children}</td>
          ),
        }}
      >
        {normalizeLatex(content)}
      </ReactMarkdown>
    </div>
  );
}
