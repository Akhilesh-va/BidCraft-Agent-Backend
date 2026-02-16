import type { Request, Response } from 'express';
import Groq from 'groq-sdk';
import RFP from '../models/RFP';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const refineProposal = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { approvedOverview, existingProposal } = req.body;
    if (!approvedOverview) return res.status(400).json({ error: 'approvedOverview required' });
    if (!existingProposal) return res.status(400).json({ error: 'existingProposal required' });

    const provider = req.user;
    const companyProfile = provider?.companyProfile || {};

    const prompt = `Refine and upgrade the existing RFP proposal into a CLIENT-READY, ENTERPRISE-GRADE RFP RESPONSE strictly aligned with the provider's capabilities.

INPUTS:
1) Approved Client Overview (final): ${JSON.stringify(approvedOverview)}
2) Provider Company Profile: ${JSON.stringify(companyProfile)}
3) Existing Proposal JSON: ${JSON.stringify(existingProposal)}

CRITICAL RULES:
- Only propose services and technologies present in the provider profile.
- Pricing must use provider pricing rules.
- Delivery must match provider delivery capability.
- Do not hallucinate. If missing info, state assumptions.

TASKS (refinement):
1) Requirement Understanding and normalization into REQ-01...
2) Requirement -> Capability mapping with status (Covered|Partial|Not Covered)
3) Solution Architecture using provider tech stack
4) Delivery Plan with phases, milestones, owners
5) Pricing Calculation based on provider pricing rules and margins
6) Requirement Traceability Matrix
7) Assumptions & Exclusions
8) Risks & Mitigations
9) Acceptance Criteria & Governance

OUTPUT: Return ONLY a single JSON object that matches this schema exactly (no extra keys):
{ "executive_summary":{ "overview":"", "value_proposition":"" }, "understanding_of_requirements":{ "project_overview":"", "key_objectives":[],"in_scope":[],"out_of_scope":[] }, "requirement_mapping":[{ "requirement_id":"REQ-01","description":"","mapped_service":"","mapped_technology":"","status":"" }], "solution_architecture":{ "architecture_overview":"", "components":[], "security_considerations":[], "scalability_notes":[] }, "delivery_plan":{ "phases":[{"phase_name":"","duration_weeks":0,"deliverables":[]}], "total_duration_months":0 }, "pricing_and_commercials":{ "currency":"", "team_composition":{ "role":"","count":0,"monthly_cost":0 }, "total_cost":0, "pricing_notes":"" }, "requirement_traceability_matrix":[{ "requirement_id":"REQ-01","requirement":"","solution_reference":"","status":"" }], "assumptions_and_exclusions":{ "assumptions":[],"exclusions":[] }, "risk_and_mitigation":[{ "risk":"","impact":"Low | Medium | High","mitigation":"" }], "company_credentials":{ "relevant_experience":[],"case_studies":[] } }

Return ONLY the JSON object. No explanation. No markdown.`;

    const model = process.env.GROQ_MODEL || process.env.GROQ_ANALYZE_MODEL || 'llama-3.1-8b-instant';

    let resp: any;
    if ((groq as any).chat && (groq as any).chat.completions && (groq as any).chat.completions.create) {
      resp = await (groq as any).chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.0,
        response_format: { type: 'json_object' }
      });
    } else if ((groq as any).generate) {
      resp = await (groq as any).generate({ model, input: prompt });
    } else {
      if (!process.env.GROQ_API_URL) throw new Error('Groq SDK not available and GROQ_API_URL not set for fallback');
      const r = await fetch(process.env.GROQ_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.GROQ_API_KEY ? { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } : {}) },
        body: JSON.stringify({ prompt, model, max_tokens: 4000 })
      });
      if (!r.ok) throw new Error('Groq HTTP fallback failed');
      resp = await r.text();
    }

    let outText = '';
    if (typeof resp === 'string') outText = resp;
    else if (resp && typeof resp === 'object') {
      const choice = resp.choices && resp.choices[0];
      const message = choice?.message;
      const content = message?.content;
      if (content) {
        if (typeof content === 'string') outText = content;
        else if (typeof content === 'object') outText = content.text || content?.parts?.join('') || JSON.stringify(content);
      }
      outText = outText || resp.output_text || resp.text || JSON.stringify(resp);
    } else outText = String(resp);

    const jsonMatch = outText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Refine response did not return JSON. Full output:', outText);
      throw new Error('Refine response did not return JSON');
    }
    const refinedRaw = JSON.parse(jsonMatch[0]);
    // Sanitize to allowed keys only (same schema as generate)
    const allowedKeys = [
      'executive_summary',
      'understanding_of_requirements',
      'requirement_mapping',
      'solution_architecture',
      'delivery_plan',
      'pricing_and_commercials',
      'requirement_traceability_matrix',
      'assumptions_and_exclusions',
      'risk_and_mitigation',
      'company_credentials'
    ];
    const emptyStructure = {
      executive_summary: { overview: '', value_proposition: '' },
      understanding_of_requirements: { project_overview: '', key_objectives: [], in_scope: [], out_of_scope: [] },
      requirement_mapping: [],
      solution_architecture: { architecture_overview: '', components: [], security_considerations: [], scalability_notes: [] },
      delivery_plan: { phases: [], total_duration_months: 0 },
      pricing_and_commercials: { currency: '', team_composition: { role: '', count: 0, monthly_cost: 0 }, total_cost: 0, pricing_notes: '' },
      requirement_traceability_matrix: [],
      assumptions_and_exclusions: { assumptions: [], exclusions: [] },
      risk_and_mitigation: [],
      company_credentials: { relevant_experience: [], case_studies: [] }
    };
    const refined: any = {};
    for (const k of allowedKeys) {
      refined[k] = (refinedRaw && refinedRaw[k] !== undefined) ? refinedRaw[k] : emptyStructure[k as keyof typeof emptyStructure];
    }

    // Save as new RFP record with generatedProposal
    const rfp = await RFP.create({
      clientName: approvedOverview?.projectOverview || approvedOverview?.company_identity?.name || 'Client',
      budget: approvedOverview?.budget,
      deadline: approvedOverview?.deadline,
      requirements: approvedOverview?.keyRequirements || [],
      status: 'Completed',
      generatedProposal: refined
    });

    return res.json({ ok: true, rfp, refined });
  } catch (err: any) {
    console.error('refineProposal failed', err);
    return res.status(500).json({ error: 'refineProposal failed', details: err.message || String(err) });
  }
};

