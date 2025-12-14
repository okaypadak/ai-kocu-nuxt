import Iyzipay from 'iyzipay'
import { defineEventHandler, readBody, readRawBody, sendRedirect, setHeader, setResponseStatus } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import { createClient } from '@supabase/supabase-js'
import {
  persistPremiumCookie,
  createCookieAdapter
} from '~/server/utils/premium'
import { PACKAGES } from '~/api/premium'

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: process.env.IYZICO_URI || 'https://sandbox-api.iyzipay.com'
})

// Helper to create Admin Client (Service Role)
const createSupabaseAdminClient = () => {
    const url = process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    return createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
}

export default defineEventHandler(async (event) => {
  const method = event.node.req.method ?? 'GET'
  const rawParam = event.context.params?.path ?? ''
  const pathname = rawParam ? `/${rawParam}` : '/'
  
  const supabase = await serverSupabaseClient(event)
  const cookieAdapter = createCookieAdapter(event)

  const send = (status: number, body: any) => {
    setResponseStatus(event, status)
    return body
  }

  if (method === 'OPTIONS') {
    setHeader(event, 'Access-Control-Allow-Origin', '*')
    setHeader(event, 'Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
    setHeader(event, 'Access-Control-Allow-Private-Network', 'true')
    setResponseStatus(event, 204)
    return null
  }

  if (method === 'POST' && pathname === '/initialize') {
    let parsedBody: Record<string, any> = {}
    try {
      parsedBody = (await readBody<Record<string, any>>(event)) ?? {}
    } catch {
      return send(400, { error: 'Invalid JSON' })
    }

    const { userId, packageUuid, cardData } = parsedBody
    if (!userId || !packageUuid || !cardData) {
      return send(400, { error: 'Eksik parametreler' })
    }

    const pkgKey = (Object.keys(PACKAGES) as Array<keyof typeof PACKAGES>).find(
      (key) => PACKAGES[key].uuid === packageUuid
    )
    const pkg = pkgKey ? PACKAGES[pkgKey] : null

    if (!pkg) {
      return send(400, { error: 'Gecersiz paket' })
    }

    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (userError || !userProfile) {
      return send(400, { error: 'Kullanici profili bulunamadi' })
    }

    const price = pkg.gross
    const conversationId = `${userId}|${pkgKey}|${Date.now()}`

    const protocol = (event.node.req.headers['x-forwarded-proto'] as string) || 'http'
    const host = event.node.req.headers.host
    const callbackUrl = `${protocol}://${host}/api/payment/callback`

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId,
      price: price.toFixed(2),
      paidPrice: price.toFixed(2),
      currency: Iyzipay.CURRENCY.TRY,
      installment: '1',
      basketId: `B${Math.floor(Math.random() * 10000)}`,
      paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl,
      paymentCard: {
        cardHolderName: cardData.cardHolderName,
        cardNumber: cardData.cardNumber,
        expireMonth: cardData.expireMonth,
        expireYear: cardData.expireYear,
        cvc: cardData.cvc,
        registerCard: '0'
      },
      buyer: {
        id: userId,
        name: userProfile.fullname?.split(' ')[0] || 'User',
        surname: userProfile.fullname?.split(' ').slice(1).join(' ') || 'Name',
        gsmNumber: '+905555555555',
        email: userProfile.email || 'user@example.com',
        identityNumber: userProfile.customer_tax_number || '11111111111',
        registrationAddress: 'AI Kocu Adres',
        ip: (event.node.req.headers['x-forwarded-for'] as string) ?? event.node.req.socket.remoteAddress,
        city: 'Istanbul',
        country: 'Turkey',
        zipCode: '34732'
      },
      shippingAddress: {
        contactName: userProfile.fullname || 'User',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'AI Kocu Adres',
        zipCode: '34732'
      },
      billingAddress: {
        contactName: userProfile.fullname || 'User',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'AI Kocu Adres',
        zipCode: '34732'
      },
      basketItems: [
        {
          id: pkg.uuid,
          name: pkg.label,
          category1: 'Education',
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: price.toFixed(2)
        }
      ]
    }

    const initResult = await new Promise<{ error?: any; result?: any }>((resolve) => {
      iyzipay.threedsInitialize.create(request, (err, result) => resolve({ error: err, result }))
    })

    if (initResult.error || initResult.result?.status !== 'success') {
      console.error('Iyzico Init Error:', initResult.error || initResult.result?.errorMessage)
      return send(400, { error: initResult.result?.errorMessage || 'Ödeme başlatılamadı' })
    }

    let html = initResult.result.threeDSHtmlContent
    if (html && typeof html === 'string' && !html.trim().startsWith('<')) {
      try {
        html = Buffer.from(html, 'base64').toString('utf-8')
      } catch (err) {
        console.warn('Failed to decode 3DS HTML, using raw value', err)
      }
    }

    return send(200, { html })
  }

  if (method === 'POST' && pathname === '/callback') {
    const bodyStr = ((await readRawBody(event, 'utf-8')) as string) || ''
    const params = new URLSearchParams(bodyStr)
    const paymentId = params.get('paymentId')
    const conversationId = params.get('conversationId') || ''
    const status = params.get('status')

    let userId: string | null = null
    let pkgKey: string | null = null
    try {
      const parts = conversationId.split('|')
      userId = parts[0]
      pkgKey = parts[1]
    } catch (err) {
      console.error('Callback parsing error', err)
    }

    if (status !== 'success') {
      return sendRedirect(
        event,
        `/odeme-basarisiz?msg=${encodeURIComponent('3D Secure onayı alınamadı')}`,
        302
      )
    }

    const finishResult = await new Promise<{ error?: any; result?: any }>((resolve) => {
      const finishRequest = {
        locale: Iyzipay.LOCALE.TR,
        conversationId,
        paymentId,
        conversationData: params.get('conversationData')
      }

      iyzipay.threedsPayment.create(finishRequest, (err, result) => resolve({ error: err, result }))
    })

    if (finishResult.error || finishResult.result?.status !== 'success') {
      console.error('3DS Finish Error:', finishResult.error || finishResult.result?.errorMessage)
      const failureMsg = finishResult.result?.errorMessage || 'Ödeme tamamlanamadı'
      const failHtml = `
        <html>
          <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
            <div style="text-align:center;">
              <h3 style="color:#e11d48;">Ödeme Başarısız</h3>
              <p>${failureMsg}</p>
              <p>Pencere kapanıyor...</p>
            </div>
            <script>
              setTimeout(() => {
                window.top.postMessage({ type: 'payment_failure', message: '${failureMsg}' }, '*');
              }, 1500);
            </script>
          </body>
        </html>
      `
      setHeader(event, 'content-type', 'text/html; charset=utf-8')
      return send(200, failHtml)
    }

    const pkg = pkgKey ? PACKAGES[pkgKey as keyof typeof PACKAGES] : null
    let newDateISO: string | null = null
    if (pkg && userId) {
      const months = pkg.months
      const now = new Date()
      let endsAt = new Date(now)
      const admin = createSupabaseAdminClient()

      if (admin) {
        const { data: currentProfile } = await admin
          .from('profiles')
          .select('premium_ends_at')
          .eq('user_id', userId)
          .single()
        if (currentProfile && currentProfile.premium_ends_at) {
          const currentEnd = new Date(currentProfile.premium_ends_at as string)
          if (currentEnd > now) {
            endsAt = currentEnd
          }
        }

        endsAt.setMonth(endsAt.getMonth() + months)
        newDateISO = endsAt.toISOString()

        await admin.from('profiles').update({ premium_ends_at: newDateISO }).eq('user_id', userId)
        persistPremiumCookie(cookieAdapter, userId, newDateISO)
      } else {
        console.error('Admin client not available (Missing Key), cannot update DB!')
      }
    }

    const successHtml = `
      <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center;">
            <h3 style="color:#10b981;">Ödeme Başarılı!</h3>
            <p>Yönlendiriliyorsunuz...</p>
          </div>
          <script>
            setTimeout(() => {
              window.top.postMessage({
                  type: 'payment_success',
                  premiumEndsAt: '${newDateISO || ''}'
              }, '*');
            }, 1000);
          </script>
        </body>
      </html>
    `
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return send(200, successHtml)
  }

  return send(404, { error: 'Not Found' })
})
