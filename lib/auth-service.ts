"use client";

export function getCurrentUser() {
  return Promise.resolve({
    authenticated: true,
    user: null,
    entitlement: null,
  });
}
