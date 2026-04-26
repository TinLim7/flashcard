"use client";

const SKIP_AUTO_RESUME_KEY = "animal-farm-skip-auto-resume-once";

function canUseSessionStorage() {
  return typeof window !== "undefined";
}

export function setSkipAutoResumeOnce() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(SKIP_AUTO_RESUME_KEY, String(Date.now()));
}

export function consumeSkipAutoResumeOnce() {
  if (!canUseSessionStorage()) {
    return false;
  }

  const token = window.sessionStorage.getItem(SKIP_AUTO_RESUME_KEY);

  if (!token) {
    return false;
  }

  window.sessionStorage.removeItem(SKIP_AUTO_RESUME_KEY);
  return true;
}
