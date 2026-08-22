import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, slug, details } = body;

    if (!to || !slug || !details) {
      return NextResponse.json(
        { error: 'Missing required fields: to, slug, or details.' },
        { status: 400 }
      );
    }

    const smtpApiUrl = process.env.SMTP_API_URL || 'http://localhost:5000/api/send';
    const apiKey = process.env.SMTP_API_KEY || 'smtp_key_a2b5e7e4d388827c0ec5a078d34a061372c1f2310cd74e19d2238940dab0c63b';

    const profileId = process.env.SMTP_PROFILE_ID ? parseInt(process.env.SMTP_PROFILE_ID, 10) : undefined;

    // We build a robust, redundant payload format so it matches various API expectations
    const payload = {
      apiKey: apiKey,
      api_key: apiKey,
      key: apiKey,
      slug: slug,
      template: slug,
      to: to,
      details: details,
      variables: details,
      ...details // Spread variables at the top level
    };

    // Resolve the incoming client's origin to forward it to the mail server
    const clientOrigin = req.headers.get('origin') || req.headers.get('referer') || 'http://localhost:3000';
    let origin = 'http://localhost:3000';
    if (clientOrigin.startsWith('http')) {
      try {
        const parsedUrl = new URL(clientOrigin);
        origin = parsedUrl.origin;
      } catch (_) {}
    }

    console.log(`Sending email to ${to} with slug ${slug} using endpoint ${smtpApiUrl} and origin ${origin}`);

    const response = await fetch(smtpApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'Origin': origin,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mail server returned an error:', response.status, errorText);
      return NextResponse.json(
        { error: `Mail server returned error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
