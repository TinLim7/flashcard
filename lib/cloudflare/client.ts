"use client";

import { v4 as uuidv4 } from "uuid";

const DEVICE_STORAGE_KEY = "animal-farm-cloudflare-device-id";
const DEVICE_LABEL_STORAGE_KEY = "animal-farm-cloudflare-device-label";
const REQUEST_TIMEOUT_MS = 12000;
const CLIENT_RUNTIME_TAG = "20260424-cloudflare-v1";

type AppServiceResponse<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; retryable?: boolean };

export interface CloudflareContext {
  uid: string;
  ownerId: string;
  deviceId: string;
  deviceLabel: string;
}

export class CloudflareAppError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CloudflareAppError";
    this.code = code;
  }
}

let ensuredContext: CloudflareContext | null = null;
let ensureContextPromise: Promise<CloudflareContext> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function getStoredValue(key: string) {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(key);
}

function setStoredValue(key: string, value: string) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, value);
}

function withTimeout<T>(promise: Promise<T>, message: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new CloudflareAppError("REQUEST_TIMEOUT", message));
      }, REQUEST_TIMEOUT_MS);
    }),
  ]);
}

export function getStableDeviceId() {
  const existingValue = getStoredValue(DEVICE_STORAGE_KEY);

  if (existingValue) {
    return existingValue;
  }

  const nextValue = `dev_${uuidv4().slice(0, 8)}`;
  setStoredValue(DEVICE_STORAGE_KEY, nextValue);
  return nextValue;
}

export function getDefaultDeviceLabel() {
  if (!isBrowser()) {
    return "Current Browser";
  }

  const existingLabel = getStoredValue(DEVICE_LABEL_STORAGE_KEY);

  if (existingLabel) {
    return existingLabel;
  }

  const platform = window.navigator.platform || "Unknown Platform";
  const nextLabel = `${platform} - 浏览器`;
  setStoredValue(DEVICE_LABEL_STORAGE_KEY, nextLabel);
  return nextLabel;
}

async function invokeFunction<T>(
  action: string,
  payload: Record<string, unknown> = {},
  traceId?: string,
) {
  const response = await withTimeout(
    fetch("/api/app-service", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action,
        payload,
        traceId,
        runtimeTag: CLIENT_RUNTIME_TAG,
      }),
    }),
    `Cloudflare 后端 ${action} 调用超时，请稍后重试。`,
  );

  if (!response.ok) {
    throw new CloudflareAppError("HTTP_ERROR", `Cloudflare 后端请求失败: ${response.status}`);
  }

  const result = (await response.json()) as AppServiceResponse<T>;

  if (!result.ok) {
    throw new CloudflareAppError(
      result.code || "INTERNAL_ERROR",
      result.message || "Cloudflare 后端返回失败",
    );
  }

  return result.data;
}

export async function ensureCloudflareContext() {
  if (ensuredContext) {
    return ensuredContext;
  }

  if (ensureContextPromise) {
    return ensureContextPromise;
  }

  ensureContextPromise = (async () => {
    const deviceId = getStableDeviceId();
    const deviceLabel = getDefaultDeviceLabel();
    const context = await invokeFunction<CloudflareContext>("ensureContext", {
      deviceId,
      deviceLabel,
    });

    ensuredContext = context;
    return context;
  })();

  try {
    return await ensureContextPromise;
  } finally {
    ensureContextPromise = null;
  }
}

export async function callAppService<T>(
  action: string,
  payload: Record<string, unknown> = {},
  traceId?: string,
) {
  const context = await ensureCloudflareContext();

  return invokeFunction<T>(
    action,
    {
      ...payload,
      clientContext: {
        ownerId: context.ownerId,
        deviceId: context.deviceId,
        deviceLabel: context.deviceLabel,
        uid: context.uid,
        runtimeTag: CLIENT_RUNTIME_TAG,
      },
    },
    traceId,
  );
}
