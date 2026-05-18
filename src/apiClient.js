export class ApiUnavailableError extends Error {
  constructor(message = "The server API is unavailable.") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
  } catch (error) {
    throw new ApiUnavailableError(error.message);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new ApiUnavailableError("The server did not return JSON.");
  }

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function isApiUnavailable(error) {
  return error instanceof ApiUnavailableError || error?.status === 503;
}
