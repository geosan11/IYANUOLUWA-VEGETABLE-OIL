/**
 * Alert Tracking & Autonomous Dispatch Service
 * 
 * Automatically tracks depot anomalies and out-of-the-ordinary events
 * (pump variances, intake shortfalls, shift cash shortfalls, credit breaches,
 * low stock levels) and autonomously dispatches notifications via browser Web Push
 * and Depot Alert Log / Email webhook.
 */

import { Customer, Tank, Shift, PumpVarianceAudit, Product } from '../types';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 
  | 'pump_variance'
  | 'delivery_shortfall'
  | 'shift_cash_discrepancy'
  | 'credit_limit_breach'
  | 'overdue_debt'
  | 'low_tank_stock'
  | 'price_override_anomaly';

export interface AutonomousAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  channels: ('email' | 'push' | 'in_app')[];
  acknowledged: boolean;
  meta?: Record<string, unknown>;
}

export interface AlertSettings {
  emailAlertsEnabled: boolean;
  pushAlertsEnabled: boolean;
  recipientEmail: string;
  notifyOnPumpVariance: boolean;
  notifyOnIntakeShortfall: boolean;
  notifyOnCashDiscrepancy: boolean;
  notifyOnCreditBreach: boolean;
  notifyOnLowStock: boolean;
  lastDispatchedAt?: string;
}

const ALERT_SETTINGS_KEY = 'depot_alert_settings';
const ALERT_LOG_KEY = 'depot_autonomous_alerts_log';

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  emailAlertsEnabled: true,
  pushAlertsEnabled: true,
  recipientEmail: 'managingdirector@iyanuoluwa.ng',
  notifyOnPumpVariance: true,
  notifyOnIntakeShortfall: true,
  notifyOnCashDiscrepancy: true,
  notifyOnCreditBreach: true,
  notifyOnLowStock: true
};

/** Load alert preferences from localStorage */
export function getAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(ALERT_SETTINGS_KEY);
    return raw ? { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_ALERT_SETTINGS;
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

/** Save alert preferences */
export function saveAlertSettings(settings: Partial<AlertSettings>): AlertSettings {
  const current = getAlertSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

/** Load history of dispatched alerts */
export function getAutonomousAlertsLog(): AutonomousAlert[] {
  try {
    const raw = localStorage.getItem(ALERT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Append an alert to the autonomous history log */
function appendAlertToLog(alert: AutonomousAlert) {
  try {
    const existing = getAutonomousAlertsLog();
    // Keep maximum 100 recent alerts
    const updated = [alert, ...existing].slice(0, 100);
    localStorage.setItem(ALERT_LOG_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Request Web Push / Browser Notification permission
 */
export async function requestPushNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

/**
 * Trigger an autonomous alert across enabled channels (Browser Push + Simulated Email Dispatch)
 */
export function dispatchAutonomousAlert(payload: {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  meta?: Record<string, unknown>;
}): AutonomousAlert {
  const settings = getAlertSettings();
  const channels: ('email' | 'push' | 'in_app')[] = ['in_app'];

  // Check Web Push
  if (settings.pushAlertsEnabled && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`🚨 ${payload.title}`, {
        body: payload.message,
        icon: '/favicon.ico',
        tag: `${payload.category}-${Date.now()}`
      });
      channels.push('push');
    } catch {
      // Notification failed in some iframe or sandbox environments
    }
  }

  // Check Email
  if (settings.emailAlertsEnabled && settings.recipientEmail) {
    channels.push('email');
  }

  const alert: AutonomousAlert = {
    id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: payload.category,
    severity: payload.severity,
    title: payload.title,
    message: payload.message,
    timestamp: new Date().toISOString(),
    channels,
    acknowledged: false,
    meta: payload.meta
  };

  appendAlertToLog(alert);
  return alert;
}

/**
 * Check for out-of-the-ordinary events and autonomously trigger alerts
 * Deduplicates recently sent alerts within a 30-minute cooldown per issue.
 */
export function scanAndTriggerAutonomousAlerts(data: {
  pumpVarianceAudits: PumpVarianceAudit[];
  deliveryShortfall: { tank: Tank; shortfallLitres: number }[];
  shiftDiscrepancy: Shift[];
  overLimit: { customer: Customer; balance: number; limit: number; excess: number }[];
  overdueCredit: { customer: Customer; overdueDays: number; amount: number }[];
  lowTankStock: { product: Product; litres: number; threshold: number }[];
}): AutonomousAlert[] {
  const settings = getAlertSettings();
  const recentAlerts = getAutonomousAlertsLog();
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

  const triggered: AutonomousAlert[] = [];

  const isDuplicate = (category: AlertCategory, key: string) => {
    return recentAlerts.some(
      a =>
        a.category === category &&
        new Date(a.timestamp).getTime() > thirtyMinutesAgo &&
        a.meta?.key === key
    );
  };

  // 1. Pump variance anomalies
  if (settings.notifyOnPumpVariance) {
    for (const audit of data.pumpVarianceAudits) {
      if (audit.isOverThreshold && !isDuplicate('pump_variance', audit.pumpId)) {
        const alt = dispatchAutonomousAlert({
          category: 'pump_variance',
          severity: 'critical',
          title: `Pump Meter Variance Flagged: ${audit.pumpLabel}`,
          message: `Odometer delta (${audit.meterDelta.toLocaleString()} L) differs from sold volume (${audit.expectedLitres.toLocaleString()} L) by ${audit.variance > 0 ? '+' : ''}${audit.variance.toLocaleString()} L on ${audit.day}.`,
          meta: { key: audit.pumpId, pumpLabel: audit.pumpLabel, variance: audit.variance }
        });
        triggered.push(alt);
      }
    }
  }

  // 2. Delivery shortfall anomalies
  if (settings.notifyOnIntakeShortfall) {
    for (const item of data.deliveryShortfall) {
      if (!isDuplicate('delivery_shortfall', item.tank.id)) {
        const alt = dispatchAutonomousAlert({
          category: 'delivery_shortfall',
          severity: 'critical',
          title: `Delivery Shortfall: ${item.tank.truck_label}`,
          message: `Intake recovery shortfall of ${item.shortfallLitres.toLocaleString()} L exceeds allowed threshold for ${item.tank.truck_label}.`,
          meta: { key: item.tank.id, truckLabel: item.tank.truck_label, shortfall: item.shortfallLitres }
        });
        triggered.push(alt);
      }
    }
  }

  // 3. Shift drawer cash discrepancies
  if (settings.notifyOnCashDiscrepancy) {
    for (const shift of data.shiftDiscrepancy) {
      if (!isDuplicate('shift_cash_discrepancy', shift.id)) {
        const alt = dispatchAutonomousAlert({
          category: 'shift_cash_discrepancy',
          severity: 'critical',
          title: `Shift Cash Discrepancy: ${shift.cashier_name || 'Cashier'}`,
          message: `Closed shift ended with cash variance of ₦${(shift.cash_variance || 0).toLocaleString()} (Counted: ₦${(shift.cash_counted || 0).toLocaleString()}, Expected: ₦${(shift.expected_cash || 0).toLocaleString()}).`,
          meta: { key: shift.id, cashier: shift.cashier_name, variance: shift.cash_variance }
        });
        triggered.push(alt);
      }
    }
  }

  // 4. Credit limit breaches
  if (settings.notifyOnCreditBreach) {
    for (const item of data.overLimit) {
      if (!isDuplicate('credit_limit_breach', item.customer.id)) {
        const alt = dispatchAutonomousAlert({
          category: 'credit_limit_breach',
          severity: 'warning',
          title: `Debt Cap Exceeded: ${item.customer.name}`,
          message: `Customer balance of ₦${item.balance.toLocaleString()} exceeds approved limit of ₦${item.limit.toLocaleString()} by ₦${item.excess.toLocaleString()}.`,
          meta: { key: item.customer.id, customer: item.customer.name, excess: item.excess }
        });
        triggered.push(alt);
      }
    }
  }

  // 5. Low tank stocks
  if (settings.notifyOnLowStock) {
    for (const item of data.lowTankStock) {
      if (!isDuplicate('low_tank_stock', item.product.id)) {
        const alt = dispatchAutonomousAlert({
          category: 'low_tank_stock',
          severity: 'warning',
          title: `Critical Low Stock: ${item.product.name}`,
          message: `Available depot tank volume (${item.litres.toLocaleString()} L) is below safety reserve threshold of ${item.threshold.toLocaleString()} L.`,
          meta: { key: item.product.id, product: item.product.name, litres: item.litres }
        });
        triggered.push(alt);
      }
    }
  }

  return triggered;
}
