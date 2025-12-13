// src/queries/keys.ts (veya kullandığınız ortak dosya)
export const qk = {
    // ==== mevcutlar ====
    profile: (uid: string) => ['profile', uid] as const,
    curricula: ['curricula'] as const,
    sections: (curriculumId: string) => ['sections', curriculumId] as const,
    lessons: (sectionId: string) => ['lessons', sectionId] as const,
    topics: (lessonId: string) => ['topics', lessonId] as const,
    tree: (curriculumId: string) => ['tree', curriculumId] as const,
    lessonTeachers: (curriculumId: string, lessonSignature: string) =>
        ['lessonTeachers', curriculumId, lessonSignature] as const,
    stats: (curriculumId: string) => ['stats', curriculumId] as const,
    topicSearch: (q: string, curriculumId = '', limit = '') =>
        ['topicSearch', q, curriculumId, String(limit)] as const,

    /** Study Sessions */
    studySessions: {
        root: ['studySessions'] as const,
        list: (uid: string, from: string, to: string, limit = '') =>
            ['studySessions', 'list', uid, from, to, limit] as const,
        recent: (uid: string, limit = '') =>
            ['studySessions', 'recent', uid, limit] as const,
        stats: (uid: string, from: string, to: string) =>
            ['studySessions', 'stats', uid, from, to] as const,
        topTopics: (uid: string, from: string, to: string, limit = '') =>
            ['studySessions', 'topTopics', uid, from, to, limit] as const,
    },

    /** Study Plans */
    studyPlan: {
        root: ['studyPlan'] as const,
        byWeek: (uid: string, weekStart: string) =>
            ['studyPlan', 'byWeek', uid, weekStart] as const,
        ensure: (uid: string, weekStart: string) =>
            ['studyPlan', 'ensure', uid, weekStart] as const,
        byPlanId: (planId: string) =>
            ['studyPlan', 'planId', planId] as const,
        topicSeconds: (uid: string, weekStart: string) =>
            ['studyPlan', 'topicSeconds', uid, weekStart] as const,
    },

    /** ==== YENİ: Bildirimler ==== */
    notifications: {
        root: ['notifications'] as const,
        list: (uid: string, limit = '', filter = '') =>
            ['notifications', 'list', uid, String(limit), filter] as const,
        unreadCount: (uid: string) =>
            ['notifications', 'unreadCount', uid] as const,
        detail: (id: string) =>
            ['notifications', 'detail', id] as const,
    },

    /** ==== YENİ: Rozetler ==== */
    badges: {
        catalog: ['badges', 'catalog'] as const,         // tüm rozet tanımları
        user: (uid: string) => ['badges', 'user', uid] as const, // kullanıcının rozetleri
    },

    /** ==== Sprintler ==== */
    sprints: {
        list: (uid: string) => ['sprints', 'list', uid] as const,
    },
}
