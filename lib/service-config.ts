import type { DataMode, ServiceRuntimeInfo } from "@/lib/types";

function getRequestedMode(): DataMode {
  return process.env.NEXT_PUBLIC_DATA_MODE === "cloudflare" ? "cloudflare" : "mock";
}

export function getServiceRuntimeInfo(): ServiceRuntimeInfo {
  const requestedMode = getRequestedMode();

  if (requestedMode === "cloudflare") {
    return {
      mode: "cloudflare",
      requestedMode,
      isFallback: false,
    };
  }

  return {
    mode: "mock",
    requestedMode,
    isFallback: false,
  };
}

export function shouldUseCloudflare() {
  return getServiceRuntimeInfo().mode === "cloudflare";
}
