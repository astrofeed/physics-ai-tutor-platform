import { FileText } from "lucide-react";
import { formatBytes } from "@/lib/chat-attachments";
import type { DocumentAttachment } from "@/components/chat/types";

/** Chips for the PDF / Markdown / text files attached to a message. */
export function MessageDocuments({ documents }: { documents: DocumentAttachment[] }) {
  if (!documents.length) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {documents.map((doc) => (
        <a
          key={doc.url}
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
          <span className="max-w-[14rem] truncate font-medium text-gray-700 dark:text-gray-200">
            {doc.filename}
          </span>
          <span className="text-gray-400 dark:text-gray-500">{formatBytes(doc.sizeBytes)}</span>
        </a>
      ))}
    </div>
  );
}
