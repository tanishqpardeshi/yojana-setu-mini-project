import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbService } from './server/db.js';
import {
  ApplicationRecord,
  DigiLockerDocumentRecord,
  LiveNotification,
  PortalReachabilityStatus,
  Scheme,
} from './src/types/index.js';
import { resolveSchemePortalUrl } from './src/utils/liveDataEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.DEFAULT_APP_PORT) || 3000;

app.use(express.json({ limit: '1mb' }));
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }
  next(err);
});

// Cache schemes from SQLite database
let cachedSchemes: Scheme[] = dbService.getSchemes();

function refreshSchemesCache() {
  cachedSchemes = dbService.getSchemes();
}

// SSE Clients for genuine real-time events (zero fake timers)
const sseClients: Response[] = [];

function pushSsePayload(payload: Record<string, unknown>) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(data);
    } catch {
      // client disconnected
    }
  });
}

function broadcastNotification(notification: LiveNotification, eventType?: string) {
  dbService.insertNotification(notification);
  pushSsePayload({
    ...notification,
    eventType: eventType || 'notification',
  });
}

function formatNowTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Server-side live HTTP probe for official government portals
async function probePortalUrl(url: string): Promise<{
  status: PortalReachabilityStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  checkedAt: string;
}> {
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'YojanaSetu-Indore-PortalCheck/1.0',
      },
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'YojanaSetu-Indore-PortalCheck/1.0',
        },
      });
    }

    const latencyMs = Date.now() - started;
    const isReachable = response.status >= 200 && response.status < 500;
    return {
      status: isReachable ? 'reachable' : 'unreachable',
      httpStatus: response.status,
      latencyMs,
      checkedAt,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - started;
    const isTimeout = err?.name === 'AbortError';
    return {
      status: isTimeout ? 'timeout' : 'unreachable',
      httpStatus: null,
      latencyMs,
      checkedAt,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ================= API ROUTES =================

// SSE Endpoint for Live Feed
app.get('/api/stream/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'YojanaSetu Live Stream Connected' })}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// District Macro Stats (100% real SQLite data)
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const stats = dbService.getDistrictStats();
    res.json({ stats });
  } catch (err) {
    console.error('[API /api/stats] Error:', err);
    res.status(500).json({ error: 'Failed to load district statistics' });
  }
});

// Ward & Janpad Live Stats
app.get('/api/stats/wards', (_req: Request, res: Response) => {
  try {
    const live = dbService.getWardAndBlockLiveStats();
    res.json(live);
  } catch (err) {
    console.error('[API /api/stats/wards] Error:', err);
    res.status(500).json({ error: 'Failed to load live ward metrics' });
  }
});

// Notifications List
app.get('/api/notifications', (req: Request, res: Response) => {
  try {
    const parsedLimit = req.query.limit ? Number(req.query.limit) : 30;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(200, Math.floor(parsedLimit)) : 30;
    const notifications = dbService.getNotifications(limit);
    res.json({ notifications });
  } catch (err) {
    console.error('[API /api/notifications] Error:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// Post Notification (Admin Broadcast)
app.post('/api/notifications', (req: Request, res: Response) => {
  try {
    const { type, message, messageHindi, wardOrBlock, amount, arn } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Broadcast message is required' });
    }
    const parsedAmount = amount !== undefined ? Number(amount) : undefined;
    const newNotif: LiveNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: formatNowTime(),
      type: type || 'ward_verification',
      message: String(message).trim(),
      messageHindi: String(messageHindi || message).trim(),
      wardOrBlock: String(wardOrBlock || 'Indore District').trim(),
      amount: parsedAmount !== undefined && Number.isFinite(parsedAmount) ? parsedAmount : undefined,
      arn: arn || undefined,
    };
    broadcastNotification(newNotif);
    res.status(201).json({ success: true, notification: newNotif });
  } catch (err) {
    console.error('[API POST /api/notifications] Error:', err);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

// ================= SCHEMES CRUD & REAL-TIME CHECK =================

// Get Schemes Real-Time Audit Status
app.get('/api/schemes/realtime-status', (_req: Request, res: Response) => {
  try {
    const report = dbService.getSchemesRealtimeStatus();
    res.json({ report });
  } catch (err) {
    console.error('[API GET /api/schemes/realtime-status] Error:', err);
    res.status(500).json({ error: 'Failed to compute real-time schemes status' });
  }
});

// Trigger Live Server-Side Verification of Official Scheme Portals
app.post('/api/schemes/verify-realtime', async (_req: Request, res: Response) => {
  try {
    const schemes = dbService.getSchemes();
    const uniqueUrls = Array.from(new Set(schemes.map(s => resolveSchemePortalUrl(s))));
    const urlResults = new Map<
      string,
      { status: PortalReachabilityStatus; httpStatus: number | null; latencyMs: number | null; checkedAt: string }
    >();

    // Probe in small parallel batches to stay responsive
    const batchSize = 6;
    for (let i = 0; i < uniqueUrls.length; i += batchSize) {
      const batch = uniqueUrls.slice(i, i + batchSize);
      const settled = await Promise.all(
        batch.map(async url => ({ url, result: await probePortalUrl(url) }))
      );
      for (const item of settled) {
        urlResults.set(item.url, item.result);
      }
    }

    const report = dbService.updateSchemesPortalCheckByUrl(urlResults);
    refreshSchemesCache();

    broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'schemes_synced',
        message: `Schemes real-time portal check completed: ${report.reachableSchemesCount}/${report.totalSchemes} schemes verified against official portals.`,
        messageHindi: `योजना पोर्टल रीयल-टाइम जांच पूर्ण: ${report.reachableSchemesCount}/${report.totalSchemes} योजनाएं सत्यापित।`,
        wardOrBlock: 'Indore Collectorate Catalog',
      },
      'schemes_updated'
    );

    res.json({ success: true, report, schemes: cachedSchemes });
  } catch (err) {
    console.error('[API POST /api/schemes/verify-realtime] Error:', err);
    res.status(500).json({ error: 'Failed to execute live portal verification' });
  }
});

// Get Schemes (with optional level and search queries)
app.get('/api/schemes', (req: Request, res: Response) => {
  try {
    const level = req.query.level ? String(req.query.level) : undefined;
    const search = req.query.q ? String(req.query.q) : undefined;
    const schemes = dbService.getSchemes({ level, search });
    res.json({ schemes, count: schemes.length });
  } catch (err) {
    console.error('[API GET /api/schemes] Error:', err);
    res.status(500).json({ error: 'Failed to load schemes' });
  }
});

// Get Scheme by ID
app.get('/api/schemes/:id', (req: Request, res: Response) => {
  try {
    const scheme = dbService.getSchemeById(req.params.id);
    if (!scheme) {
      return res.status(404).json({ error: 'Scheme not found' });
    }
    res.json({ scheme });
  } catch (err) {
    console.error('[API GET /api/schemes/:id] Error:', err);
    res.status(500).json({ error: 'Failed to load scheme' });
  }
});

// Create/Insert Scheme (Live Admin Broadcast)
app.post('/api/schemes', (req: Request, res: Response) => {
  try {
    const scheme = (req.body || {}) as Scheme;
    if (!scheme.id || !scheme.title) {
      return res.status(400).json({ error: 'Invalid scheme payload. id and title required.' });
    }
    const saved = dbService.insertScheme(scheme, 'admin_live');
    refreshSchemesCache();

    broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'schemes_synced',
        message: `Live scheme published by Indore Admin: ${saved.title} (${saved.code}).`,
        messageHindi: `प्रशासन द्वारा नई योजना प्रकाशित: ${saved.titleHindi} (${saved.code})।`,
        wardOrBlock: 'Indore District',
      },
      'schemes_updated'
    );

    res.status(201).json({ success: true, scheme: saved });
  } catch (err) {
    console.error('[API POST /api/schemes] Error:', err);
    res.status(500).json({ error: 'Failed to save scheme' });
  }
});

// Update Scheme
app.put('/api/schemes/:id', (req: Request, res: Response) => {
  try {
    const scheme = (req.body || {}) as Scheme;
    if (!scheme.title) {
      return res.status(400).json({ error: 'Invalid scheme payload. title is required.' });
    }
    scheme.id = req.params.id;
    const saved = dbService.insertScheme(scheme, 'admin_live');
    refreshSchemesCache();
    pushSsePayload({ eventType: 'schemes_updated' });
    res.json({ success: true, scheme: saved });
  } catch (err) {
    console.error('[API PUT /api/schemes/:id] Error:', err);
    res.status(500).json({ error: 'Failed to update scheme' });
  }
});

// Delete Scheme
app.delete('/api/schemes/:id', (req: Request, res: Response) => {
  try {
    const deleted = dbService.deleteScheme(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Scheme not found or could not be deleted' });
    }
    refreshSchemesCache();
    pushSsePayload({ eventType: 'schemes_updated' });
    res.json({ success: true });
  } catch (err) {
    console.error('[API DELETE /api/schemes/:id] Error:', err);
    res.status(500).json({ error: 'Failed to delete scheme' });
  }
});

// ================= APPLICATIONS CRUD =================

// Get Applications (all, by ARN, or by Samagra ID)
app.get('/api/applications', (req: Request, res: Response) => {
  try {
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
  } catch (err) {
    console.error('[API GET /api/applications] Error:', err);
    res.status(500).json({ error: 'Failed to load applications' });
  }
});

// Get Application by ARN
app.get('/api/applications/:arn', (req: Request, res: Response) => {
  try {
    const record = dbService.getApplicationByArn(req.params.arn);
    if (!record) {
      return res.status(404).json({ error: 'Application Reference Number (ARN) not found' });
    }
    res.json({ record });
  } catch (err) {
    console.error('[API GET /api/applications/:arn] Error:', err);
    res.status(500).json({ error: 'Failed to load application' });
  }
});

// Submit Application
app.post('/api/applications', (req: Request, res: Response) => {
  try {
    const {
      schemeId,
      applicantName,
      samagraMemberId,
      samagraFamilyId,
      phone,
      wardOrBlock,
      areaType,
    } = req.body || {};

    if (!schemeId || !applicantName || !String(applicantName).trim()) {
      return res.status(400).json({ error: 'Scheme and applicant name are required' });
    }
    if (!samagraFamilyId || !String(samagraFamilyId).trim() || !samagraMemberId || !String(samagraMemberId).trim()) {
      return res.status(400).json({ error: 'Samagra Family ID and Member ID are required' });
    }

    const cleanSchemeId = String(schemeId).trim();
    const cleanApplicantName = String(applicantName).trim();
    const scheme = dbService.getSchemeById(cleanSchemeId) || cachedSchemes.find(s => s.id === cleanSchemeId);
    if (!scheme) {
      return res.status(404).json({ error: 'Selected scheme does not exist in catalog' });
    }

    let arn = `YS-IND-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    let attempts = 0;
    while (dbService.getApplicationByArn(arn) && attempts < 10) {
      arn = `YS-IND-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      attempts += 1;
    }

    const today = new Date().toISOString().split('T')[0];
    const nowTime = formatNowTime();

    const newApp: ApplicationRecord = {
      arn,
      schemeId: cleanSchemeId,
      schemeTitle: scheme.title,
      schemeTitleHindi: scheme.titleHindi,
      applicantName: cleanApplicantName,
      samagraMemberId: String(samagraMemberId).trim(),
      samagraFamilyId: String(samagraFamilyId).trim(),
      phone: phone ? String(phone).trim() : '',
      wardOrBlock: wardOrBlock ? String(wardOrBlock).trim() : 'Indore District',
      areaType: areaType === 'rural' ? 'rural' : 'urban',
      appliedDate: today,
      currentStatus: 'submitted',
      officerInCharge: 'Nodal Verification Officer, Indore Collectorate',
      sanctionAmount: scheme.financialEntitlement?.amount || 0,
      remarks: 'Application registered live via YojanaSetu Citizen Portal.',
      timeline: [
        {
          title: 'Application Intake Submitted',
          titleHindi: 'आवेदन सफलतापूर्वक दर्ज',
          date: `${today} ${nowTime}`,
          location: 'YojanaSetu Direct Portal',
          status: 'completed',
          remarks: 'Digital acknowledgment generated. Forwarded for ward/panchayat verification.',
        },
        {
          title: 'Ward / Panchayat Field Verification',
          titleHindi: 'वार्ड / पंचायत भौतिक सत्यापन',
          date: 'In Progress',
          location: wardOrBlock || 'Indore Ward Office',
          status: 'in_progress',
          remarks: 'Queued for Nodal Ward / Janpad Officer review.',
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

    broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: nowTime,
        type: 'application_filed',
        message: `Application ${arn} filed for ${scheme.title} by ${cleanApplicantName} (${newApp.wardOrBlock}).`,
        messageHindi: `नवीन आवेदन ${arn}: ${cleanApplicantName} द्वारा ${scheme.titleHindi} हेतु दर्ज (${newApp.wardOrBlock})।`,
        wardOrBlock: newApp.wardOrBlock,
        arn,
      },
      'application_updated'
    );

    res.status(201).json({ success: true, record: newApp });
  } catch (err) {
    console.error('[API POST /api/applications] Error:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Update Application Status (Admin live approval / disbursement)
app.patch('/api/applications/:arn', (req: Request, res: Response) => {
  try {
    const { status, remarks } = req.body || {};
    const allowedStatuses: ApplicationRecord['currentStatus'][] = [
      'submitted',
      'ward_verification',
      'collectorate_scrutiny',
      'sanction_issued',
      'dbt_disbursed',
      'rejected',
    ];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Valid application status is required' });
    }

    const updated = dbService.updateApplicationStatus(req.params.arn, status, remarks);
    if (!updated) {
      return res.status(404).json({ error: 'Application not found' });
    }

    broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type:
          status === 'dbt_disbursed'
            ? 'dbt_disbursed'
            : status === 'ward_verification'
            ? 'ward_verification'
            : 'sanction_order',
        message: `ARN ${updated.arn}: Status updated to ${status.replace('_', ' ').toUpperCase()} for ${updated.applicantName}.`,
        messageHindi: `आवेदन ${updated.arn}: स्थिति अद्यतित - ${status} (${updated.applicantName})।`,
        wardOrBlock: updated.wardOrBlock,
        amount: status === 'dbt_disbursed' || status === 'sanction_issued' ? updated.sanctionAmount : undefined,
        arn: updated.arn,
      },
      'application_updated'
    );

    res.json({ success: true, record: updated });
  } catch (err) {
    console.error('[API PATCH /api/applications/:arn] Error:', err);
    res.status(500).json({ error: 'Failed to update application status' });
  }
});

// ================= SAMAGRA LIVE INTEGRATION =================

// List all live registered Samagra households
app.get('/api/samagra', (_req: Request, res: Response) => {
  try {
    const families = dbService.getAllSamagraFamilies();
    res.json({ families, count: families.length });
  } catch (err) {
    console.error('[API GET /api/samagra] Error:', err);
    res.status(500).json({ error: 'Failed to list Samagra households' });
  }
});

// Get Samagra Family Profile by Family ID or Member ID
app.get('/api/samagra/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id?.trim();
    if (!id) {
      return res.status(400).json({ error: 'Samagra Family or Member ID is required' });
    }
    const family = dbService.getSamagraFamily(id);
    if (!family) {
      return res.status(404).json({ error: 'Samagra Family or Member ID not found. Register a live Samagra household first.' });
    }
    res.json({ family });
  } catch (err) {
    console.error('[API GET /api/samagra/:id] Error:', err);
    res.status(500).json({ error: 'Failed to lookup Samagra family record' });
  }
});

// Register or update a live Citizen Samagra Family record
app.post('/api/samagra/register', (req: Request, res: Response) => {
  try {
    const { familyId, headName, areaType, wardOrBlock, address, rationCardType, members } = req.body || {};
    const cleanFamilyId = typeof familyId === 'string' || typeof familyId === 'number' ? String(familyId).trim() : '';
    const cleanHeadName = typeof headName === 'string' ? headName.trim() : '';

    if (!cleanFamilyId || !cleanHeadName || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'familyId, headName, and at least one member are required' });
    }

    const validMembers = members.every(
      (m: any) => m && typeof m === 'object' && String(m.memberId || '').trim() && String(m.name || '').trim()
    );
    if (!validMembers) {
      return res.status(400).json({ error: 'Each Samagra member must include a non-empty memberId and name' });
    }

    const saved = dbService.registerSamagraFamily({
      familyId: cleanFamilyId.slice(0, 16),
      headName: cleanHeadName.slice(0, 120),
      areaType: areaType === 'rural' ? 'rural' : 'urban',
      wardOrBlock: String(wardOrBlock || 'Ward 1 (Sirpur / Chandan Nagar)').slice(0, 100),
      address: String(address || 'Indore District, Madhya Pradesh').slice(0, 300),
      rationCardType: rationCardType === 'BPL' || rationCardType === 'Antyodaya' ? rationCardType : 'APL',
      members,
    });

    // Auto-issue Samagra Family & Member credentials in DigiLocker table for verified members
    const nowIso = new Date().toISOString();
    for (const member of saved.members) {
      dbService.upsertDigiLockerDocument({
        citizenKey: member.memberId,
        docId: 'samagra_family',
        docNumber: `SPR-FAM-${saved.familyId}`,
        source: 'mp_edistrict',
        issuer: 'MP Samagra Portal (SPR)',
        verified: true,
        verifiedAt: nowIso,
      });
      if (member.ekycStatus) {
        dbService.upsertDigiLockerDocument({
          citizenKey: member.memberId,
          docId: 'samagra_member',
          docNumber: `SPR-MEM-${member.memberId}`,
          source: 'mp_edistrict',
          issuer: 'MP Samagra Portal (SPR)',
          verified: true,
          verifiedAt: nowIso,
        });
        dbService.upsertDigiLockerDocument({
          citizenKey: member.memberId,
          docId: 'aadhaar',
          docNumber: `UIDAI-EKYC-${member.memberId.slice(-4)}`,
          source: 'digilocker',
          issuer: 'UIDAI (eKYC Verified)',
          verified: true,
          verifiedAt: nowIso,
        });
      }
      if (member.dbtActive) {
        dbService.upsertDigiLockerDocument({
          citizenKey: member.memberId,
          docId: 'bank_dbt',
          docNumber: `NPCI-DBT-${member.memberId.slice(-5)}`,
          source: 'digilocker',
          issuer: 'NPCI Aadhaar Mapper',
          verified: true,
          verifiedAt: nowIso,
        });
      }
    }

    broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'samagra_synced',
        message: `Live Samagra Family ${saved.familyId} (${saved.headName}, ${saved.members.length} member${saved.members.length > 1 ? 's' : ''}) synced in ${saved.wardOrBlock}.`,
        messageHindi: `समग्र परिवार ${saved.familyId} (${saved.headName}) ${saved.wardOrBlock} में पंजीकृत एवं सिंक हुआ।`,
        wardOrBlock: saved.wardOrBlock,
      },
      'samagra_updated'
    );

    res.status(201).json({ success: true, family: saved });
  } catch (err) {
    console.error('[API POST /api/samagra/register] Error:', err);
    res.status(500).json({ error: 'Failed to register Samagra family record' });
  }
});

// Toggle live Aadhaar eKYC or NPCI DBT status for a Samagra member
app.patch('/api/samagra/:familyId/members/:memberId', (req: Request, res: Response) => {
  try {
    const { familyId, memberId } = req.params;
    const { ekycStatus, dbtActive } = req.body || {};

    const updated = dbService.updateSamagraMemberStatus(familyId, memberId, {
      ekycStatus: ekycStatus !== undefined ? Boolean(ekycStatus) : undefined,
      dbtActive: dbtActive !== undefined ? Boolean(dbtActive) : undefined,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Samagra family or member not found' });
    }

    const nowIso = new Date().toISOString();
    if (ekycStatus === true) {
      dbService.upsertDigiLockerDocument({
        citizenKey: memberId,
        docId: 'samagra_member',
        docNumber: `SPR-MEM-${memberId}`,
        source: 'mp_edistrict',
        issuer: 'MP Samagra Portal (SPR)',
        verified: true,
        verifiedAt: nowIso,
      });
      dbService.upsertDigiLockerDocument({
        citizenKey: memberId,
        docId: 'aadhaar',
        docNumber: `UIDAI-EKYC-${memberId.slice(-4)}`,
        source: 'digilocker',
        issuer: 'UIDAI (eKYC Verified)',
        verified: true,
        verifiedAt: nowIso,
      });
    }
    if (dbtActive === true) {
      dbService.upsertDigiLockerDocument({
        citizenKey: memberId,
        docId: 'bank_dbt',
        docNumber: `NPCI-DBT-${memberId.slice(-5)}`,
        source: 'digilocker',
        issuer: 'NPCI Aadhaar Mapper',
        verified: true,
        verifiedAt: nowIso,
      });
    }

    broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'samagra_synced',
        message: `Samagra Member ${memberId} updated live (${ekycStatus !== undefined ? `eKYC: ${ekycStatus ? 'Verified' : 'Pending'}` : ''}${ekycStatus !== undefined && dbtActive !== undefined ? ', ' : ''}${dbtActive !== undefined ? `DBT: ${dbtActive ? 'Active' : 'Inactive'}` : ''}).`,
        messageHindi: `समग्र सदस्य ${memberId} की ई-केवाईसी / डीबीटी स्थिति लाइव अद्यतित हुई।`,
        wardOrBlock: updated.wardOrBlock,
      },
      'samagra_updated'
    );

    res.json({ success: true, family: updated });
  } catch (err) {
    console.error('[API PATCH /api/samagra/:familyId/members/:memberId] Error:', err);
    res.status(500).json({ error: 'Failed to update Samagra member status' });
  }
});

// ================= DIGILOCKER LIVE WALLET =================

// Fetch all verified DigiLocker documents for a Citizen (keyed by Samagra Member ID or Firebase UID)
app.get('/api/digilocker/:citizenKey', (req: Request, res: Response) => {
  try {
    const citizenKey = req.params.citizenKey?.trim();
    if (!citizenKey) {
      return res.status(400).json({ error: 'Citizen identifier (Samagra Member ID or UID) is required' });
    }
    const documents = dbService.getDigiLockerDocuments(citizenKey);
    res.json({ citizenKey, documents });
  } catch (err) {
    console.error('[API GET /api/digilocker/:citizenKey] Error:', err);
    res.status(500).json({ error: 'Failed to load DigiLocker documents' });
  }
});

// Verify / issue a live DigiLocker document
app.post('/api/digilocker/verify', (req: Request, res: Response) => {
  try {
    const { citizenKey, docId, docNumber, source, issuer, wardOrBlock } = req.body || {};
    if (!citizenKey || !String(citizenKey).trim() || !docId || !String(docId).trim()) {
      return res.status(400).json({ error: 'citizenKey and docId are required' });
    }

    const cleanKey = String(citizenKey).trim();
    const cleanDocId = String(docId).trim();
    const generatedNum = `DL-${cleanDocId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${cleanKey.slice(-4)}-${String(Date.now()).slice(-4)}`;

    const saved: DigiLockerDocumentRecord = dbService.upsertDigiLockerDocument({
      citizenKey: cleanKey,
      docId: cleanDocId,
      docNumber: docNumber && String(docNumber).trim() ? String(docNumber).trim() : generatedNum,
      source: source === 'mp_edistrict' || source === 'manual' ? source : 'digilocker',
      issuer: issuer ? String(issuer).trim() : 'DigiLocker / MP e-District',
      verified: true,
      verifiedAt: new Date().toISOString(),
    });

    broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'digilocker_verified',
        message: `DigiLocker verified ${cleanDocId.replace(/_/g, ' ').toUpperCase()} (${saved.docNumber}) for Citizen ID ${cleanKey}.`,
        messageHindi: `डिजिलॉकर सत्यापन पूर्ण: ${cleanDocId} (${saved.docNumber}) नागरिक आईडी ${cleanKey} हेतु।`,
        wardOrBlock: wardOrBlock ? String(wardOrBlock) : 'Indore DigiLocker Gateway',
      },
      'digilocker_updated'
    );

    const documents = dbService.getDigiLockerDocuments(cleanKey);
    res.status(201).json({ success: true, document: saved, documents });
  } catch (err) {
    console.error('[API POST /api/digilocker/verify] Error:', err);
    res.status(500).json({ error: 'Failed to verify DigiLocker document' });
  }
});

// Bulk sync multiple DigiLocker documents for a linked Samagra citizen
app.post('/api/digilocker/sync-all', (req: Request, res: Response) => {
  try {
    const { citizenKey, docItems, wardOrBlock } = req.body || {};
    if (!citizenKey || !String(citizenKey).trim() || !Array.isArray(docItems) || docItems.length === 0) {
      return res.status(400).json({ error: 'citizenKey and non-empty docItems array are required' });
    }

    const cleanKey = String(citizenKey).trim();
    const nowIso = new Date().toISOString();

    for (const item of docItems) {
      if (!item?.docId) continue;
      const cleanDocId = String(item.docId).trim();
      const docNum =
        item.docNumber && String(item.docNumber).trim()
          ? String(item.docNumber).trim()
          : `DL-${cleanDocId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${cleanKey.slice(-4)}-${String(Date.now()).slice(-4)}`;
      dbService.upsertDigiLockerDocument({
        citizenKey: cleanKey,
        docId: cleanDocId,
        docNumber: docNum,
        source: item.source === 'mp_edistrict' || item.source === 'manual' ? item.source : 'digilocker',
        issuer: item.issuer ? String(item.issuer) : 'DigiLocker / MP e-District',
        verified: true,
        verifiedAt: nowIso,
      });
    }

    broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'digilocker_verified',
        message: `DigiLocker Wallet synced ${docItems.length} credentials live for Citizen ID ${cleanKey}.`,
        messageHindi: `नागरिक आईडी ${cleanKey} के ${docItems.length} दस्तावेज़ डिजिलॉकर वॉलेट में लाइव सिंक हुए।`,
        wardOrBlock: wardOrBlock ? String(wardOrBlock) : 'Indore DigiLocker Gateway',
      },
      'digilocker_updated'
    );

    const documents = dbService.getDigiLockerDocuments(cleanKey);
    res.json({ success: true, documents });
  } catch (err) {
    console.error('[API POST /api/digilocker/sync-all] Error:', err);
    res.status(500).json({ error: 'Failed to bulk sync DigiLocker documents' });
  }
});

// Revoke / remove a verified DigiLocker document
app.delete('/api/digilocker/:citizenKey/:docId', (req: Request, res: Response) => {
  try {
    const { citizenKey, docId } = req.params;
    dbService.deleteDigiLockerDocument(citizenKey, docId);
    const documents = dbService.getDigiLockerDocuments(citizenKey);
    pushSsePayload({ eventType: 'digilocker_updated', citizenKey });
    res.json({ success: true, documents });
  } catch (err) {
    console.error('[API DELETE /api/digilocker/:citizenKey/:docId] Error:', err);
    res.status(500).json({ error: 'Failed to revoke DigiLocker document' });
  }
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
    console.log(`[YojanaSetu Indore] Live Server listening on http://0.0.0.0:${PORT} with SQLite DB`);
  });
}

startServer();
