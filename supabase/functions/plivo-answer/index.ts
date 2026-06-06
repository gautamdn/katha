import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// Plivo answer-URL endpoint for the Plan 1.5 hello-world dial.
// GET /functions/v1/plivo-answer?lang=kn|gu
// Returns Plivo XML that plays a pre-generated Susheela greeting and hangs up.
//
// Why verify_jwt is disabled (see supabase/config.toml): Plivo's fetcher is
// unauthenticated. Production calling will add HMAC signature verification
// against Plivo's X-Plivo-Signature header (Plan 2.0); for hello-world we
// don't validate — the worst outcome of a stray request is a public WAV URL
// gets returned.

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

Deno.serve((req) => {
  const url = new URL(req.url);
  const lang = url.searchParams.get('lang');

  let audioUrl: string | undefined;
  if (lang === 'kn') audioUrl = Deno.env.get('AUDIO_HELLO_URL_KN');
  else if (lang === 'gu') audioUrl = Deno.env.get('AUDIO_HELLO_URL_GU');
  else {
    return new Response('lang must be kn or gu', { status: 400 });
  }

  if (!audioUrl) {
    return new Response(`AUDIO_HELLO_URL_${lang.toUpperCase()} not configured`, {
      status: 500,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Play>${xmlEscape(audioUrl)}</Play></Response>`;

  return new Response(xml, {
    status: 200,
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
});
