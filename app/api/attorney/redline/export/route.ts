import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from "docx";
import { RedlineChange } from "@/types";

export async function POST(req: NextRequest) {
  const { originalText, acceptedChanges, filename } = await req.json() as {
    originalText: string;
    acceptedChanges: RedlineChange[];
    filename: string;
  };

  // Apply accepted changes to the original text
  let finalText = originalText;
  for (const change of acceptedChanges) {
    if (change.originalText) {
      // suggestedText may be "" for omissions — replace regardless
      finalText = finalText.replace(change.originalText, change.suggestedText ?? "");
    }
  }

  const lines = finalText.split("\n");
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: `Redlined: ${filename || "Document"}`,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Reviewed by Mizan · ${acceptedChanges.length} change(s) applied · ${new Date().toLocaleDateString("en-GB")}`,
          size: 18,
          color: "888888",
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  for (const line of lines) {
    const trimmed = line.trim();
    children.push(
      trimmed
        ? new Paragraph({
            children: [new TextRun({ text: trimmed, size: 22, font: "Georgia" })],
            spacing: { after: 120 },
            alignment: AlignmentType.JUSTIFIED,
          })
        : new Paragraph({ text: "", spacing: { after: 80 } })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Georgia", size: 22 },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outFilename = `Redlined_${(filename || "Document").replace(/\.[^.]+$/, "")}_Mizan.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${outFilename}"`,
    },
  });
}
