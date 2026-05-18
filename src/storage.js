import { apiFetch, isApiUnavailable } from "./apiClient";

function localStore() {
  return {
    get: async (key) => {
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
      return true;
    },
  };
}

async function getCloudValue(key) {
  try {
    return await apiFetch(`/api/storage/${encodeURIComponent(key)}`);
  } catch (error) {
    if (isApiUnavailable(error) || error.status === 401) return localStore().get(key);
    throw error;
  }
}

async function setCloudValue(key, value) {
  try {
    await apiFetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
    return true;
  } catch (error) {
    if (isApiUnavailable(error) || error.status === 401) return localStore().set(key, value);
    throw error;
  }
}

export function createHabitStorage() {
  return {
    get: getCloudValue,
    set: setCloudValue,
  };
}
