const AUTH_BASE = '/api/auth'

type HttpOptions = { method?: 'GET' | 'POST'; body?: Record<string, any> }

async function request<T>(path: string, options: HttpOptions = {}): Promise<T> {
    const res = await fetch(`${AUTH_BASE}${path}`, {
        method: options.method ?? 'GET',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined
    })

    const parsed = (await res.json().catch(() => ({}))) as { error?: string } & T
    if (!res.ok) {
        throw new Error(parsed.error || 'İstek başarısız')
    }
    return parsed
}

export const AuthGateway = {
    async session() {
        return request<{ session: any; user: any; premiumEndsAt: string | null; preferredCurriculumId: string | null }>('')
    },
    async login(email: string, password: string) {
        return request<{ session: any; user: any; premiumEndsAt: string | null; preferredCurriculumId: string | null }>('/login', {
            method: 'POST',
            body: { email, password }
        })
    },
    async signup(email: string, password: string, data: Record<string, any> = {}) {
        return request<{ session: any; user: any; premiumEndsAt: string | null; preferredCurriculumId: string | null }>('/signup', {
            method: 'POST',
            body: { email, password, data }
        })
    },
    async logout() {
        return request<{ success: boolean }>('/logout', { method: 'POST' })
    },
    async resend(email: string) {
        return request<{ success: boolean }>('/resend', { method: 'POST', body: { email } })
    },
    async resetPassword(email: string) {
        return request<{ success: boolean }>('/reset-password', { method: 'POST', body: { email } })
    },
    async recoverSession(access_token: string, refresh_token: string) {
        return request<{ session: any; user: any; premiumEndsAt: string | null; preferredCurriculumId: string | null }>('/recover-session', {
            method: 'POST',
            body: { access_token, refresh_token }
        })
    },
    async exchangeCode(code: string) {
        return request<{ session: any; user: any; premiumEndsAt: string | null; preferredCurriculumId: string | null }>('/exchange-code', {
            method: 'POST',
            body: { code }
        })
    },
    async updateUser(attributes: Record<string, any>) {
        return request<{ user: any }>('/update-user', {
            method: 'POST',
            body: { attributes }
        })
    }
}
