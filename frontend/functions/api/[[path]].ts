export async function onRequest(context: any) {
    const { request, env } = context;
  
    const backendBase = env.BACKEND_URL;
    if (!backendBase) {
      return new Response("Missing BACKEND_URL", { status: 500 });
    }
  
    const incomingUrl = new URL(request.url);
    const targetUrl = new URL(backendBase);
  
    // Forward /api/* exactly
    targetUrl.pathname = incomingUrl.pathname;
    targetUrl.search = incomingUrl.search;
  
    return fetch(new Request(targetUrl.toString(), request));
  }