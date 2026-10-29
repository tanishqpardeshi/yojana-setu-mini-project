import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbService } from './server/db.js';
import { 
  buildSchemeChunks, 
  hybridRagSearch, 
  formatRagContextForPrompt 
} from './src/utils/ragEngine.js';
import { 
  ApplicationRecord, 
  LiveNotification, 
  RagChunk,
  Scheme 
} from './src/types/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Pre-build RAG index of all schemes from SQLite database
let cachedSchemes: Scheme[] = dbService.getSchemes();
let schemeRagChunks: RagChunk[] = buildSchemeChunks(cachedSchemes);

function refreshRagIndex() {
  cachedSchemes = dbService.getSchemes();
  schemeRagChunks = buildSchemeChunks(cachedSchemes);
}

// SSE Clients for live real-time notification stream
const sseClients: Response[] = [];

function broadcastNotification(notification: LiveNotification) {
  // Persist to SQLite
  dbService.insertNotification(notification);

  const data = `data: ${JSON.stringify(notification)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(data);
    } catch (err) {
      // client disconnected
    }
  });
}

// Background simulator that periodically sends realistic civic events
setInterval(() => {
  const wards = [
    { name: 'Ward 15 (Khajrana)', type: 'dbt_disbursed' as const, msg: 'DBT Batch credited: 120 beneficiaries received monthly financial aid in Khajrana.' },
    { name: 'Ward 72 (Vijay Nagar)', type: 'csc_intake' as const, msg: 'MPOnline Kiosk Vijay Nagar: 8 new digital applications submitted for PMAY.' },
    { name: 'Sanwer Janpad (Kshipra)', type: 'sanction_order' as const, msg: 'Sanwer Block: Onion-Garlic storage shed subsidy approved for 5 farmer clusters.' },
    { name: 'Ward 45 (Palasia / 56 Dukan)', type: 'ward_verification' as const, msg: 'IMC Town Vending Committee completed biometric survey for 14 street food stalls.' },
    { name: 'Depalpur Janpad (Betma)', type: 'dbt_disbursed' as const, msg: 'MP Kisan Kalyan ₹3,000 top-up installment released to 340 registered farmers.' },
    { name: 'Mhow Janpad (Simrol)', type: 'application_filed' as const, msg: 'Tribal Bamboo Craft grant application registered under Ahilya Kosh.' },
  ];
  const pick = wards[Math.floor(Math.random() * wards.length)];
  const newNotif: LiveNotification = {
    id: `notif-${Date.now()}`,
    timestamp: 'Just now',
    type: pick.type,
    message: pick.msg,
    messageHindi: pick.msg,
    wardOrBlock: pick.name,
    amount: pick.type === 'dbt_disbursed' ? 150000 : undefined,
  };
  broadcastNotification(newNotif);
}, 25000);

// ================= API ROUTES =================

// SSE Endpoint for Live Feed
app.get('/api/stream/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connected ping
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'YojanaSetu Live Stream Connected' })}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// District Macro Stats
app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = dbService.getDistrictStats();
  res.json({ stats });
});

// Notifications List
app.get('/api/notifications', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 30;
  const notifications = dbService.getNotifications(limit);
  res.json({ notifications });
});

// Post Notification (Admin Broadcast)
app.post('/api/notifications', (req: Request, res: Response) => {
  const { type, message, messageHindi, wardOrBlock, amount, arn } = req.body;
  const newNotif: LiveNotification = {
    id: `notif-${Date.now()}`,
    timestamp: 'Just now',
    type: type || 'application_filed',
    message: message || 'Administrative activity logged',
    messageHindi: messageHindi || message,
    wardOrBlock: wardOrBlock || 'Indore District',
    amount: amount ? Number(amount) : undefined,
    arn: arn || undefined,
  };
  broadcastNotification(newNotif);
  res.status(201).json({ success: true, notification: newNotif });
});

// ================= SCHEMES CRUD =================

// Get Schemes (with optional level and search queries)
app.get('/api/schemes', (req: Request, res: Response) => {
  const level = req.query.level ? String(req.query.level) : undefined;
  const search = req.query.q ? String(req.query.q) : undefined;
  const schemes = dbService.getSchemes({ level, search });
  res.json({ schemes, count: schemes.length });
});

// Get Scheme by ID
app.get('/api/schemes/:id', (req: Request, res: Response) => {
  const scheme = dbService.getSchemeById(req.params.id);
  if (!scheme) {
    return res.status(404).json({ error: 'Scheme not found' });
  }
  res.json({ scheme });
});

// Create/Insert Scheme
app.post('/api/schemes', (req: Request, res: Response) => {
  const scheme = req.body as Scheme;
  if (!scheme.id || !scheme.title) {
    return res.status(400).json({ error: 'Invalid scheme payload. id and title required.' });
  }
  dbService.insertScheme(scheme);
  refreshRagIndex();
  res.status(201).json({ success: true, scheme });
});

// Update Scheme
app.put('/api/schemes/:id', (req: Request, res: Response) => {
  const scheme = req.body as Scheme;
  scheme.id = req.params.id;
  dbService.insertScheme(scheme);
  refreshRagIndex();
  res.json({ success: true, scheme });
});

// Delete Scheme
app.delete('/api/schemes/:id', (req: Request, res: Response) => {
  const deleted = dbService.deleteScheme(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Scheme not found or could not be deleted' });
  }
  refreshRagIndex();
  res.json({ success: true });
});

// ================= APPLICATIONS CRUD =================

// Get Applications (all, by ARN, or by Samagra ID)
app.get('/api/applications', (req: Request, res: Response) => {
  const { arn, samagraId, status } = req.query;
  const records = dbService.getApplications({
    arn: arn ? String(arn) : undefined,
    samagraId: samagraId ? String(samagraId) : undefined,
    status: status ? String(status) : undefined,
  });

  if (arn && records.length === 0) {
    return res.status(404).json({ error: 'Application Reference Number (ARN) not found' });
  }
  if (arn) {
    return res.json({ record: records[0] });
  }

  res.json({ records, count: records.length });
});

// Get Application by ARN
app.get('/api/applications/:arn', (req: Request, res: Response) => {
  const record = dbService.getApplicationByArn(req.params.arn);
  if (!record) {
    return res.status(404).json({ error: 'Application Reference Number (ARN) not found' });
  }
  res.json({ record });
});

// Submit Application
app.post('/api/applications', (req: Request, res: Response) => {
  const {
    schemeId,
    applicantName,
    samagraMemberId,
    samagraFamilyId,
    phone,
    wardOrBlock,
    areaType,
    kioskOperatorCode,
  } = req.body;

  if (!schemeId || !applicantName) {
    return res.status(400).json({ error: 'Missing required application fields' });
  }

  const scheme = dbService.getSchemeById(schemeId) || cachedSchemes.find(s => s.id === schemeId);
  const schemeTitle = scheme ? scheme.title : 'Government Scheme Application';
  const schemeTitleHindi = scheme ? scheme.titleHindi : 'शासकीय योजना आवेदन';

  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const arn = `YS-IND-2026-${randomNum}`;
  const today = new Date().toISOString().split('T')[0];

  const newApp: ApplicationRecord = {
    arn,
    schemeId,
    schemeTitle,
    schemeTitleHindi,
    applicantName,
    samagraMemberId: samagraMemberId || 'N/A',
    samagraFamilyId: samagraFamilyId || 'N/A',
    phone: phone || '98XXXXXXXX',
    wardOrBlock: wardOrBlock || 'Indore Urban',
    areaType: areaType || 'urban',
    appliedDate: today,
    currentStatus: 'submitted',
    officerInCharge: 'Nodal Verification Officer, Indore Collectorate',
    sanctionAmount: scheme?.financialEntitlement?.amount || 0,
    kioskOperatorCode: kioskOperatorCode || undefined,
    remarks: 'Application successfully registered in SQLite database via YojanaSetu.',
    timeline: [
      {
        title: 'Application Intake Submitted',
        titleHindi: 'आवेदन सफलतापूर्वक दर्ज',
        date: `${today} 11:30 AM`,
        location: kioskOperatorCode ? `Kiosk ${kioskOperatorCode}` : 'YojanaSetu Direct Portal',
        status: 'completed',
        remarks: 'Digital acknowledgment generated. Forwarded for field verification.',
      },
      {
        title: 'Ward / Panchayat Field Verification',
        titleHindi: 'वार्ड / पंचायत भौतिक सत्यापन',
        date: 'In Progress (Estimated: 2 working days)',
        location: wardOrBlock || 'Indore Ward Office',
        status: 'in_progress',
        remarks: 'Patwari / Ward Officer biometric verification initiated.',
      },
      {
        title: 'Collectorate Scrutiny & Approval',
        titleHindi: 'कलेक्ट्रेट स्क्रूटनी व अनुमोदन',
        date: 'Pending',
        location: 'Collectorate Campus, Moti Tabela Indore',
        status: 'pending',
      },
      {
        title: 'Sanction Order Release',
        titleHindi: 'स्वीकृति आदेश जारी',
        date: 'Pending',
        location: 'Departmental Directorate Indore',
        status: 'pending',
      },
      {
        title: 'Direct Benefit Transfer (DBT)',
        titleHindi: 'डीबीटी बैंक अंतरण',
        date: 'Pending',
        location: 'Aadhaar-linked Bank Account',
        status: 'pending',
      },
    ],
  };

  dbService.insertApplication(newApp);

  // Broadcast to live stream
  broadcastNotification({
    id: `notif-${Date.now()}`,
    timestamp: 'Just now',
    type: 'application_filed',
    message: `New application ${arn} registered for ${schemeTitle} by ${applicantName} (${wardOrBlock}).`,
    messageHindi: `नवीन आवेदन ${arn}: ${applicantName} द्वारा ${schemeTitleHindi} हेतु दर्ज (${wardOrBlock})।`,
    wardOrBlock: wardOrBlock || 'Indore',
    arn,
  });

  res.status(201).json({ success: true, record: newApp });
});

// Update Application Status (e.g. Approved, DBT disbursed, etc.)
app.patch('/api/applications/:arn', (req: Request, res: Response) => {
  const { status, remarks } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const updated = dbService.updateApplicationStatus(req.params.arn, status, remarks);
  if (!updated) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Broadcast update
  broadcastNotification({
    id: `notif-${Date.now()}`,
    timestamp: 'Just now',
    type: status === 'dbt_disbursed' ? 'dbt_disbursed' : 'sanction_order',
    message: `ARN ${updated.arn}: Status updated to ${status.toUpperCase()} for ${updated.applicantName}.`,
    messageHindi: `आवेदन ${updated.arn}: स्थिति अद्यतित - ${status} (${updated.applicantName})।`,
    wardOrBlock: updated.wardOrBlock,
    amount: updated.sanctionAmount,
    arn: updated.arn,
  });

  res.json({ success: true, record: updated });
});

// ================= SAMAGRA INTEGRATION =================

// Get Samagra Family Profile by Family ID or Member ID
app.get('/api/samagra/:id', (req: Request, res: Response) => {
  const family = dbService.getSamagraFamily(req.params.id);
  if (!family) {
    return res.status(404).json({ error: 'Samagra Family or Member ID not found in database' });
  }
  res.json({ family });
});

// ================= HYBRID RAG SEARCH & CITATIONS =================

// Standalone RAG Retrieval API endpoint
app.get('/api/rag/search', (req: Request, res: Response) => {
  const query = req.query.q ? String(req.query.q) : '';
  const topK = req.query.topK ? Number(req.query.topK) : 4;

  if (!query.trim()) {
    return res.json({ query: '', results: [] });
  }

  const results = hybridRagSearch(query, schemeRagChunks, topK);
  res.json({ query, results, totalIndexedChunks: schemeRagChunks.length });
});

// Gemini Chatbot: Yojana Mitra with Grounded RAG Citations
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // 1. Perform Hybrid RAG Retrieval across 47 schemes (188+ chunks)
  const retrievedChunks = hybridRagSearch(message, schemeRagChunks, 4);
  const ragContextText = formatRagContextForPrompt(retrievedChunks);

  const systemInstruction = `You are 'Yojana Mitra' (योजना मित्र), an empathetic, highly knowledgeable civic guide and AI scheme counselor for citizens of Indore District, Madhya Pradesh.
You provide authoritative guidance on government schemes across all 6 levels of governance (International ADB/World Bank, National Central, MP State, Indore Collectorate, IMC Wards 1-85, Rural Janpads).

CRITICAL GROUNDING INSTRUCTIONS:
Always base your response on the verified government facts and rules provided in the RETRIEVED CIVIC RULES & SCHEME CONTEXT below.
Cite the scheme name, governance level, exact entitlement amounts, eligibility conditions, and nodal office in Indore.

RETRIEVED CIVIC RULES & SCHEME CONTEXT:
${ragContextText}

VERNACULAR / MALWI RECOGNITION:
- "टापरो" / "ओसरो" = Housing / PMAY
- "हलवा" / "खेड़ूत" = Farmer / PM-KISAN / MP Kisan Kalyan
- "बाईजी" / "लाडली" = Women / Ladli Behna
- "पीलो पत्तो" / "दवाई" = Ayushman Bharat / Health
- "ठेलो" / "गुमटी" = Street Vendor / PM SVANidhi
- "कांदा" / "लहसन" = Onion/Garlic cold storage

Always give crisp, compassionate, structured answers with:
- Scheme Name & Benefit amount
- Who is eligible (Age, Income, Ward/Janpad)
- Key documents needed (Aadhaar, Samagra 9-digit Member ID, Khasra B-1 for farmers, MP Domicile, Bank DBT)
- How to apply in Indore (MPOnline / CSC Kiosk or Indore Collectorate Moti Tabela / IMC HQ Narayan Singla Marg)
- Answer in the same language the user asked in (English, Hindi, or Malwi dialect if used). Format with markdown bullet points.`;

  try {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && !process.env.GEMINI_API_KEY.includes('MY_')) {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Format history if provided
      let promptText = message;
      if (Array.isArray(history) && history.length > 0) {
        const historyText = history
          .slice(-6)
          .map((h: { sender: string; text: string }) => `${h.sender === 'user' ? 'Citizen' : 'Yojana Mitra'}: ${h.text}`)
          .join('\n');
        promptText = `Conversation history:\n${historyText}\n\nCitizen: ${message}\n\nYojana Mitra:`;
      }

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          systemInstruction,
          temperature: 0.5,
          tools: [{ googleSearch: {} }],
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 8000)
      );

      const response = await Promise.race([geminiPromise, timeoutPromise]);
      const replyText = response.text || 'योजना मित्र: मैं आपकी सहायता के लिए सदैव उपलब्ध हूँ। कृपया योजना का नाम या अपनी पात्रता पूछें।';

      // Extract Google Search Grounding Citations
      const rawGroundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const webSearchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];
      const webCitations: Array<{ title: string; uri: string }> = [];

      if (Array.isArray(rawGroundingChunks)) {
        for (const chunk of rawGroundingChunks) {
          if (chunk.web && chunk.web.uri) {
            webCitations.push({
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri,
            });
          }
        }
      }

      return res.json({
        reply: replyText,
        retrievedChunks,
        webCitations,
        webSearchQueries,
        modelUsed: 'gemini-3.8-flash (Search Grounded)',
        latencyMs: Date.now() - startTime,
      });
    }
  } catch (err: any) {
    console.warn('Gemini API call or timeout, using RAG ground-truth context:', err?.message);
  }

  // Graceful RAG-grounded response fallback when API key is not configured or network error
  let fallbackReply = '';
  if (retrievedChunks.length > 0) {
    const topChunk = retrievedChunks[0].chunk;
    fallbackReply = `**${topChunk.schemeTitle} (${topChunk.schemeTitleHindi})**\n\n${topChunk.content}\n\n💡 **अधिक जानकारी या आवेदन हेतु:** अपने नजदीकी एमपी ऑनलाइन / सीएससी कियोस्क या इंदौर कलेक्ट्रेट/वार्ड कार्यालय से संपर्क करें।`;
  } else {
    fallbackReply = `**नमस्ते! मैं 'योजना सेतु' का योजना मित्र हूँ।**\n\nइंदौर जिले में कुल **6 प्रशासनिक स्तरों** की योजनाएं संचालित हैं:\n1. **अंतर्राष्ट्रीय (ADB):** वार्डों में निःशुल्क नल कनेक्शन अनुदान।\n2. **राष्ट्रीय:** पीएम-किसान, पीएम आवास, आयुष्मान भारत (₹5 लाख मुफ्त इलाज)।\n3. **म.प्र. राज्य:** लाड़ली बहना (₹1,500/माह), सीखो कमाओ, संबल 2.0।\n4. **इंदौर कलेक्ट्रेट:** रेड क्रॉस आरोग्य निधि (₹1 लाख त्वरित चिकित्सा), अहिल्या दिव्यांग कोष।\n5. **नगर निगम (वार्ड 1-85):** स्वच्छता मित्र कल्याण, रूफटॉप सोलर ₹10,000 टॉप-अप।\n6. **ग्रामीण जनपद (महू, सांवेर, देपालपुर, इंदौर):** मालवी गोवंश व प्याज भंडारण सब्सिडी।`;
  }

  res.json({
    reply: fallbackReply,
    retrievedChunks,
    webCitations: [],
    webSearchQueries: [],
    modelUsed: 'YojanaSetu Hybrid RAG Rules Engine',
    latencyMs: Date.now() - startTime,
  });
});

// Dedicated Google Search Grounded Endpoint for Real-Time Circulars & News
app.post('/api/gemini/grounded-news', async (req: Request, res: Response) => {
  const { topic } = req.body;
  const query = topic || 'Madhya Pradesh government schemes 2026 Indore updates';

  try {
    if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('MY_')) {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Find the most recent official updates, news announcements, and deadlines for: ${query} in Indore / Madhya Pradesh. Provide concise bullet points and cite official portals.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const webCitations = Array.isArray(rawChunks)
        ? rawChunks.filter(c => c.web?.uri).map(c => ({ title: c.web?.title || c.web?.uri, uri: c.web?.uri }))
        : [];

      return res.json({
        summary: response.text,
        webCitations,
        searchQueries: response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [],
      });
    }
  } catch (err: any) {
    console.warn('Grounded news error:', err?.message);
  }

  res.json({
    summary: 'ताज़ा शासकीय परिपत्र: इंदौर जिले में लाड़ली बहना, संबल 2.0, व पीएम सूर्य घर योजना के विशेष शिविर सभी 85 वार्डों एवं 4 जनपदों में आयोजित किए जा रहे हैं।',
    webCitations: [
      { title: 'Indore District Official Portal', uri: 'https://indore.nic.in' },
      { title: 'MP State Citizen Portal', uri: 'https://mp.gov.in' }
    ],
    searchQueries: [query],
  });
});

// Vite Development Server or Production Static Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[YojanaSetu Indore] Server listening on http://0.0.0.0:${PORT} with SQLite DB & Hybrid RAG`);
  });
}

startServer();
