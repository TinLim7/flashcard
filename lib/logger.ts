import { v4 as uuidv4 } from "uuid";

import type { FrontendLogContext } from "@/lib/types";

const DEVICE_STORAGE_KEY = "animal-farm-device-id";

function getDeviceId() {
  if (typeof window === "undefined") {
    return "dev-server";
  }

  const existingId = window.localStorage.getItem(DEVICE_STORAGE_KEY);

  if (existingId) {
    return existingId;
  }

  const nextId = `dev_${uuidv4().slice(0, 8)}`;
  window.localStorage.setItem(DEVICE_STORAGE_KEY, nextId);
  return nextId;
}

export const logger = {
  log(eventName: string, context: FrontendLogContext = {}) {
    const payload = {
      event: eventName,
      timestamp: context.timestamp ?? new Date().toISOString(),
      device_id: context.device_id ?? getDeviceId(),
      trace_id: context.trace_id ?? uuidv4(),
      ...context,
    };

    console.info("[frontend-event]", payload);
    return payload;
  },
};
