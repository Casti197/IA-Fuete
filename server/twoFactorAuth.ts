import express, { Request, Response } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

/**
 * ============================================================================
 * NOTA DE SEGURIDAD EN PRODUCCIÓN:
 * ============================================================================
 * Para este entorno demostrativo y ágil, almacenamos los secretos TOTP en
 * memoria con respaldo local en un archivo JSON seguro.
 * 
 * En un entorno de producción real de alta seguridad:
 * 1. Los secretos TOTP NUNCA deben guardarse en texto plano. Deben cifrarse
 *    con AES-256-GCM usando una clave maestra derivada de un KMS
 *    (Google Cloud KMS / HashiCorp Vault / AWS KMS).
 * 2. Deben asociarse a un identificador único en una base de datos segura
 *    (ej. PostgreSQL / Firestore) con control de acceso por roles (RBAC).
 * 3. Se deben implementar códigos de recuperación de un solo uso (backup codes)
 *    hasheados con bcrypt o argon2id.
 * 4. Debe haber limitación de tasa de intentos (rate limiting) para prevenir
 *    ataques de fuerza bruta sobre el código de 6 dígitos (máx 3-5 intentos).
 * ============================================================================
 */

interface User2FARecord {
  secret: string; // Base32 secret
  enabled: boolean;
  enabledAt?: string;
  pendingSecret?: string; // Secret generated but awaiting first successful verification
}

const STORAGE_FILE = path.join(process.cwd(), 'two_factor_store.json');

// Memory store for high-speed lookups
const store: Map<string, User2FARecord> = new Map();

// Initialize and load any persisted data
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    for (const [key, val] of Object.entries(parsed)) {
      store.set(key, val as User2FARecord);
    }
  }
} catch (err) {
  console.warn('[2FA] No se pudo leer two_factor_store.json, iniciando almacén en memoria:', err);
}

function persistStore() {
  try {
    const obj: Record<string, User2FARecord> = {};
    for (const [k, v] of store.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[2FA] Error al persistir el almacén:', err);
  }
}

export function findUserRecord(identifier: string): { key: string; record: User2FARecord } | null {
  const norm = identifier.trim().toLowerCase();
  if (store.has(norm)) {
    return { key: norm, record: store.get(norm)! };
  }
  // Try without email domain if domain present
  if (norm.includes('@')) {
    const prefix = norm.split('@')[0];
    if (store.has(prefix)) {
      return { key: prefix, record: store.get(prefix)! };
    }
  } else {
    // Try finding by prefix in existing keys
    for (const [key, record] of store.entries()) {
      if (key.startsWith(norm + '@') || key === norm) {
        return { key, record };
      }
    }
  }
  return null;
}

export const twoFactorRouter = express.Router();

/**
 * POST /api/2fa/login
 * Inicio de sesión básico con soporte para verificación en dos pasos (TOTP):
 * - Si el usuario no tiene 2FA configurado, ingresa directamente.
 * - Si tiene 2FA configurado, exige el código de 6 dígitos de Authenticator.
 */
twoFactorRouter.post('/login', (req: Request, res: Response) => {
  const { username, password, totpToken } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Debes ingresar tu usuario o correo electrónico.' });
  }

  const normUser = username.trim();
  const userEntry = findUserRecord(normUser);
  const is2FAActive = !!(userEntry && userEntry.record.enabled && userEntry.record.secret);

  // Si tiene 2FA activo en el sistema
  if (is2FAActive) {
    if (!totpToken) {
      return res.json({
        success: false,
        requires2FA: true,
        message: 'Autenticación de dos factores requerida.',
        userId: userEntry.key,
      });
    }

    const cleanToken = totpToken.toString().replace(/[\s-]+/g, '');
    if (!/^\d{6}$/.test(cleanToken)) {
      return res.status(400).json({
        success: false,
        requires2FA: true,
        error: 'El código 2FA debe constar de 6 dígitos numéricos.',
      });
    }

    const isVerified = speakeasy.totp.verify({
      secret: userEntry.record.secret,
      encoding: 'base32',
      token: cleanToken,
      window: 1,
    });

    if (!isVerified) {
      return res.status(401).json({
        success: false,
        requires2FA: true,
        error: 'Código 2FA incorrecto o expirado. Revisa tu aplicación de autenticación.',
      });
    }
  }

  const displayName = normUser.includes('@') ? normUser.split('@')[0] : normUser;
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const email = normUser.includes('@') ? normUser : `${normUser.toLowerCase()}@elfuete.ai`;

  return res.json({
    success: true,
    requires2FA: false,
    message: is2FAActive ? 'Acceso concedido con 2FA verificado.' : 'Inicio de sesión exitoso.',
    user: {
      name: capitalizedName,
      email: email,
      role: 'Usuario',
      twoFactorEnabled: is2FAActive,
      twoFactorEnabledAt: userEntry?.record.enabledAt,
    },
    token: 'mock_jwt_session_' + Date.now(),
  });
});

/**
 * GET /api/2fa/status?userId=xxx
 * Obtiene el estado actual de 2FA para el usuario
 */
twoFactorRouter.get('/status', (req: Request, res: Response) => {
  const userId = (req.query.userId as string)?.trim().toLowerCase();
  if (!userId) {
    return res.status(400).json({ error: 'El parámetro userId es obligatorio' });
  }

  const userEntry = findUserRecord(userId);
  const isEnabled = !!(userEntry && userEntry.record.enabled && userEntry.record.secret);

  return res.json({
    userId,
    enabled: isEnabled,
    enabledAt: userEntry?.record.enabledAt || null,
  });
});

/**
 * POST /api/2fa/generate
 * Genera un nuevo secreto TOTP y su código QR para registrar en Google/MS Authenticator
 */
twoFactorRouter.post('/generate', async (req: Request, res: Response) => {
  const { userId, userEmail } = req.body;
  const normalizedId = (userId || userEmail || 'alejo').toString().trim().toLowerCase();

  try {
    const label = userEmail || userId || 'Usuario El Fuete';
    
    // Generar un secreto TOTP compatible con Google Authenticator / Microsoft Authenticator / Authy
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `El Fuete (${label})`,
      issuer: 'El Fuete AI',
    });

    if (!secret.otpauth_url || !secret.base32) {
      return res.status(500).json({ error: 'No se pudo generar el secreto TOTP' });
    }

    // Generar código QR en base64 Data URL para el frontend
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 260,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Guardar secreto provisional pendiente de confirmación
    const existing = store.get(normalizedId) || { secret: '', enabled: false };
    store.set(normalizedId, {
      ...existing,
      pendingSecret: secret.base32,
    });
    persistStore();

    return res.json({
      success: true,
      secretBase32: secret.base32,
      qrCode: qrCodeDataUrl,
      otpauthUrl: secret.otpauth_url,
      instructions: 'Escanea el código QR con Google Authenticator, Microsoft Authenticator o cualquier app TOTP, luego ingresa el código de 6 dígitos para activarlo.',
    });
  } catch (err: any) {
    console.error('[2FA] Error generando configuración TOTP:', err);
    return res.status(500).json({ error: 'Error al generar el secreto 2FA' });
  }
});

/**
 * POST /api/2fa/verify-and-activate
 * Valida el código de 6 dígitos ingresado por primera vez y activa oficialmente el 2FA
 */
twoFactorRouter.post('/verify-and-activate', (req: Request, res: Response) => {
  const { userId, token } = req.body;
  const normalizedId = (userId || 'alejo').toString().trim().toLowerCase();
  const cleanToken = (token || '').toString().replace(/[\s-]+/g, '');

  if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return res.status(400).json({ error: 'Debes ingresar un código numérico válido de 6 dígitos' });
  }

  const record = store.get(normalizedId);
  const secretToVerify = record?.pendingSecret || record?.secret;

  if (!secretToVerify) {
    return res.status(400).json({
      error: 'No hay un proceso de 2FA iniciado para este usuario. Genera un nuevo código QR.',
    });
  }

  // Verificar el token con ventana de tolerancia de +/- 30 segundos (window = 1)
  const isVerified = speakeasy.totp.verify({
    secret: secretToVerify,
    encoding: 'base32',
    token: cleanToken,
    window: 1,
  });

  if (!isVerified) {
    return res.status(400).json({
      error: 'El código de 6 dígitos es incorrecto o ya ha expirado. Intenta de nuevo con el código actual de tu aplicación.',
    });
  }

  // Activar formalmente el 2FA y limpiar el secreto provisional
  store.set(normalizedId, {
    secret: secretToVerify,
    enabled: true,
    enabledAt: new Date().toISOString(),
    pendingSecret: undefined,
  });
  persistStore();

  return res.json({
    success: true,
    message: '¡Autenticación de dos factores (2FA) activada exitosamente!',
    enabled: true,
  });
});

/**
 * POST /api/2fa/verify-action
 * Verifica un código TOTP para confirmar una acción sensible (ej. cambio de nombre, purga de tareas, exportación)
 */
twoFactorRouter.post('/verify-action', (req: Request, res: Response) => {
  const { userId, token, actionName } = req.body;
  const normalizedId = (userId || 'alejo').toString().trim().toLowerCase();
  const cleanToken = (token || '').toString().replace(/[\s-]+/g, '');

  const record = store.get(normalizedId);
  if (!record || !record.enabled || !record.secret) {
    // Si el usuario no tiene 2FA habilitado, la acción se aprueba directamente
    return res.json({
      valid: true,
      requires2FA: false,
      message: '2FA no requerido',
    });
  }

  if (!cleanToken || !/^\d{6}$/.test(cleanToken)) {
    return res.status(400).json({
      valid: false,
      error: 'Se requiere un token TOTP de 6 dígitos para autorizar esta acción',
    });
  }

  const isVerified = speakeasy.totp.verify({
    secret: record.secret,
    encoding: 'base32',
    token: cleanToken,
    window: 1,
  });

  if (!isVerified) {
    return res.status(403).json({
      valid: false,
      error: 'Código 2FA incorrecto o expirado. Acción no autorizada.',
    });
  }

  return res.json({
    valid: true,
    message: actionName ? `Acción "${actionName}" autorizada con éxito.` : 'Código 2FA verificado correctamente.',
  });
});

/**
 * POST /api/2fa/disable
 * Desactiva el 2FA para el usuario tras validar su código actual
 */
twoFactorRouter.post('/disable', (req: Request, res: Response) => {
  const { userId, token } = req.body;
  const normalizedId = (userId || 'alejo').toString().trim().toLowerCase();
  const cleanToken = (token || '').toString().replace(/[\s-]+/g, '');

  const record = store.get(normalizedId);
  if (!record || !record.enabled) {
    return res.json({
      success: true,
      message: 'El 2FA ya se encontraba desactivado.',
      enabled: false,
    });
  }

  // Exigir código para desactivar como salvaguarda de seguridad
  const isVerified = speakeasy.totp.verify({
    secret: record.secret,
    encoding: 'base32',
    token: cleanToken,
    window: 1,
  });

  if (!isVerified) {
    return res.status(400).json({
      error: 'Debes ingresar el código actual de 6 dígitos de tu app autenticadora para poder desactivar el 2FA.',
    });
  }

  store.set(normalizedId, {
    secret: '',
    enabled: false,
    enabledAt: undefined,
    pendingSecret: undefined,
  });
  persistStore();

  return res.json({
    success: true,
    message: 'Autenticación de dos factores desactivada correctamente.',
    enabled: false,
  });
});
