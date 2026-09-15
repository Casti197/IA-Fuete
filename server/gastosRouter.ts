import { Router } from 'express';

export const gastosRouter = Router();

const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbz_vjjGyz-ZlLWrkqvlRvba_S22ybiDsSC2pnszfMwHCwrl2kJ_fxrob2oaQf258zjGOQ/exec';

// POST /api/gastos/enviar - Enviar gasto individual a Google Apps Script / Excel
gastosRouter.post('/enviar', async (req, res) => {
  try {
    const { url, gasto } = req.body;

    if (!gasto || typeof gasto !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'El objeto de gasto es obligatorio',
      });
    }

    const targetUrl = url && typeof url === 'string' && url.trim() !== ''
      ? url.trim()
      : DEFAULT_WEBHOOK_URL;

    // Normalizar payload con la estructura exacta requerida por el Apps Script
    const payload = {
      fecha: String(gasto.fecha || ''),
      hora: String(gasto.hora || ''),
      registro: String(gasto.registro || '001'),
      gasto: Number(gasto.gasto || 0),
      elemento: String(gasto.elemento || 'Sin concepto'),
    };

    console.log(`[Gastos] Enviando a Google Sheets:`, payload);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    let data: any = null;
    const textResponse = await response.text();

    try {
      data = JSON.parse(textResponse);
    } catch {
      data = { raw: textResponse };
    }

    return res.json({
      ok: response.ok,
      status: response.status,
      data: data,
      enviadoAt: new Date().toISOString(),
      payloadEnviado: payload,
    });
  } catch (error: any) {
    console.error('[Gastos] Error al conectar con Google Apps Script:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error al conectar con Google Apps Script',
    });
  }
});

// POST /api/gastos/test - Probar estado de conexión del webhook
gastosRouter.post('/test', async (req, res) => {
  try {
    const { url } = req.body;
    const targetUrl = url && typeof url === 'string' && url.trim() !== ''
      ? url.trim()
      : DEFAULT_WEBHOOK_URL;

    const testPayload = {
      fecha: 'TEST',
      hora: 'TEST',
      registro: 'TEST',
      gasto: 0,
      elemento: 'Test de conectividad El Fuete',
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(testPayload),
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return res.json({
      ok: response.ok,
      status: response.status,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});
