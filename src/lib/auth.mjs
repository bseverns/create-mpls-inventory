/**
 * @param {string} left
 * @param {string} right
 */
function equalConstantTime(left, right) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/**
 * @param {Headers} headers
 * @param {Readonly<Record<string, string | undefined>>} [environment]
 */
export function isAuthorized(headers, environment = process.env) {
  const username = environment.INVENTORY_USERNAME;
  const password = environment.INVENTORY_PASSWORD;
  const credentials = headers.get("authorization")?.match(/^Basic +(.+)$/i)?.[1];
  if (!username || !password || !credentials) return false;

  try {
    const bytes = Uint8Array.from(atob(credentials), (byte) => byte.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const usernameMatches = equalConstantTime(decoded.slice(0, separator), username);
    const passwordMatches = equalConstantTime(decoded.slice(separator + 1), password);
    return usernameMatches && passwordMatches;
  } catch {
    return false;
  }
}

export function unauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="createMPLS Inventory", charset="UTF-8"',
    },
  });
}
