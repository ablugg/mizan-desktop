import { NextRequest, NextResponse } from "next/server";
import { chatWithSystem, ATTORNEY_SYSTEM_PROMPT } from "@/lib/claude";
import type { DraftType } from "@/types";

function buildDraftPrompt(docType: string, fields: Record<string, string>, docLang: "en" | "ar"): string {
  const fieldList = Object.entries(fields)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const langInstruction =
    docLang === "ar"
      ? `IMPORTANT: Write the entire document in Arabic. Use formal Arabic legal language consistent with Saudi legal practice. All headings, clauses, recitals, and signature blocks must be in Arabic.`
      : `Write the document in English using formal legal language consistent with Saudi legal practice.`;

  return `Draft a complete, professionally formatted ${docType} under Saudi Arabian law using the following details:

${fieldList}

${langInstruction}

Requirements:
- Write a complete, execution-ready legal document
- Include all standard clauses for this document type
- Number all clauses and sub-clauses
- Include recitals/whereas clauses where appropriate
- Add signature blocks with appropriate formality
- Note any clauses that may need customization with [CUSTOMIZE: reason]
- The document should be ready for attorney review and client signature`;
}

export async function POST(req: NextRequest) {
  const { docType, fields, docLang } = (await req.json()) as {
    docType: DraftType;
    fields: Record<string, string>;
    docLang: "en" | "ar";
  };

  if (!docType || !fields)
    return NextResponse.json({ error: "Missing document type or fields" }, { status: 400 });

  const lang: "en" | "ar" = docLang === "ar" ? "ar" : "en";
  const userPrompt = buildDraftPrompt(docType, fields, lang);

  const content = await chatWithSystem(ATTORNEY_SYSTEM_PROMPT, userPrompt);

  if (!content.trim())
    return NextResponse.json({ error: "Draft generation returned empty content" }, { status: 500 });

  return NextResponse.json({ content });
}
