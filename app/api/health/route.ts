import { connection } from 'next/server'

export async function GET() {
  await connection()
  return Response.json({ status: 'ok', service: 'harbour-ride', email: process.env.RESEND_API_KEY ? 'resend' : 'console' })
}
