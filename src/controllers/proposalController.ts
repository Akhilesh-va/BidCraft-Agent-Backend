import type { Request, Response } from 'express';
import Groq from 'groq-sdk';
import { extractText } from '../utils/pdfParser';
import RFP from '../models/RFP';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const generateProposalFromOverview = async (req: Request & { user?: any }, res: Response) => {
  try {
    // approvedOverview may be sent as a form field (string) or in JSON body
    let approvedOverview: any = null;
    if (req.body && req.body.approvedOverview) {
      try { approvedOverview = typeof req.body.approvedOverview === 'string' ? JSON.parse(req.body.approvedOverview) : req.body.approvedOverview; } catch { approvedOverview = req.body.approvedOverview; }
    } else if (req.body && Object.keys(req.body).length) {
      approvedOverview = req.body;
    }

    if (!approvedOverview) return res.status(400).json({ error: 'approvedOverview required in body or form field' });

    // optional uploaded PDF (SRS) for richer context
    // If approvedOverview already contains parsed fullText/rawText, prefer that.
    let srsRawText = '';
    if (approvedOverview && (approvedOverview.rawText || approvedOverview.fullText || approvedOverview.parsedText)) {
      srsRawText = approvedOverview.rawText || approvedOverview.fullText || approvedOverview.parsedText;
    } else {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file) {
        srsRawText = await extractText(file.buffer);
      }
    }

    // provider profile from user
    const provider = req.user;
    const companyProfile = provider?.companyProfile || {};

    const prompt = `Your job: generate a complete, enterprise-grade RFP response strictly from the inputs below. Do NOT hallucinate. If information is missing, state assumptions.

INPUT 1 — Approved Client Overview (final, single source of truth):
${JSON.stringify(approvedOverview, null, 2)}

INPUT 2 — Provider Company Profile (what provider CAN offer):
${JSON.stringify(companyProfile, null, 2)}

INPUT 3 — SRS PDF raw text (optional, may be blank):
${srsRawText ? srsRawText : '[none]'}

TASKS in order:
1) Understand requirements and normalize into REQ-01... list
2) Map each requirement to provider services & tech stack (mark Not Covered if unsupported)
3) Design solution architecture using ONLY provider tech stack
4) Create delivery plan & timeline based on provider delivery capability
5) Calculate pricing using provider pricing rules (currency and monthly costs)
6) Produce Requirement Traceability Matrix (RTM)
7) State assumptions & exclusions
8) Identify risks & mitigations
9) Structure final proposal as strict JSON only using this schema:

{ "executive_summary":{ "overview":"", "value_proposition":"" }, "understanding_of_requirements":{ "project_overview":"", "key_objectives":[],"in_scope":[],"out_of_scope":[] }, "requirement_mapping":[{ "requirement_id":"REQ-01","description":"","mapped_service":"","mapped_technology":"","status":"" }], "solution_architecture":{ "architecture_overview":"", "components":[], "security_considerations":[], "scalability_notes":[] }, "delivery_plan":{ "phases":[{"phase_name":"","duration_weeks":0,"deliverables":[]}], "total_duration_months":0 }, "pricing_and_commercials":{ "currency":"", "team_composition":{ "role":"","count":0,"monthly_cost":0 }, "total_cost":0, "pricing_notes":"" }, "requirement_traceability_matrix":[{ "requirement_id":"REQ-01","requirement":"","solution_reference":"","status":"" }], "assumptions_and_exclusions":{ "assumptions":[],"exclusions":[] }, "risk_and_mitigation":[{ "risk":"","impact":"Low | Medium | High","mitigation":"" }], "company_credentials":{ "relevant_experience":[],"case_studies":[] } }

Return ONLY the JSON object, no extra text.`;

    const model = process.env.GROQ_MODEL || process.env.GROQ_ANALYZE_MODEL || 'llama-3.1-8b-instant';

    // call SDK chat if available
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
      // fallback HTTP if configured
      if (!process.env.GROQ_API_URL) throw new Error('Groq SDK not available and GROQ_API_URL not set for fallback');
      const r = await fetch(process.env.GROQ_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.GROQ_API_KEY ? { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } : {}) },
        body: JSON.stringify({ prompt, model, max_tokens: 4000 })
      });
      if (!r.ok) throw new Error('Groq HTTP fallback failed');
      resp = await r.text();
    }

    // normalize assistant content
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
      console.error('Proposal generator did not return JSON. Full output:', outText);
      throw new Error('Proposal generator did not return JSON');
    }
    const proposalRaw = JSON.parse(jsonMatch[0]);
    // Sanitize proposal: keep only allowed top-level keys and ensure required sub-structures exist
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

    const proposal = {} as any;
    for (const k of allowedKeys) {
      proposal[k] = (proposalRaw && proposalRaw[k] !== undefined) ? proposalRaw[k] : emptyStructure[k as keyof typeof emptyStructure];
    }

    // Save as RFP document with generatedProposal
    const rfp = await RFP.create({
      clientName: approvedOverview?.company_identity?.name || approvedOverview?.projectOverview || 'Client',
      budget: approvedOverview?.budget || undefined,
      deadline: approvedOverview?.deadline || undefined,
      requirements: approvedOverview?.keyRequirements || [],
      status: 'Completed',
      generatedProposal: proposal
    });
    // Immediately refine the proposal using provider profile and approved overview
    try {
      const refinePrompt = `Refine and upgrade the existing RFP proposal into a CLIENT-READY, ENTERPRISE-GRADE RFP RESPONSE strictly aligned with the provider's capabilities.

INPUT 1 — Approved Client Overview (final): ${JSON.stringify(approvedOverview)}
INPUT 2 — Provider Company Profile: ${JSON.stringify(companyProfile)}
INPUT 3 — Existing Proposal JSON: ${JSON.stringify(proposal)}

Return ONLY a single JSON object that matches the required RFP response schema. Do NOT include extra text.`;

      let refineResp: any;
      if ((groq as any).chat && (groq as any).chat.completions && (groq as any).chat.completions.create) {
        refineResp = await (groq as any).chat.completions.create({
          model,
          messages: [{ role: 'user', content: refinePrompt }],
          max_tokens: 4000,
          temperature: 0.0,
          response_format: { type: 'json_object' }
        });
      } else if ((groq as any).generate) {
        refineResp = await (groq as any).generate({ model, input: refinePrompt });
      } else {
        if (!process.env.GROQ_API_URL) throw new Error('Groq SDK not available and GROQ_API_URL not set for fallback');
        const r = await fetch(process.env.GROQ_API_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(process.env.GROQ_API_KEY ? { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } : {}) },
          body: JSON.stringify({ prompt: refinePrompt, model, max_tokens: 4000 })
        });
        if (!r.ok) throw new Error('Groq HTTP fallback failed');
        refineResp = await r.text();
      }

      let refineText = '';
      if (typeof refineResp === 'string') refineText = refineResp;
      else if (refineResp && typeof refineResp === 'object') {
        const choice = refineResp.choices && refineResp.choices[0];
        const message = choice?.message;
        const content = message?.content;
        if (content) {
          if (typeof content === 'string') refineText = content;
          else if (typeof content === 'object') refineText = content.text || content?.parts?.join('') || JSON.stringify(content);
        }
        refineText = refineText || refineResp.output_text || refineResp.text || JSON.stringify(refineResp);
      } else refineText = String(refineResp);

      const jsonMatch2 = refineText.match(/\{[\s\S]*\}/);
      if (jsonMatch2) {
        const refinedProposal = JSON.parse(jsonMatch2[0]);
        rfp.generatedProposal = refinedProposal;
        await rfp.save();
        // Render HTML report from refinedProposal for frontend display / PDF rendering
        const reportHtml = renderProposalHtml(refinedProposal, rfp, provider);
        const feasibility = assessFeasibility(refinedProposal, companyProfile, approvedOverview);
        return res.json({ ok: true, rfp, proposal: refinedProposal, reportHtml, feasible: feasibility.feasible, feasibilityReasons: feasibility.reasons });
      } else {
        // If refinement failed to return JSON, return original proposal but log warning
        console.warn('Refinement did not return JSON, returning initial proposal.');
        const reportHtml = renderProposalHtml(proposal, rfp, provider);
        const feasibility = assessFeasibility(proposal, companyProfile, approvedOverview);
        return res.json({ ok: true, rfp, proposal, reportHtml, feasible: feasibility.feasible, feasibilityReasons: feasibility.reasons });
      }
    } catch (refineErr) {
      console.error('Proposal refinement failed', refineErr);
      // return original proposal
      const reportHtml = renderProposalHtml(proposal, rfp, provider);
      const feasibility = assessFeasibility(proposal, companyProfile, approvedOverview);
      return res.json({ ok: true, rfp, proposal, refineError: String(refineErr), reportHtml, feasible: feasibility.feasible, feasibilityReasons: feasibility.reasons });
    }
  } catch (err: any) {
    console.error('generateProposalFromOverview failed', err);
    return res.status(500).json({ error: 'generateProposalFromOverview failed', details: err.message || String(err) });
  }
};
// Markdown renderer for proposal JSON
function renderProposalMarkdown(proposal: any, rfp: any, provider: any) {
  const exec = proposal.executive_summary || { overview: '', value_proposition: '' };
  const understanding = proposal.understanding_of_requirements || { project_overview: '', key_objectives: [], in_scope: [], out_of_scope: [] };
  const pricing = proposal.pricing_and_commercials || { currency: '', team_composition: { role: '', count: 0, monthly_cost: 0 }, total_cost: 0, pricing_notes: '' };
  const totalCost = pricing.total_cost || 0;
  const currency = pricing.currency || '';
  const team = pricing.team_composition || { role: '', count: 0, monthly_cost: 0 };

  const lines: string[] = [];
  lines.push(`# Request for Proposal (RFP) Response`);
  lines.push('');
  lines.push(`**Submitted By:** ${provider?.companyName || provider?.name || 'Provider'}`);
  lines.push(`**Submitted To:** ${rfp.clientName || 'Client'}`);
  lines.push(`**Submission Date:** ${new Date(rfp.createdAt || Date.now()).toLocaleDateString()}`);
  lines.push('---');
  lines.push('## 1. Executive Summary');
  lines.push(`**Overview:** ${exec.overview || ''}`);
  lines.push('');
  lines.push(`**Value Proposition:** ${exec.value_proposition || ''}`);
  lines.push('---');
  lines.push('## 2. Understanding of Client Requirements');
  lines.push('### 2.1 Project Overview');
  lines.push(`${understanding.project_overview || ''}`);
  lines.push('');
  lines.push('### 2.2 Key Objectives');
  (understanding.key_objectives || []).forEach((k: string) => lines.push(`- ${k}`));
  lines.push('');
  lines.push('### 2.3 In-Scope');
  (understanding.in_scope || []).forEach((k: string) => lines.push(`- ${k}`));
  lines.push('');
  lines.push('### 2.4 Out-of-Scope');
  (understanding.out_of_scope || []).forEach((k: string) => lines.push(`- ${k}`));
  lines.push('---');
  lines.push('## 3. Proposed Solution & Architecture');
  lines.push(proposal.solution_architecture?.architecture_overview || '');
  lines.push('');
  lines.push('### Components');
  (proposal.solution_architecture?.components || []).forEach((c: string) => lines.push(`- ${c}`));
  lines.push('---');
  lines.push('## 4. Delivery Plan & Timeline');
  (proposal.delivery_plan?.phases || []).forEach((p: any) => {
    lines.push(`### ${p.phase_name} | Duration: ${p.duration_weeks || 0} weeks`);
    lines.push('Deliverables:');
    (p.deliverables || []).forEach((d: string) => lines.push(`- ${d}`));
    lines.push('');
  });
  lines.push(`**Total Estimated Duration:** ${proposal.delivery_plan?.total_duration_months || 0} Months`);
  lines.push('---');
  lines.push('## 5. Pricing & Commercials');
  lines.push(`**Currency:** ${currency}`);
  lines.push('### Team Composition');
  lines.push(`- ${team.role || ''} x ${team.count} @ ${currency} ${team.monthly_cost || 0}/month`);
  lines.push(`**Total Project Cost:** ${currency} ${totalCost}`);
  if (pricing.pricing_notes) {
    lines.push('');
    lines.push(`**Pricing Notes:** ${pricing.pricing_notes}`);
  }
  lines.push('---');
  lines.push('## 6. Requirement Traceability Matrix (RTM)');
  (proposal.requirement_traceability_matrix || []).forEach((r: any) => {
    lines.push(`- ${r.requirement_id}: ${r.requirement} → ${r.solution_reference} [${r.status}]`);
  });
  lines.push('---');
  lines.push('## 7. Assumptions & Exclusions');
  lines.push('### Assumptions');
  (proposal.assumptions_and_exclusions?.assumptions || []).forEach((a: string) => lines.push(`- ${a}`));
  lines.push('### Exclusions');
  (proposal.assumptions_and_exclusions?.exclusions || []).forEach((a: string) => lines.push(`- ${a}`));
  lines.push('---');
  lines.push('## 8. Risk & Mitigation');
  (proposal.risk_and_mitigation || []).forEach((r: any) => lines.push(`- **${r.risk}** (Impact: ${r.impact}) — ${r.mitigation}`));
  lines.push('---');
  lines.push('## 9. Company Credentials');
  (proposal.company_credentials?.relevant_experience || []).forEach((c: string) => lines.push(`- ${c}`));
  lines.push('');
  lines.push('---');
  lines.push('**End of Proposal**');
  return lines.join('\n');
}

// Assess feasibility based on provider profile, proposal pricing/duration, and approved overview constraints.
function assessFeasibility(proposal: any, companyProfile: any, approvedOverview: any) {
  const reasons: string[] = [];

  try {
    // Price check
    const totalCost = Number(proposal?.pricing_and_commercials?.total_cost ?? proposal?.pricing_and_commercials?.totalCost ?? 0);
    const budget = Number(approvedOverview?.budget ?? approvedOverview?.budgetAmount ?? 0);
    if (budget && totalCost && !isNaN(budget) && !isNaN(totalCost) && totalCost > budget) {
      reasons.push(`Estimated total cost (${totalCost}) exceeds client budget (${budget}).`);
    }

    // Timeline / deadline check
    const durationMonths = Number(proposal?.delivery_plan?.total_duration_months ?? proposal?.delivery_plan?.totalDurationMonths ?? 0);
    if (approvedOverview?.deadline && durationMonths && !isNaN(durationMonths)) {
      const deadline = new Date(approvedOverview.deadline);
      if (!isNaN(deadline.getTime())) {
        const now = new Date();
        const monthsRemaining = Math.max(0, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()));
        if (durationMonths > monthsRemaining) {
          reasons.push(`Proposed delivery duration (${durationMonths} months) exceeds time available until client deadline (${monthsRemaining} months).`);
        }
      }
    }

    // Requirement coverage check
    const notCovered = (proposal?.requirement_mapping || proposal?.requirementMapping || []).filter((m: any) => {
      const status = (m?.status || '').toString().toLowerCase();
      return status.includes('not covered') || status.includes('not supported') || status === 'not_covered' || status === 'not_supported';
    });
    if (Array.isArray(notCovered) && notCovered.length > 0) {
      const ids = notCovered.map((n: any) => n.requirement_id || n.requirementId || n.id || n.requirement).slice(0, 5);
      reasons.push(`Some requirements are not covered by provider: ${ids.join(', ')}.`);
    }

    // Capability check via companyProfile.services (best-effort)
    if (companyProfile && companyProfile.services && Array.isArray(proposal?.requirement_mapping)) {
      const svcKeys = Object.keys(companyProfile.services || {});
      const unsupported = proposal.requirement_mapping.filter((m: any) => {
        const svc = (m?.mapped_service || '').toString().toLowerCase();
        if (!svc) return false;
        // if mapped_service doesn't match any provided service keys, warn
        return !svcKeys.some(k => k.toLowerCase().includes(svc) || svc.includes(k.toLowerCase()));
      });
      if (unsupported.length > 0) {
        reasons.push(`Mapped services include items not present in provider's declared services.`);
      }
    }
  } catch (e) {
    // if anything fails, do not mark feasible true by default
    reasons.push('Feasibility check failed to complete: ' + (e instanceof Error ? e.message : String(e)));
  }

  return { feasible: reasons.length === 0, reasons };
}

// Simple HTML renderer for proposal JSON (suitable for conversion to PDF)
function renderProposalHtml(proposal: any, rfp: any, provider: any) {
  const exec = proposal.executive_summary || { overview: '', value_proposition: '' };
  const understanding = proposal.understanding_of_requirements || { project_overview: '', key_objectives: [], in_scope: [], out_of_scope: [] };
  const pricing = proposal.pricing_and_commercials || { currency: '', team_composition: { role: '', count: 0, monthly_cost: 0 }, total_cost: 0, pricing_notes: '' };
  const totalCost = pricing.total_cost || 0;
  const currency = pricing.currency || '';
  const team = pricing.team_composition || { role: '', count: 0, monthly_cost: 0 };

  function escapeHtml(s: string) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const htmlParts: string[] = [];
  htmlParts.push('<html><head><meta charset="utf-8"/><style>body{font-family:Arial,sans-serif;margin:32px;color:#222}h1,h2,h3{color:#0b559f}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}</style></head><body>');
  htmlParts.push(`<h1>Request for Proposal (RFP) Response</h1>`);
  htmlParts.push(`<div><strong>Submitted By:</strong> ${escapeHtml(provider?.companyName || provider?.name || 'Provider')}<br/><strong>Client:</strong> ${escapeHtml(rfp.clientName || 'Client')}<br/><strong>Date:</strong> ${escapeHtml(new Date(rfp.createdAt || Date.now()).toLocaleDateString())}</div>`);
  htmlParts.push('<h2>1. Executive Summary</h2>');
  htmlParts.push(`<p><strong>Overview:</strong> ${escapeHtml(exec.overview || '')}</p>`);
  htmlParts.push(`<p><strong>Value Proposition:</strong> ${escapeHtml(exec.value_proposition || '')}</p>`);
  htmlParts.push('<h2>2. Understanding of Client Requirements</h2>');
  htmlParts.push(`<p><strong>Project Overview:</strong> ${escapeHtml(understanding.project_overview || '')}</p>`);
  htmlParts.push('<h3>Key Objectives</h3><ul>');
  (understanding.key_objectives || []).forEach((k: string) => htmlParts.push(`<li>${escapeHtml(k)}</li>`));
  htmlParts.push('</ul>');
  htmlParts.push('<h3>In Scope</h3><ul>');
  (understanding.in_scope || []).forEach((k: string) => htmlParts.push(`<li>${escapeHtml(k)}</li>`));
  htmlParts.push('</ul>');
  htmlParts.push('<h3>Out of Scope</h3><ul>');
  (understanding.out_of_scope || []).forEach((k: string) => htmlParts.push(`<li>${escapeHtml(k)}</li>`));
  htmlParts.push('</ul>');
  htmlParts.push('<h2>3. Solution Architecture</h2>');
  htmlParts.push(`<p>${escapeHtml(proposal.solution_architecture?.architecture_overview || '')}</p>`);
  htmlParts.push('<h3>Components</h3><ul>');
  (proposal.solution_architecture?.components || []).forEach((c: string) => htmlParts.push(`<li>${escapeHtml(c)}</li>`));
  htmlParts.push('</ul>');
  htmlParts.push('<h2>4. Delivery Plan & Timeline</h2>');
  (proposal.delivery_plan?.phases || []).forEach((p: any) => {
    htmlParts.push(`<h4>${escapeHtml(p.phase_name || '')} — ${p.duration_weeks || 0} weeks</h4>`);
    htmlParts.push('<ul>');
    (p.deliverables || []).forEach((d: string) => htmlParts.push(`<li>${escapeHtml(d)}</li>`));
    htmlParts.push('</ul>');
  });
  htmlParts.push(`<p><strong>Total Duration (months):</strong> ${proposal.delivery_plan?.total_duration_months || 0}</p>`);
  htmlParts.push('<h2>5. Pricing & Commercials</h2>');
  htmlParts.push(`<p><strong>Currency:</strong> ${escapeHtml(currency)}</p>`);
  htmlParts.push(`<p><strong>Team Composition:</strong> ${escapeHtml(team.role || '')} x ${team.count} @ ${escapeHtml(String(team.monthly_cost || 0))}/month</p>`);
  htmlParts.push(`<p><strong>Total Cost:</strong> ${escapeHtml(String(totalCost))}</p>`);
  if (pricing.pricing_notes) htmlParts.push(`<p>${escapeHtml(pricing.pricing_notes)}</p>`);
  htmlParts.push('<h2>6. Requirement Traceability Matrix</h2><ul>');
  (proposal.requirement_traceability_matrix || []).forEach((r: any) => htmlParts.push(`<li>${escapeHtml(r.requirement_id || '')}: ${escapeHtml(r.requirement || '')} → ${escapeHtml(r.solution_reference || '')} [${escapeHtml(r.status || '')}]</li>`));
  htmlParts.push('</ul>');
  htmlParts.push('<h2>7. Assumptions & Exclusions</h2>');
  htmlParts.push('<h3>Assumptions</h3><ul>');
  (proposal.assumptions_and_exclusions?.assumptions || []).forEach((a: string) => htmlParts.push(`<li>${escapeHtml(a)}</li>`));
  htmlParts.push('</ul><h3>Exclusions</h3><ul>');
  (proposal.assumptions_and_exclusions?.exclusions || []).forEach((a: string) => htmlParts.push(`<li>${escapeHtml(a)}</li>`));
  htmlParts.push('</ul>');
  htmlParts.push('<h2>8. Risk & Mitigation</h2><ul>');
  (proposal.risk_and_mitigation || []).forEach((r: any) => htmlParts.push(`<li><strong>${escapeHtml(r.risk)}</strong> (${escapeHtml(r.impact)}): ${escapeHtml(r.mitigation)}</li>`));
  htmlParts.push('</ul>');
  htmlParts.push('<h2>9. Company Credentials</h2><ul>');
  (proposal.company_credentials?.relevant_experience || []).forEach((c: string) => htmlParts.push(`<li>${escapeHtml(c)}</li>`));
  htmlParts.push('</ul>');
  htmlParts.push('<p><em>End of Proposal</em></p>');
  htmlParts.push('</body></html>');
  return htmlParts.join('');
}
