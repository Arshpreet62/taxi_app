// Business details in one place, so the placeholder phone number is a single change.
export const BUSINESS = {
  name: 'Harbour Ride',
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || '02 0000 0000',
  get tel() {
    const d = this.phone.replace(/[^\d+]/g, '')
    return 'tel:' + (d.startsWith('0') ? '+61' + d.slice(1) : d)
  },
  site: process.env.NEXT_PUBLIC_SITE_URL || 'https://harbour-ride.vercel.app',
}
