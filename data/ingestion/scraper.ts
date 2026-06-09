/**
 * Mizan legal data ingestion pipeline
 * Run with: npm run ingest
 *
 * Features:
 * - Rate limit handling with automatic retry and exponential backoff
 * - Skips files that don't exist instead of crashing
 * - Delays between batches and documents to stay under Cohere trial limits
 * - Progress tracking so you can see exactly where it is
 */
import { config } from "dotenv";
config({ path: ".env" });

import { Pinecone } from "@pinecone-database/pinecone";
import { CohereClient } from "cohere-ai";
import * as fs from "fs";
import * as path from "path";

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });
const INDEX_NAME = process.env.PINECONE_INDEX ?? "mizan-legal";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunkText(
  text: string,
  chunkSize: number = 400,
  overlap: number = 50
): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 50) chunks.push(chunk.trim());
  }
  return chunks;
}

async function embedBatch(texts: string[], retries = 5): Promise<number[][]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await cohere.embed({
        texts,
        model: "embed-multilingual-v3.0",
        inputType: "search_document",
        embeddingTypes: ["float"],
      });
      const embeddings = response.embeddings as { float?: number[][] };
      if (!embeddings.float) throw new Error("No embeddings returned");
      return embeddings.float;
    } catch (err: any) {
      const is429 = err?.statusCode === 429 || err?.message?.includes("429");
      if (is429 && attempt < retries - 1) {
        const wait = Math.pow(2, attempt + 1) * 10000;
        console.log(`  Rate limited. Waiting ${wait / 1000}s before retry ${attempt + 1}/${retries - 1}...`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

export async function ingestDocument(doc: {
  text: string;
  source: string;
  jurisdiction: string;
  statute?: string;
  section?: string;
  language?: string;
}) {
  const chunks = chunkText(doc.text);
  const index = pinecone.index(INDEX_NAME);
  const lang = doc.language ?? "en";

  console.log(`  Chunked into ${chunks.length} chunks`);

  const batchSize = 25;
  const totalBatches = Math.ceil(chunks.length / batchSize);

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    const embeddings = await embedBatch(batch);

    const vectors = batch.map((chunk, j) => ({
      id: `${doc.source.replace(/[^a-zA-Z0-9-_]/g, "-")}-${lang}-${(doc.statute ?? "doc").replace(/[^a-zA-Z0-9-_]/g, "-")}-${i + j}`,
      values: embeddings[j],
      metadata: {
        text: chunk,
        source: doc.source,
        jurisdiction: doc.jurisdiction,
        statute: doc.statute ?? "",
        section: doc.section ?? "",
        language: lang,
      },
    }));

    await index.upsert(vectors);
    console.log(`  Batch ${batchNum}/${totalBatches} upserted`);

    if (batchNum < totalBatches) await sleep(3000);
  }
}

const SOURCES: Array<{ file: string; source: string; statute?: string; language: string }> = [
  /*
  { file: "labour-law-en.txt", source: "Saudi Labour Law", statute: "Royal Decree No. M/51", language: "en" },
  { file: "labour-law-ar.txt", source: "Saudi Labour Law", statute: "Royal Decree No. M/51", language: "ar" },
  { file: "civil-transactions-law-en.txt", source: "Civil Transactions Law", statute: "Royal Decree No. M/191", language: "en" },
  { file: "civil-transactions-law-ar.txt", source: "Civil Transactions Law", statute: "Royal Decree No. M/191", language: "ar" },
  { file: "family-law-en.txt", source: "Family Law", statute: "Royal Decree No. M/73", language: "en" },
  { file: "family-law-ar.txt", source: "Family Law", statute: "Royal Decree No. M/73", language: "ar" },
  { file: "regulations-of-the-family-law-en.txt", source: "Regulations of the Family Law", statute: "Royal Order No. 59641", language: "en" },
  { file: "regulations-of-the-family-law-ar.txt", source: "Regulations of the Family Law", statute: "Royal Order No. 59641", language: "ar" },
  { file: "the-regulation-medical-reports-stipulated-in-the-family-law-en.txt", source: "Regulation of Medical Reports Stipulated in the Family Law", statute: "Minister of Justice Decision No. 3411", language: "en" },
  { file: "the-regulation-medical-reports-stipulated-in-the-family-law-ar.txt", source: "Regulation of Medical Reports Stipulated in the Family Law", statute: "Minister of Justice Decision No. 3411", language: "ar" },
  { file: "law-of-evidence-en.txt", source: "Law of Evidence", statute: "Royal Decree No. M/43", language: "en" },
  { file: "law-of-evidence-ar.txt", source: "Law of Evidence", statute: "Royal Decree No. M/43", language: "ar" },
  { file: "procedural-manuals-for-the-evidentiary-law-en.txt", source: "Procedural Manuals for the Evidentiary Law", statute: "Minister of Justice Decision No. 921", language: "en" },
  { file: "procedural-manuals-for-the-evidentiary-law-ar.txt", source: "Procedural Manuals for the Evidentiary Law", statute: "Minister of Justice Decision No. 921", language: "ar" },
  { file: "rules-governing-the-expertise-affairs-before-the-courts-en.txt", source: "Rules Governing the Expertise Affairs Before the Courts", statute: "Minister of Justice Decision No. 921", language: "en" },
  { file: "rules-governing-the-expertise-affairs-before-the-courts-ar.txt", source: "Rules Governing the Expertise Affairs Before the Courts", statute: "Minister of Justice Decision No. 921", language: "ar" },
  { file: "controls-of-the-electronic-evidentiary-procedures-en.txt", source: "Controls of the Electronic Evidentiary Procedures", statute: "Minister of Justice Decision No. 921", language: "en" },
  { file: "controls-of-the-electronic-evidentiary-procedures-ar.txt", source: "Controls of the Electronic Evidentiary Procedures", statute: "Minister of Justice Decision No. 921", language: "ar" },
  { file: "law-of-civil-procedure-en.txt", source: "Law of Civil Procedure", statute: "Royal Decree No. M/1", language: "en" },
  { file: "law-of-civil-procedure-ar.txt", source: "Law of Civil Procedure", statute: "Royal Decree No. M/1", language: "ar" },
  { file: "implementing-regulations-of-the-law-of-civil-procedure-en.txt", source: "Implementing Regulations of the Law of Civil Procedure", statute: "Minister of Justice Decision No. 39933", language: "en" },
  { file: "implementing-regulations-of-the-law-of-civil-procedure-ar.txt", source: "Implementing Regulations of the Law of Civil Procedure", statute: "Minister of Justice Decision No. 39933", language: "ar" },
  { file: "implementing-regulations-of-appeal-procedures-en.txt", source: "Implementing Regulations of Appeal Procedures", statute: "Minister of Justice Decision No. 5134", language: "en" },
  { file: "implementing-regulations-of-appeal-procedures-ar.txt", source: "Implementing Regulations of Appeal Procedures", statute: "Minister of Justice Decision No. 5134", language: "ar" },
  { file: "the-implementing-regulations-for-methods-of-appealing-on-judgements-en.txt", source: "The Implementing Regulations for Methods of Appealing on Judgements", statute: "Minister of Justice Decision No. 512", language: "en" },
  { file: "the-implementing-regulations-for-methods-of-appealing-on-judgements-ar.txt", source: "The Implementing Regulations for Methods of Appealing on Judgements", statute: "Minister of Justice Decision No. 512", language: "ar" },
  { file: "law-of-criminal-procedure-en.txt", source: "Law of Criminal Procedure", statute: "Royal Decree No. M/2", language: "en" },
  { file: "law-of-criminal-procedure-ar.txt", source: "Law of Criminal Procedure", statute: "Royal Decree No. M/2", language: "ar" },
  { file: "implementing-regulations-of-the-law-of-criminal-procedure-en.txt", source: "Implementing Regulations of the Law of Criminal Procedure", statute: "Council of Ministers Resolution No. 142", language: "en" },
  { file: "implementing-regulations-of-the-law-of-criminal-procedure-ar.txt", source: "Implementing Regulations of the Law of Criminal Procedure", statute: "Council of Ministers Resolution No. 142", language: "ar" },
  { file: "law-of-commercial-courts-en.txt", source: "Law of Commercial Courts", statute: "Royal Decree No. M/93", language: "en" },
  { file: "law-of-commercial-courts-ar.txt", source: "Law of Commercial Courts", statute: "Royal Decree No. M/93", language: "ar" },
  { file: "the-implementing-regulations-of-the-commercial-courts-law-en.txt", source: "The Implementing Regulations of the Commercial Courts Law", statute: "Minister of Justice Decision No. 8344", language: "en" },
  { file: "the-implementing-regulations-of-the-commercial-courts-law-ar.txt", source: "The Implementing Regulations of the Commercial Courts Law", statute: "Minister of Justice Decision No. 8344", language: "ar" },
  { file: "procedural-guide-for-e-litigation-service-en.txt", source: "Procedural Guide for E-Litigation Service", statute: "Minister of Justice Decision No. 8056", language: "en" },
  { file: "procedural-guide-for-e-litigation-service-ar.txt", source: "Procedural Guide for E-Litigation Service", statute: "Minister of Justice Decision No. 8056", language: "ar" },
  { file: "law-of-judicial-fees-en.txt", source: "Law of Judicial Fees", statute: "Royal Decree No. M/16", language: "en" },
  { file: "law-of-judicial-fees-ar.txt", source: "Law of Judicial Fees", statute: "Royal Decree No. M/16", language: "ar" },
  { file: "implementing-regulations-of-the-law-of-judicial-fees-en.txt", source: "Implementing Regulations of the Law of Judicial Fees", statute: "Council of Ministers Resolution No. 519", language: "en" },
  { file: "implementing-regulations-of-the-law-of-judicial-fees-ar.txt", source: "Implementing Regulations of the Law of Judicial Fees", statute: "Council of Ministers Resolution No. 519", language: "ar" },
  { file: "judicial-documents-regulations-en.txt", source: "Judicial Documents Regulations", statute: "Minister of Justice Decision No. 2818", language: "en" },
  { file: "judicial-documents-regulations-ar.txt", source: "Judicial Documents Regulations", statute: "Minister of Justice Decision No. 2818", language: "ar" },
  { file: "judicial-inspection-regulations-en.txt", source: "Judicial Inspection Regulations", language: "en" },
  { file: "judicial-inspection-regulations-ar.txt", source: "Judicial Inspection Regulations", language: "ar" },
  { file: "law-of-the-judiciary-en.txt", source: "Law of the Judiciary", statute: "Royal Decree No. M/78", language: "en" },
  { file: "law-of-the-judiciary-ar.txt", source: "Law of the Judiciary", statute: "Royal Decree No. M/78", language: "ar" },
  { file: "implementing-procedures-of-the-law-of-the-judiciary-and-the-law-of-the-board-of-grievances-en.txt", source: "Implementing Procedures of the Law of the Judiciary and the Law of the Board of Grievances", statute: "Royal Decree No. M/78", language: "en" },
  { file: "implementing-procedures-of-the-law-of-the-judiciary-and-the-law-of-the-board-of-grievances-ar.txt", source: "Implementing Procedures of the Law of the Judiciary and the Law of the Board of Grievances", statute: "Royal Decree No. M/78", language: "ar" },
  { file: "regulations-governing-the-work-of-judicial-assistants-en.txt", source: "Regulations Governing the Work of Judicial Assistants", statute: "Minister of Justice Decision No. 50335", language: "en" },
  { file: "regulations-governing-the-work-of-judicial-assistants-ar.txt", source: "Regulations Governing the Work of Judicial Assistants", statute: "Minister of Justice Decision No. 50335", language: "ar" },
  { file: "enforcement-law-en.txt", source: "Enforcement Law", statute: "Royal Decree No. M/53", language: "en" },
  { file: "enforcement-law-ar.txt", source: "Enforcement Law", statute: "Royal Decree No. M/53", language: "ar" },
  { file: "the-implementing-regulations-of-the-enforcement-law-en.txt", source: "The Implementing Regulations of the Enforcement Law", statute: "Minister of Justice Decision No. 526", language: "en" },
  { file: "the-implementing-regulations-of-the-enforcement-law-ar.txt", source: "The Implementing Regulations of the Enforcement Law", statute: "Minister of Justice Decision No. 526", language: "ar" },
  { file: "implementing-regulations-for-enforcement-services-providers-en.txt", source: "Implementing Regulations for Enforcement Services Providers", statute: "Minister of Justice Decision No. 2268", language: "en" },
  { file: "implementing-regulations-for-enforcement-services-providers-ar.txt", source: "Implementing Regulations for Enforcement Services Providers", statute: "Minister of Justice Decision No. 2268", language: "ar" },
  { file: "controls-for-the-lessors-receipt-of-movable-assets-en.txt", source: "Controls for the Lessor's Receipt of Movable Assets", statute: "Minister of Justice Decision No. 1448", language: "en" },
  { file: "controls-for-the-lessors-receipt-of-movable-assets-ar.txt", source: "Controls for the Lessor's Receipt of Movable Assets", statute: "Minister of Justice Decision No. 1448", language: "ar" },
  { file: "division-of-common-property-regulations-en.txt", source: "Division of Common Property Regulations", statute: "Minister of Justice Decision No. 1610", language: "en" },
  { file: "division-of-common-property-regulations-ar.txt", source: "Division of Common Property Regulations", statute: "Minister of Justice Decision No. 1610", language: "ar" },
  { file: "bankruptcy-law-en.txt", source: "Bankruptcy Law", statute: "Royal Decree No. M/50", language: "en" },
  { file: "bankruptcy-law-ar.txt", source: "Bankruptcy Law", statute: "Royal Decree No. M/50", language: "ar" },
  { file: "implementing-regulations-of-the-bankruptcy-law-en.txt", source: "Implementing Regulations of the Bankruptcy Law", statute: "Council of Ministers Resolution No. 622", language: "en" },
  { file: "implementing-regulations-of-the-bankruptcy-law-ar.txt", source: "Implementing Regulations of the Bankruptcy Law", statute: "Council of Ministers Resolution No. 622", language: "ar" },
  { file: "rules-of-cross-border-bankruptcy-en.txt", source: "Rules of Cross-border Bankruptcy", statute: "Minister of Commerce Decision No. 149", language: "en" },
  { file: "rules-of-cross-border-bankruptcy-ar.txt", source: "Rules of Cross-border Bankruptcy", statute: "Minister of Commerce Decision No. 149", language: "ar" },
  { file: "rules-governing-bankruptcy-procedures-in-commercial-courts-en.txt", source: "Rules Governing Bankruptcy Procedures in Commercial Courts", statute: "Minister of Justice Decision No. 6421", language: "en" },
  { file: "rules-governing-bankruptcy-procedures-in-commercial-courts-ar.txt", source: "Rules Governing Bankruptcy Procedures in Commercial Courts", statute: "Minister of Justice Decision No. 6421", language: "ar" },
  { file: "statute-of-the-entrustment-and-liquidation-center-en.txt", source: "Statute of the Entrustment and Liquidation Center", statute: "Council of Ministers Resolution No. 415", language: "en" },
  { file: "statute-of-the-entrustment-and-liquidation-center-ar.txt", source: "Statute of the Entrustment and Liquidation Center", statute: "Council of Ministers Resolution No. 415", language: "ar" },
  { file: "law-of-arbitration-en.txt", source: "Law of Arbitration", statute: "Royal Decree No. M/34", language: "en" },
  { file: "law-of-arbitration-ar.txt", source: "Law of Arbitration", statute: "Royal Decree No. M/34", language: "ar" },
  { file: "implementing-regulations-of-the-law-of-arbitration-en.txt", source: "Implementing Regulations of the Law of Arbitration", statute: "Council of Ministers Resolution No. 541", language: "en" },
  { file: "implementing-regulations-of-the-law-of-arbitration-ar.txt", source: "Implementing Regulations of the Law of Arbitration", statute: "Council of Ministers Resolution No. 541", language: "ar" },
  { file: "statute-of-the-reconciliation-centre-en.txt", source: "Statute of the Reconciliation Centre", statute: "Council of Ministers Resolution No. 103", language: "en" },
  { file: "statute-of-the-reconciliation-centre-ar.txt", source: "Statute of the Reconciliation Centre", statute: "Council of Ministers Resolution No. 103", language: "ar" },
  { file: "operating-rules-and-procedures-of-reconciliation-offices-en.txt", source: "Operating Rules and Procedures of Reconciliation Offices", statute: "Minister of Justice Decision No. 5595", language: "en" },
  { file: "operating-rules-and-procedures-of-reconciliation-offices-ar.txt", source: "Operating Rules and Procedures of Reconciliation Offices", statute: "Minister of Justice Decision No. 5595", language: "ar" },
  { file: "the-code-of-law-practice-en.txt", source: "The Code of Law Practice", statute: "Royal Decree No. M/38", language: "en" },
  { file: "the-code-of-law-practice-ar.txt", source: "The Code of Law Practice", statute: "Royal Decree No. M/38", language: "ar" },
  { file: "implementing-regulations-of-the-code-of-law-practice-en.txt", source: "Implementing Regulations of the Code of Law Practice", statute: "Minister of Justice Decision No. 676", language: "en" },
  { file: "implementing-regulations-of-the-code-of-law-practice-ar.txt", source: "Implementing Regulations of the Code of Law Practice", statute: "Minister of Justice Decision No. 676", language: "ar" },
  { file: "implementing-regulation-for-regulating-the-licensing-of-foreign-law-firms-en.txt", source: "Implementing Regulation for Regulating the Licensing of Foreign Law Firms", statute: "Minister of Justice Decision No. 186", language: "en" },
  { file: "implementing-regulation-for-regulating-the-licensing-of-foreign-law-firms-ar.txt", source: "Implementing Regulation for Regulating the Licensing of Foreign Law Firms", statute: "Minister of Justice Decision No. 186", language: "ar" },
  { file: "rules-of-professional-conduct-for-lawyers-en.txt", source: "Rules of Professional Conduct for Lawyers", statute: "Minister of Justice Decision No. 3453", language: "en" },
  { file: "rules-of-professional-conduct-for-lawyers-ar.txt", source: "Rules of Professional Conduct for Lawyers", statute: "Minister of Justice Decision No. 3453", language: "ar" },
  { file: "rules-of-recording-filing-and-considering-the-disciplinary-action-en.txt", source: "Rules of Recording, Filing and Considering the Disciplinary Action", statute: "Minister of Justice Decision No. 2403", language: "en" },
  { file: "rules-of-recording-filing-and-considering-the-disciplinary-action-ar.txt", source: "Rules of Recording, Filing and Considering the Disciplinary Action", statute: "Minister of Justice Decision No. 2403", language: "ar" },
  { file: "rules-for-reducing-conflicts-of-interest-for-those-who-have-previously-worked-in-the-judiciary-and-those-of-similar-status-when-practicing-the-law-profession-en.txt", source: "Rules for Reducing Conflicts of Interest for Those Who Previously Worked in the Judiciary When Practicing the Law Profession", statute: "Minister of Justice Decision No. 1417", language: "en" },
  { file: "rules-for-reducing-conflicts-of-interest-for-those-who-have-previously-worked-in-the-judiciary-and-those-of-similar-status-when-practicing-the-law-profession-ar.txt", source: "Rules for Reducing Conflicts of Interest for Those Who Previously Worked in the Judiciary When Practicing the Law Profession", statute: "Minister of Justice Decision No. 1417", language: "ar" },
  { file: "mechanism-for-the-use-of-a-lawyer-at-the-expense-of-the-state-for-the-accused-in-major-crimes-en.txt", source: "Mechanism for the Use of a Lawyer at the Expense of the State for the Accused in Major Crimes", statute: "Minister of Justice Decision No. 1529", language: "en" },
  { file: "mechanism-for-the-use-of-a-lawyer-at-the-expense-of-the-state-for-the-accused-in-major-crimes-ar.txt", source: "Mechanism for the Use of a Lawyer at the Expense of the State for the Accused in Major Crimes", statute: "Minister of Justice Decision No. 1529", language: "ar" },
  { file: "rules-for-determining-officeholders-and-experts-fees-en.txt", source: "Rules for Determining Officeholders' and Experts' Fees", statute: "Minister of Justice Decision No. 2514", language: "en" },
  { file: "rules-for-determining-officeholders-and-experts-fees-ar.txt", source: "Rules for Determining Officeholders' and Experts' Fees", statute: "Minister of Justice Decision No. 2514", language: "ar" },
  { file: "notarization-law-en.txt", source: "Notarization Law", statute: "Royal Decree No. M/164", language: "en" },
  { file: "notarization-law-ar.txt", source: "Notarization Law", statute: "Royal Decree No. M/164", language: "ar" },
  { file: "implementing-regulations-of-notarization-law-en.txt", source: "Implementing Regulations of Notarization Law", statute: "Minister of Justice Decision No. 1948", language: "en" },
  { file: "implementing-regulations-of-notarization-law-ar.txt", source: "Implementing Regulations of Notarization Law", statute: "Minister of Justice Decision No. 1948", language: "ar" },
  { file: "law-on-the-protection-of-informants-witnesses-experts-and-victims-en.txt", source: "Law on the Protection of Informants, Witnesses, Experts, and Victims", statute: "Royal Decree No. M/148", language: "en" },
  { file: "law-on-the-protection-of-informants-witnesses-experts-and-victims-ar.txt", source: "Law on the Protection of Informants, Witnesses, Experts, and Victims", statute: "Royal Decree No. M/148", language: "ar" },
  { file: "juveniles-law-en.txt", source: "Juveniles Law", statute: "Royal Decree No. M/113", language: "en" },
  { file: "juveniles-law-ar.txt", source: "Juveniles Law", statute: "Royal Decree No. M/113", language: "ar" },
  { file: "implementing-regulations-of-the-juveniles-law-en.txt", source: "Implementing Regulations of the Juveniles Law", statute: "Council of Ministers Resolution No. 237", language: "en" },
  { file: "implementing-regulations-of-the-juveniles-law-ar.txt", source: "Implementing Regulations of the Juveniles Law", statute: "Council of Ministers Resolution No. 237", language: "ar" },
  { file: "statute-of-the-alimony-fund-en.txt", source: "Statute of the Alimony Fund", statute: "Council of Ministers Resolution No. 679", language: "en" },
  { file: "statute-of-the-alimony-fund-ar.txt", source: "Statute of the Alimony Fund", statute: "Council of Ministers Resolution No. 679", language: "ar" },
  { file: "anti-money-laundering-law-en.txt", source: "Anti-Money Laundering Law", statute: "Royal Decree No. M/20", language: "en" },
  { file: "anti-money-laundering-law-ar.txt", source: "Anti-Money Laundering Law", statute: "Royal Decree No. M/20", language: "ar" },
  { file: "law-of-combating-crimes-of-terrorism-and-its-financing-en.txt", source: "Law of Combating Crimes of Terrorism and its Financing", statute: "Royal Decree No. M/21", language: "en" },
  { file: "law-of-combating-crimes-of-terrorism-and-its-financing-ar.txt", source: "Law of Combating Crimes of Terrorism and its Financing", statute: "Royal Decree No. M/21", language: "ar" },
  { file: "law-of-real-estate-registration-en.txt", source: "Law of Real Estate Registration", statute: "Royal Decree No. M/91", language: "en" },
  { file: "law-of-real-estate-registration-ar.txt", source: "Law of Real Estate Registration", statute: "Royal Decree No. M/91", language: "ar" },
  { file: "implementing-regulations-of-the-law-of-real-estate-registration-en.txt", source: "Implementing Regulations of the Law of Real Estate Registration", statute: "REGA Board Resolution No. 20/1/T/22", language: "en" },
  { file: "implementing-regulations-of-the-law-of-real-estate-registration-ar.txt", source: "Implementing Regulations of the Law of Real Estate Registration", statute: "REGA Board Resolution No. 20/1/T/22", language: "ar" },
  { file: "law-of-real-estate-ownership-by-non-saudis-en.txt", source: "Law of Real Estate Ownership by Non-Saudis", statute: "Royal Decree No. M/14", language: "en" },
  { file: "law-of-real-estate-ownership-by-non-saudis-ar.txt", source: "Law of Real Estate Ownership by Non-Saudis", statute: "Royal Decree No. M/14", language: "ar" },
  { file: "law-of-ownership-subdivision-and-management-of-real-estate-units-en.txt", source: "Law of Ownership, Subdivision, and Management of Real Estate Units", statute: "Royal Decree No. M/85", language: "en" },
  { file: "law-of-ownership-subdivision-and-management-of-real-estate-units-ar.txt", source: "Law of Ownership, Subdivision, and Management of Real Estate Units", statute: "Royal Decree No. M/85", language: "ar" },
  { file: "the-implementing-regulations-of-law-of-ownership-subdivision-and-management-of-real-estate-units-en.txt", source: "The Implementing Regulations of Law of Ownership, Subdivision, and Management of Real Estate Units", statute: "Minister of Municipal and Rural Affairs Decision No. 168", language: "en" },
  { file: "the-implementing-regulations-of-law-of-ownership-subdivision-and-management-of-real-estate-units-ar.txt", source: "The Implementing Regulations of Law of Ownership, Subdivision, and Management of Real Estate Units", statute: "Minister of Municipal and Rural Affairs Decision No. 168", language: "ar" },
  { file: "real-estate-finance-law-en.txt", source: "Real Estate Finance Law", statute: "Royal Decree No. M/50", language: "en" },
  { file: "real-estate-finance-law-ar.txt", source: "Real Estate Finance Law", statute: "Royal Decree No. M/50", language: "ar" },
  { file: "registered-real-estate-mortgage-law-en.txt", source: "Registered Real Estate Mortgage Law", statute: "Royal Decree No. M/49", language: "en" },
  { file: "registered-real-estate-mortgage-law-ar.txt", source: "Registered Real Estate Mortgage Law", statute: "Royal Decree No. M/49", language: "ar" },
  { file: "law-of-disposition-of-municipal-real-estate-en.txt", source: "Law of Disposition of Municipal Real Estate", statute: "Royal Decree No. M/64", language: "en" },
  { file: "law-of-disposition-of-municipal-real-estate-ar.txt", source: "Law of Disposition of Municipal Real Estate", statute: "Royal Decree No. M/64", language: "ar" },
  { file: "regulations-for-the-disposition-of-municipal-real-estate-en.txt", source: "Regulations for the Disposition of Municipal Real Estate", statute: "High Order No. 40152", language: "en" },
  { file: "regulations-for-the-disposition-of-municipal-real-estate-ar.txt", source: "Regulations for the Disposition of Municipal Real Estate", statute: "High Order No. 40152", language: "ar" },
  { file: "law-of-eminent-domain-and-temporary-taking-of-property-en.txt", source: "Law of Eminent Domain and Temporary Taking of Property", statute: "Royal Decree No. M/15", language: "en" },
  { file: "law-of-eminent-domain-and-temporary-taking-of-property-ar.txt", source: "Law of Eminent Domain and Temporary Taking of Property", statute: "Royal Decree No. M/15", language: "ar" },
  { file: "statute-of-real-estate-ownership-by-gulf-cooperation-council-GCC-nationals-within-member-states-for-residential-and-investment-purposes-en.txt", source: "Statute of Real Estate Ownership by GCC Nationals within Member States for Residential and Investment Purposes", statute: "Royal Decree No. M/22", language: "en" },
  { file: "statute-of-real-estate-ownership-by-gulf-cooperation-council-GCC-nationals-within-member-states-for-residential-and-investment-purposes-ar.txt", source: "Statute of Real Estate Ownership by GCC Nationals within Member States for Residential and Investment Purposes", statute: "Royal Decree No. M/22", language: "ar" },
  { file: "moj-legal-dictionary-en.txt", source: "MOJ Dictionary of Legal Terms", statute: "Wizarat al-Adl — First Edition 1444H/2022", language: "en" },
  { file: "moj-legal-dictionary-ar.txt", source: "MOJ Dictionary of Legal Terms", statute: "Wizarat al-Adl — First Edition 1444H/2022", language: "ar" },
   */
  { file: "law-of-criminal-procedure-annotated-ar.txt", source: "Law of Criminal Procedure — Annotated Consolidated Edition", statute: "Royal Decree No. M/2 (Annotated, MOJ Research Centre 1442H)", language: "ar" },
];

async function main() {
  console.log(`Starting Mizan legal ingestion — ${SOURCES.length} files\n`);

  let completed = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const source of SOURCES) {
    const filePath = `./data/sources/${source.file}`;
    const resolved = path.resolve(filePath);
    const num = completed + skipped + failed.length + 1;

    if (!fs.existsSync(resolved)) {
      console.log(`[${num}/${SOURCES.length}] SKIP — ${source.file}`);
      skipped++;
      continue;
    }

    console.log(`[${num}/${SOURCES.length}] Ingesting: ${source.source} (${source.language.toUpperCase()})`);

    try {
      const text = fs.readFileSync(resolved, "utf-8");
      await ingestDocument({
        text,
        source: source.source,
        jurisdiction: "Saudi Arabia",
        statute: source.statute,
        language: source.language,
      });
      completed++;
      console.log(`  Done.\n`);
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}\n`);
      failed.push(source.file);
    }

    // Pause between documents
    await sleep(5000);
  }

  console.log("\n── Ingestion Summary ──────────────────────────");
  console.log(`Completed: ${completed}`);
  console.log(`Skipped (file not found): ${skipped}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log("Failed files:");
    failed.forEach((f) => console.log(`  - ${f}`));
  }
  console.log("───────────────────────────────────────────────");
}

main().catch(console.error);
