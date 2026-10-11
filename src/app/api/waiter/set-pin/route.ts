import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ error: 'Za novi privremeni PIN obratite se voditelju, zatim se prijavite emailom.' }, { status: 410 }); }
