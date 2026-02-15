import type { Request, Response } from 'express';
import Groq from 'groq-sdk';

let groqClient: any = null;
try {
  if (process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  } else {
    console.warn('GROQ_API_KEY not set — groqController will be disabled until key is provided.');
  }
} catch (err) {
  console.error('Failed to initialize Groq SDK in groqController:', err);
  groqClient = null;
}

export const testGroq = async (_req: Request, res: Response) => {
  if (!process.env.GROQ_API_KEY || !groqClient) {
    return res.status(400).json({ ok: false, error: 'GROQ_API_KEY not set in env' });
  }
  try {
    const prompt = 'Please respond with a single JSON object: { \"status\": \"ok\" }';
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    let resp: any;
    // Try chat completions if available
    if ((groqClient as any).chat && (groqClient as any).chat.completions && (groqClient as any).chat.completions.create) {
      resp = await (groqClient as any).chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      });
    } else if ((groqClient as any).generate) {
      resp = await (groqClient as any).generate({ model, input: prompt });
    } else if ((groqClient as any).request) {
      resp = await (groqClient as any).request({ model, prompt });
    } else {
      // last resort try call()
      resp = await (groqClient as any).call?.({ model, prompt });
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

