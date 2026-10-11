import { NextResponse } from 'next/server';
export async function GET(){return NextResponse.json({error:'Osvježite aplikaciju i pokušajte ponovo.'},{status:410});}
