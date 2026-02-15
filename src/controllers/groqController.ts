import type { Request, Response } from 'express';
import Groq from 'groq-sdk';

const createGroqClient = () => {
  if (!process.env.GROQ_API_KEY) return null;
  try {
    return new Groq({ apiKey: process.env.GROQ_API_KEY });
  } catch (err) {
    console.error('Failed to construct Groq client', err);
    return null;
  }
};

export const testGroq = async (_req: Request, res: Response) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(400).json({ ok: false, error: 'GROQ_API_KEY not set in env' });
  }
  const groq = createGroqClient();
  if (!groq) return res.status(500).json({ ok: false, error: 'Failed to initialize Groq client' });

  try {
    const prompt = 'Please respond with a single JSON object: { "status": "ok" }';
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    let resp: any;
    // Try chat completions if available
    if ((groq as any).chat && (groq as any).chat.completions && (groq as any).chat.completions.create) {
      resp = await (groq as any).chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      });
    } else if ((groq as any).generate) {
      resp = await (groq as any).generate({ model, input: prompt });
    } else if ((groq as any).request) {
      resp = await (groq as any).request({ model, prompt });
    } else {
      // last resort try call()
      resp = await (groq as any).call?.({ model, prompt });
    }

    let out = '';
    if (typeof resp === 'string') out = resp;
    else if (resp && typeof resp === 'object') {
      const choice = resp.choices && resp.choices[0];
      const message = choice?.message;
      const content = message?.content;
      if (content) {
        if (typeof content === 'string') out = content;
        else if (typeof content === 'object') out = content.text || content?.parts?.join('') || JSON.stringify(content);
      }
      out = out || (resp.output_text || resp.text || resp.result || JSON.stringify(resp));
    } else out = String(resp);
    return res.json({ ok: true, raw: out });
  } catch (err: any) {
    console.error('Groq test failed', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};

