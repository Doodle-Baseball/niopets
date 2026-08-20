import { NextResponse } from 'next/server';
import auth from '../../../lib/admin-auth.js';

const { credentialsConfigured, verifyCredentials, ADMIN_TOKEN } = auth;

export async function POST(request) {
  if (!credentialsConfigured() || !ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, token: ADMIN_TOKEN });
}
