// src/api/premium.ts

export type PackageKey = 'monthly' | '3months' | '6months' | '12months'

export type PremiumPackage = {
    uuid: string
    months: number
    net: number
    vat: number
    gross: number
    label: string
    description: string
}

export const PACKAGES: Record<PackageKey, PremiumPackage> = {
    monthly: {
        uuid: "c43a5b62-80d4-4851-9fc7-95afb8850ddc",
        months: 1,
        net: 50,
        vat: 9,
        gross: 59,
        label: 'Aylık',
        description: 'En pahalı birim fiyat'
    },
    "3months": {
        uuid: "5607d23d-48bc-4f4d-a8d0-c7f460165882",
        months: 3,
        net: 135,
        vat: 24.30,
        gross: 159.30,
        label: '3 Aylık',
        description: '%10 indirim'
    },
    "6months": {
        uuid: "ca6321cc-5c86-4cb6-b432-a5f5cf8deab7",
        months: 6,
        net: 240,
        vat: 43.20,
        gross: 283.20,
        label: '6 Aylık',
        description: '%20 indirim'
    },
    "12months": {
        uuid: "cf8f291a-e87f-434f-850b-9411bc6d2cdf",
        months: 12,
        net: 390,
        vat: 70.20,
        gross: 460.20,
        label: '12 Aylık',
        description: '%35 indirim (en cazip)'
    },
}

export type CreatePaymentResponse = {
    html?: string
    error?: string
}

export type CardData = {
    cardHolderName: string
    cardNumber: string
    expireMonth: string
    expireYear: string
    cvc: string
}

/** Node.js sunucusunda iyzico baslat (iframe icin HTML doner) */
export async function createPremiumPayment(params: {
    userId: string
    packageUuid: string
    cardData: CardData
}): Promise<CreatePaymentResponse> {
    const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Ödeme başlatılamadı')
    }

    return res.json()
}
