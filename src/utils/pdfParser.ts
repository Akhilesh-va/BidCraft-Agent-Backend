import pdfParse from "pdf-parse";

export const extractText = async (buffer: Buffer): Promise<string> => {
  try {
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (err) {
    return "";
  }
};

export const parseProviderProfile = (text: string) => {
  const techStackMatch = text.match(/Tech Stack[:\s]*([A-Za-z0-9, \-/&]+)/i);
  const ratesMatch = text.match(/Rate[s]?:?\s*\$?([\d,.]+)/i);
  const companyMatch = text.match(/Company[:\s]*([A-Za-z0-9 .&-]+)/i);

  const techStack = techStackMatch
    ? techStackMatch[1]
        .split(/[,\n\/&]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const baseRate = ratesMatch
    ? parseFloat(ratesMatch[1].replace(/,/g, ""))
    : undefined;
  const companyName = companyMatch ? companyMatch[1].trim() : undefined;

  return { companyName, techStack, baseRate };
};

export const parseRFP = (text: string) => {
  // budget: look for common labels or currency symbols
  const budgetMatch =
    text.match(
      /(?:Budget|Estimated Budget|Total Budget|Budget Range)[:\s]*\$?\s*([\d.,]+)/i,
    ) || text.match(/(?:£|€|\$)\s*([\d,]+)/);

  // deadline: common labels or "due by" constructs
  const deadlineMatch =
    text.match(
      /(?:Deadline|Submission Deadline|Due Date|Due by)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[A-Za-z0-9 ,]+)/i,
    ) || text.match(/(due by|submit by)\s*([A-Za-z0-9 ,]+)/i);

  // client name heuristics
  const clientMatch = text.match(
    /(?:Client|Client Name|Company|Organization)[:\s]*([A-Za-z0-9 .&-]+)/i,
  );

  // requirements section: look for common headings and capture a block
  const reqHeadingMatch = text.match(
    /(?:Requirements|Scope of Work|Deliverables|Key Requirements|Scope)[:\s]*([\s\S]{0,2000})/i,
  );

  const budget = budgetMatch
    ? parseInt(budgetMatch[1].replace(/,/g, ""), 10)
    : undefined;
  let deadline: Date | undefined;
  if (deadlineMatch) {
    const d = (deadlineMatch[1] || deadlineMatch[2] || "").trim();
    const date = new Date(d);
    if (!isNaN(date.getTime())) deadline = date;
  }

  // parse requirements into array
  let requirements: string[] = [];
  if (reqHeadingMatch && reqHeadingMatch[1]) {
    requirements = reqHeadingMatch[1]
      .split(/(?:\r?\n|[-•\u2022]|\d+\.)/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
  } else {
    const bullets = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.match(/^[-•\u2022]|\d+\./));
    if (bullets.length) {
      requirements = bullets
        .map((b) => b.replace(/^[-•\u2022]\s*/, "").replace(/^\d+\.\s*/, ""))
        .slice(0, 50);
    }
  }

  const clientName = clientMatch ? clientMatch[1].trim() : undefined;

  return { rawText: text, clientName, budget, deadline, requirements };
};
