import Groq from 'groq-sdk';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ANALYZE_MODEL = process.env.GROQ_ANALYZE_MODEL || 'llama-3.1-8b-instant';
// Initialize Groq SDK only when API key is provided to avoid throwing at module load time
let groqClient: any = null;
try {
  if (process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  } else {
    console.warn('GROQ_API_KEY not set — Groq features are disabled. Set GROQ_API_KEY in .env to enable.');
  }
} catch (err) {
  console.error('Failed to initialize Groq SDK:', err);
  groqClient = null;
}

export const analyzeRequirements = async (rfp: any) => {
  await sleep(300);
  return {
    summary: `Analyzed ${rfp.requirements?.length || 0} requirements.`,
    keyPoints: (rfp.requirements || []).slice(0, 5),
    risks: ['Integration complexity', 'Timeline uncertainty']
  };
};

export const architectSolution = async (analysis: any, provider: any) => {
  await sleep(400);
  return {
    architecture: {
      overview: `Proposed solution using ${provider.techStack && provider.techStack.slice(0,3).join(', ')}`,
      components: [
        { name: 'API', tech: 'Node.js/Express' },
        { name: 'DataStore', tech: 'MongoDB' },
      ]
    },
    effortEstimate: '6-8 weeks'
  };
};

export const calculatePricing = async (solution: any, provider: any, rfp: any) => {
  await sleep(300);
  const base = provider.baseRate || 100;
  const estimate = Math.max(base * 40, rfp.budget ? rfp.budget * 0.6 : base * 50);
  return {
    pricingModel: provider.pricingModel || 'Time & Materials',
    total: Math.round(estimate),
    lineItems: [
      { item: 'Development', amount: Math.round(estimate * 0.7) },
      { item: 'Project Management', amount: Math.round(estimate * 0.2) },
      { item: 'Contingency', amount: Math.round(estimate * 0.1) },
    ]
  };
};

export const draftProposal = async (analysis: any, solution: any, pricing: any, rfp: any, provider: any, strategy = 'default') => {
  await sleep(300);
  return {
    title: `${provider.companyName || 'Provider'} Proposal for ${rfp.clientName || 'Client'}`,
    executiveSummary: `We propose a ${strategy} approach to meet the client's needs.`,
    sections: {
      analysis,
      solution,
      pricing
    },
    signature: {
      company: provider.companyName || 'Provider',
      contact: provider.phone
    }
  };
};

export const extractCompanyProfile = async (rawText: string) => {
  // Helper: small heuristic fallback when Groq is unavailable or rate-limited
  const fallbackProfile = (text: string) => {
    // pick first non-empty line as name candidate
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    let candidate = lines.length ? lines[0] : 'Provider';
    // try to find company-like token
    const companyMatch = text.match(/([A-Z][\w&\-\s]{2,}?(?:Ltd|LLP|Pvt|Inc|PLC|Corporation|Services|Solutions|Systems))/i);
    if (companyMatch) candidate = companyMatch[1].trim();
    // extract an email if present
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
    const email = emailMatch ? emailMatch[0] : undefined;
    // simple tech keywords
    const techKeywords = ['React', 'React Native', 'Node.js', 'Express', 'NestJS', 'Java', 'Spring', 'MongoDB', 'PostgreSQL', 'MySQL', 'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker'];
    const foundTech = techKeywords.filter(k => new RegExp('\\b' + k.replace('.', '\\.') + '\\b', 'i').test(text));

    return {
      company_identity: {
        name: candidate,
        industries: [],
        company_size: 'Not specified',
        delivery_regions: []
      },
      services: {},
      tech_stack: {
        frontend: foundTech.filter(t => /React|Next/.test(t)),
        backend: foundTech.filter(t => /Node|Java|Express|NestJS|Spring/.test(t)),
        database: foundTech.filter(t => /MongoDB|PostgreSQL|MySQL/.test(t)),
        cloud: foundTech.filter(t => /AWS|GCP|Azure/.test(t)),
        devops: foundTech.filter(t => /Kubernetes|Docker/.test(t))
      },
      delivery_capability: {},
      pricing_rules: {},
      commercial_constraints: {},
      security_and_compliance: {},
      experience_and_case_studies: {},
      proposal_preferences: {},
      // attach a minimal contact if we found email
      ...(email ? { company_contact_email: email } : {})
    };
  };

  // GROQ_API_URL is optional when using the official SDK; ensure API key is present
  if (!process.env.GROQ_API_KEY) {
    // use fallback extractor when key not set
    console.warn('GROQ_API_KEY not set — returning heuristic fallback profile.');
    return fallbackProfile(rawText);
  }

  const prompt = `You are an expert extractor. Given the following raw company profile text, output a single valid JSON object that strictly follows this schema (no extra keys):

{
  "company_identity": {
    "name": string,
    "industries": [string],
    "company_size": string,
    "delivery_regions": [string]
  },
  "services": { /* booleans */ },
  "tech_stack": { "frontend":[string], "backend":[string], "database":[string], "cloud":[string], "devops":[string] },
  "delivery_capability": { "team_composition": {...}, "delivery_models":[string], "typical_project_duration_months":[number] },
  "pricing_rules": { "currency": string, "monthly_cost_per_role": {...}, "margin_percentage": number },
  "commercial_constraints": { "minimum_engagement_months": number, "payment_terms": string, "escalation_buffer_percentage": number },
  "security_and_compliance": { "security_practices":[string], "certifications":[string], "data_privacy_ready": boolean },
  "experience_and_case_studies": { "primary_industries":[string], "case_studies":[{ "industry":string, "solution":string, "scale":string }] },
  "proposal_preferences": { "tone": string, "branding_required": boolean, "standard_sections":[string] }
}

Return only the JSON object. Do NOT include any explanation. Raw text:
-----
${rawText}
-----`;

  const model = process.env.GROQ_MODEL || ANALYZE_MODEL;
  // Prefer the SDK chat completions API when available (groq.chat.completions.create)
  let resp: any = null;
  let sdkError: any = null;
  try {
    const messages = [
      { role: 'system', content: 'You are an expert extractor that returns only JSON objects.' },
      { role: 'user', content: prompt }
    ];

    if ((groqClient as any).chat && (groqClient as any).chat.completions && (groqClient as any).chat.completions.create) {
      const completion = await (groqClient as any).chat.completions.create({
        model,
        messages,
        max_tokens: 3000,
        temperature: 0.0,
        // ask for JSON object response to improve reliability
        response_format: { type: 'json_object' }
      });
      resp = completion;
    } else if ((groqClient as any).generate) {
      resp = await (groqClient as any).generate({ model, input: prompt });
    } else if ((groqClient as any).call) {
      resp = await (groqClient as any).call({ model, prompt });
    } else {
      resp = await (groqClient as any).request?.({ model, prompt });
    }
  } catch (e) {
    sdkError = e;
  }

  // If SDK attempt failed and a direct API URL is configured, try HTTP fallback
  if (!resp && sdkError && process.env.GROQ_API_URL) {
    try {
      const payload = { prompt, model, max_tokens: 3000 };
      const r = await fetch(process.env.GROQ_API_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.GROQ_API_KEY ? { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Groq HTTP fallback error: ${r.status} ${t}`);
      }
      resp = await r.text();
    } catch (httpErr) {
      throw new Error(`Groq SDK call failed: ${sdkError?.message || String(sdkError)}; HTTP fallback error: ${httpErr?.message || String(httpErr)}`);
    }
  }
  if (!resp && sdkError) {
    console.warn('Groq SDK call failed and no HTTP fallback or it failed. Returning heuristic fallback.', sdkError);
    return fallbackProfile(rawText);
  }

  if (!resp) throw new Error('Groq did not return a response');

  let outText = '';
  if (typeof resp === 'string') {
    outText = resp;
  } else if (typeof resp === 'object') {
    // Chat completion shape: resp.choices[0].message.content
    const choice = resp.choices && resp.choices[0];
    const message = choice?.message;
    const content = message?.content;
    if (content) {
      // content may be a string or an object with text field
      if (typeof content === 'string') outText = content;
      else if (typeof content === 'object') outText = content.text || content?.parts?.join('') || JSON.stringify(content);
    }
    outText = outText || resp.output_text || resp.text || resp.result || JSON.stringify(resp);
  } else {
    outText = String(resp);
  }

  // Log model output for debugging (dev only)
  console.debug('Groq output (trimmed):', outText.slice(0, 2000));

  const jsonMatch = outText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Groq did not return JSON. Full output:', outText);
    // fallback to heuristic extractor rather than throwing
    return fallbackProfile(rawText);
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    console.error('Failed to parse Groq JSON. Full output:', outText, 'parseError:', err);
    // fallback to heuristic extractor
    return fallbackProfile(rawText);
  }
};

// Extract structured SRS summary from raw SRS text using Groq (strict JSON output)
export const extractSRS = async (rawText: string) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set. Set GROQ_API_KEY in your .env to call the Groq service.');
  }

  const prompt = `You are an expert at summarizing Software Requirement Specifications (SRS).
Given the raw SRS text below, extract a STRICT JSON object that exactly matches the following schema (no extra keys):

{
  "projectOverview": string,
  "keyRequirements": [ string, ... ],   // 2-5 items, core functional requirements only
  "scopeAndModules": [ string, ... ],   // 2-5 items, major system modules or feature areas
  "constraints": [ string, ... ]        // 2-5 items, technical/operational/compliance constraints
}

Return ONLY the JSON object and nothing else. If any field cannot be determined, provide an empty array or a short string saying "Not specified".

Raw SRS text:
-----
${rawText}
-----`;

  const model = process.env.GROQ_MODEL || ANALYZE_MODEL;
  // call SDK similar to company extractor
  let resp: any = null;
  let sdkError: any = null;
  try {
    if ((groqClient as any).chat && (groqClient as any).chat.completions && (groqClient as any).chat.completions.create) {
      resp = await (groqClient as any).chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.0,
        response_format: { type: 'json_object' }
      });
    } else if ((groqClient as any).generate) {
      resp = await (groqClient as any).generate({ model, input: prompt });
    } else if ((groqClient as any).request) {
      resp = await (groqClient as any).request({ model, prompt });
    } else {
      resp = await (groqClient as any).call?.({ model, prompt });
    }
  } catch (e) {
    sdkError = e;
  }

  if (!resp && sdkError && process.env.GROQ_API_URL) {
    try {
      const r = await fetch(process.env.GROQ_API_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.GROQ_API_KEY ? { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } : {})
        },
        body: JSON.stringify({ prompt, model, max_tokens: 2000 })
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Groq HTTP fallback error: ${r.status} ${t}`);
      }
      resp = await r.text();
    } catch (httpErr) {
      throw new Error(`Groq SDK call failed: ${sdkError?.message || String(sdkError)}; HTTP fallback error: ${httpErr?.message || String(httpErr)}`);
    }
  }
  if (!resp && sdkError) {
    throw new Error(`Groq SDK call failed: ${sdkError?.message || String(sdkError)}`);
  }

  let outText = '';
  if (typeof resp === 'string') outText = resp;
  else if (typeof resp === 'object') {
    const choice = resp.choices && resp.choices[0];
    const message = choice?.message;
    const content = message?.content;
    if (content) {
      if (typeof content === 'string') outText = content;
      else if (typeof content === 'object') outText = content.text || content?.parts?.join('') || JSON.stringify(content);
    }
    outText = outText || resp.output_text || resp.text || resp.result || JSON.stringify(resp);
  } else {
    outText = String(resp);
  }

  const jsonMatch = outText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Groq did not return JSON for SRS. Full output:', outText);
    throw new Error('Groq did not return JSON');
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    // Basic normalization: ensure arrays present and length limits
    parsed.keyRequirements = Array.isArray(parsed.keyRequirements) ? parsed.keyRequirements.slice(0,5) : [];
    parsed.scopeAndModules = Array.isArray(parsed.scopeAndModules) ? parsed.scopeAndModules.slice(0,5) : [];
    parsed.constraints = Array.isArray(parsed.constraints) ? parsed.constraints.slice(0,5) : [];
    parsed.projectOverview = parsed.projectOverview || 'Not specified';
    return parsed;
  } catch (err: any) {
    console.error('Failed to parse Groq JSON for SRS. Full output:', outText, 'parseError:', err);
    throw new Error('Groq returned malformed JSON for SRS: ' + (err.message || String(err)));
  }
};

