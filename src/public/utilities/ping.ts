/**
 * Attempts to connect with the given http(s) address and if the connection fails
 * with a network error or takes more than 5 sec returns `false`. If request went through
 * returns `true`.
 */
export async function ping(address: string): Promise<boolean> {
  const abort = new AbortController();

  const timeoutHandle = setTimeout(() => {
    abort.abort("timed out");
  }, 5000);

  try {
    await fetch(address, {
      method: "GET",
      cache: "reload",
      mode: "no-cors",
      signal: abort.signal,
    });

    return true;
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
