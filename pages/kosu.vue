<template>
  <div class="min-h-screen bg-white xl:bg-sky-100 flex flex-col px-0 sm:px-4">
    <header>
      <Navbar />
    </header>

    <main class="flex-grow flex items-start justify-center px-0 py-6 xl:px-4 xl:py-8">
      <div
        class="w-full max-w-6xl bg-white p-4 xl:p-8 space-y-8 rounded-none shadow-none border-0 xl:rounded-3xl xl:border xl:border-sky-100 xl:shadow-2xl xl:shadow-sky-200/60">
        <!-- HERO / MÜFREDAT -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 space-y-6 shadow-sm xl:border-sky-100 xl:bg-sky-50">
          <div class="space-y-3">
            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
              Koşu Planlayıcı
            </p>
            <h1 class="text-3xl md:text-4xl font-bold leading-tight text-slate-800">
              Müfredatını koşulara dönüştür
            </h1>
            <p class="text-sm md:text-base text-slate-600">
              Hedef müfredatı seç, kapsamak istediğin bölümleri işaretle ve günlük
              kapasiteye göre dengeli koşular oluştur.
            </p>
          </div>

          <div class="grid gap-4 md:grid-cols-[2fr,1fr] lg:grid-cols-[3fr,2fr] items-end">
            <div class="space-y-2">
              <span class="text-sm font-medium text-slate-600">Müfredat</span>
              <div
                class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm"
                role="status">
                <template v-if="selectedCurriculum">
                  <div>
                    <p class="text-base font-semibold text-slate-800">
                      {{ selectedCurriculum.exam }}
                    </p>
                    <p class="text-sm text-slate-500">
                      {{ selectedCurriculum.version }}
                    </p>
                  </div>
                  <span class="text-xs text-slate-500">Profilinde kayıtlı</span>
                </template>
                <span v-else-if="state.curriculumId" class="text-sm text-slate-500">
                  Müfredat bilgisi yükleniyor…
                </span>
                <span v-else class="text-sm text-slate-500">
                  Tercih edilen müfredat profilinden seçilmeli.
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- ADIM 1: İÇERİK SEÇİMİ -->
        <section class="space-y-4">
          <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
                Adım 1
              </p>
              <h2 class="text-2xl font-semibold text-slate-800">İçerik Seçimi</h2>
              <p class="text-sm text-slate-600">
                Koşu kapsamına dahil etmek istediğin bölüm, ders ve konuları işaretle.
              </p>
            </div>
            <span class="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {{ state.curriculumId ? "Müfredat hazır" : "Müfredat bekleniyor" }}
            </span>
          </div>

          <div v-if="state.curriculumId" class="grid gap-4 md:grid-cols-3">
            <!-- Bölümler -->
            <article class="h-full space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header class="flex items-center justify-between">
                <div class="font-semibold text-slate-800">Bölümler</div>
                <span class="text-xs text-slate-500">{{ sectionList.length }} adet</span>
              </header>
              <div class="max-h-64 overflow-y-auto pr-1 space-y-2">
                <label v-for="(s, idx) in sectionList" :key="s?.id ?? `sec-${idx}`"
                  class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50">
                  <input type="checkbox" :value="s?.id" v-model="state.sectionIds" :disabled="!s"
                    class="accent-sky-500" />
                  <span class="truncate">{{ s?.code }} — {{ s?.name }}</span>
                </label>
              </div>
            </article>

            <!-- Dersler -->
            <article class="h-full space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header class="font-semibold text-slate-800">Dersler</header>
              <div class="max-h-64 overflow-y-auto pr-1 space-y-2">
                <template v-for="(s, sidx) in sectionList" :key="`sec-les-${s?.id ?? sidx}`">
                  <details v-if="s"
                    class="group rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-sky-300">
                    <summary
                      class="cursor-pointer text-sm text-slate-700 font-medium flex items-center justify-between">
                      <span>{{ s.code }} — {{ s.name }}</span>
                      <span class="text-xs text-slate-500 group-open:text-sky-600">Göster</span>
                    </summary>
                    <div class="pl-3 mt-2 space-y-1">
                      <label v-for="(l, lidx) in getLessons(s.id)" :key="l?.id ?? `les-${lidx}`"
                        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50">
                        <input type="checkbox" :value="l?.id" v-model="state.lessonIds" :disabled="!l"
                          class="accent-sky-500" />
                        <span class="truncate">{{ l?.code }} — {{ l?.name }}</span>
                      </label>
                    </div>
                  </details>
                </template>
              </div>
            </article>

            <!-- Konular -->
            <article class="h-full space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header class="font-semibold text-slate-800">Konular</header>
              <div class="max-h-64 overflow-y-auto pr-1 space-y-2">
                <template v-for="(s, sidx) in sectionList" :key="`sec-top-${s?.id ?? sidx}`">
                  <details v-if="s"
                    class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-sky-300">
                    <summary class="cursor-pointer text-sm text-slate-700 font-medium">
                      {{ s.code }} — {{ s.name }}
                    </summary>
                    <div class="pl-3 mt-2 space-y-1">
                      <template v-for="(l, lidx) in getLessons(s.id)" :key="`les-top-${l?.id ?? lidx}`">
                        <details v-if="l"
                          class="rounded-2xl border border-slate-200 bg-white px-3 py-2 transition hover:border-sky-300">
                          <summary class="cursor-pointer text-xs text-slate-600 font-semibold">
                            {{ l.code }} — {{ l.name }}
                          </summary>
                          <div class="pl-2 mt-2 space-y-1">
                            <label v-for="(t, tidx) in getTopics(l.id)" :key="t?.uuid ?? t?.id ?? `t-${tidx}`"
                              class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50">
                              <input type="checkbox" :value="t?.uuid" v-model="state.topicIds" :disabled="!t"
                                class="accent-sky-500" />
                              <span class="truncate">{{ t?.title }}</span>
                            </label>
                          </div>
                        </details>
                      </template>
                    </div>
                  </details>
                </template>
              </div>
            </article>
          </div>

          <!-- Öğretmen Seçimi -->
          <div v-if="state.curriculumId"
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="font-semibold text-slate-800">Öğretmen Seçimi</p>
                <p class="text-xs text-slate-600">
                  Seçilen dersler için kaydedilmiş öğretmenleri belirle. Toplam süre hesabı öğretmen seçimi
                  tamamlandığında yapılır.
                </p>
              </div>
              <span class="text-xs text-slate-500" v-if="teacherOptionsLoading">Öğretmenler yükleniyor…</span>
            </div>

            <div v-if="selectedLessonDetails.length" class="space-y-2">
              <div v-for="lesson in selectedLessonDetails" :key="lesson.id"
                class="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 shadow-sm md:flex-row md:items-center md:justify-between">
                <div class="text-sm text-slate-700">
                  <p class="font-semibold">{{ lesson.code }} — {{ lesson.name }}</p>
                  <p class="text-[11px] text-slate-500" v-if="sectionMap.get(lesson.section_id ?? -1)">
                    {{ sectionMap.get(lesson.section_id ?? -1)?.code }} — {{ sectionMap.get(lesson.section_id ?? -1)?.name }}
                  </p>
                </div>
                <div class="flex flex-col gap-1 text-sm text-slate-600 md:w-64">
                  <select v-model="teacherSelections[lesson.id]"
                    class="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400"
                    :disabled="teacherOptionsLoading || !getTeachersForLesson(lesson.id).length">
                    <option disabled value="">Öğretmen seç</option>
                    <option v-for="teacher in getTeachersForLesson(lesson.id)" :key="teacher" :value="teacher">
                      {{ teacher }}
                    </option>
                  </select>
                  <p class="text-[11px] text-slate-500" v-if="getTeachersForLesson(lesson.id).length">
                    Seçilen öğretmenin videoları kullanılacak.
                  </p>
                  <p class="text-[11px] text-slate-500" v-else>
                    Kayıtlı öğretmen bulunamadı, tüm videolar kullanılacak.
                  </p>
                  <p v-if="lessonNeedsTeacher(lesson.id)" class="text-[11px] text-rose-600">
                    Öğretmen seçmeden süre hesaplanmaz.
                  </p>
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-slate-500">
              Ders seçtiğinde öğretmenler burada görünecek.
            </div>
          </div>

          <div v-else
            class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Müfredat seçildiğinde bölüm, ders ve konu listeleri burada görünecek.
          </div>

          <!-- Toplam süre özeti -->
          <div v-if="
            selectionSummary.isLoading ||
            selectionSummary.topicCount ||
            selectionSummary.error
          "
            class="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 shadow-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
                Toplam Video Süresi
              </p>
              <p class="text-lg font-semibold text-slate-800">
                <span v-if="selectionSummary.isLoading">Hesaplanıyor…</span>
                <span v-else-if="selectionSummary.totalMinutes">
                  {{ formatDuration(selectionSummary.totalMinutes) }}
                </span>
                <span v-else>Seçim yapıldığında hesaplanır</span>
              </p>
              <p class="text-xs text-slate-500">
                {{ selectionSummary.videoCount }} video •
                {{ selectionSummary.topicCount }} konu
              </p>
              <p v-if="selectionSummary.error" class="text-xs text-rose-600 mt-1">
                {{ selectionSummary.error }}
              </p>
            </div>
          </div>
        </section>

        <!-- ADIM 2: TEMPO & HEDEF -->
        <section class="rounded-2xl border border-sky-100 bg-sky-50 p-6 space-y-6 shadow-sm">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
              Adım 2
            </p>
            <h2 class="text-2xl font-semibold text-slate-800">Tempo &amp; Hedef</h2>
            <p class="text-sm text-slate-600">
              Günlük kapasiteni saat cinsinden gir veya kaç günde bitirmek istediğini
              belirt.
            </p>
          </div>

          <!-- Mod seçici (tam genişlik) -->
          <div class="flex w-full rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" @click="pacingMode = 'daily'" :class="[
              'flex-1 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition text-center',
              pacingMode === 'daily'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            ]">
              Günlük Sürem Belli
            </button>
            <button type="button" @click="pacingMode = 'deadline'" :class="[
              'flex-1 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition text-center',
              pacingMode === 'deadline'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            ]">
              Bitiş Gününü Belirle
            </button>
          </div>

          <!-- Günlük süre modu -->
          <div v-if="pacingMode === 'daily'" class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1 text-sm font-medium text-slate-600">
              Günde Ayırabileceğin Süre (saat)
              <input type="number" min="0.25" step="0.25" v-model.number="dailyHours"
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <span class="text-xs text-slate-500">0.25 saat = 15 dakika</span>
            </label>

            <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-1">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Hedef
              </p>
              <p class="text-base font-semibold text-slate-800" v-if="finishInDays">
                {{ finishInDays }} günde tamamlayabilirsin.
              </p>
              <p class="text-base font-semibold text-slate-800" v-else>
                Seçtiğin videoların süresi hesaplandığında gösterilir.
              </p>
              <p class="text-xs text-slate-500">
                Plan günlük süresi: {{ formatDuration(state.dailyMinutes) }}
              </p>
            </div>
          </div>

          <!-- Deadline modu -->
          <div v-else class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1 text-sm font-medium text-slate-600">
              Kaç günde bitirmek istiyorsun?
              <input type="number" min="1" step="1" v-model.number="deadlineDays"
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <span class="text-xs text-slate-500">
                Seçtiğin toplam süreye göre hesaplanır.
              </span>
            </label>

            <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-1">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Günlük Gereken Süre
              </p>
              <p class="text-base font-semibold text-slate-800" v-if="requiredDailyHours">
                {{ requiredDailyHours.toFixed(1) }} saat
                ({{ formatDuration(state.dailyMinutes) }})
              </p>
              <p class="text-base font-semibold text-slate-800" v-else>
                Seçim tamamlandığında gösterilir.
              </p>
              <p class="text-xs text-slate-500">
                Bu süreyi koşu planına otomatik işleriz.
              </p>
            </div>
          </div>
        </section>

        <!-- ADIM 3: KOŞU AYARLARI -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-sm">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
              Adım 3
            </p>
            <h2 class="text-2xl font-semibold text-slate-800">Koşu Ayarları</h2>
            <p class="text-sm text-slate-600">
              Hedefine göre başlangıç tarihini seç, günlük süreni derslerine paylaştır ve
              koşuyu oluştur.
            </p>
          </div>

          <!-- Özet kart -->
          <div
            class="rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {{ pacingMode === "daily" ? "Tahmini Süre" : "Günlük Süre" }}
              </p>
              <template v-if="pacingMode === 'daily'">
                <p class="text-sm font-semibold text-slate-800" v-if="finishInDays">
                  Günde {{ dailyHours || 0 }} saat ile ~{{ finishInDays }} günde bitecek.
                </p>
                <p class="text-sm font-semibold text-slate-800" v-else>
                  Seçim yapıldığında süre hesaplanır.
                </p>
              </template>
              <template v-else>
                <p class="text-sm font-semibold text-slate-800" v-if="requiredDailyHours">
                  {{ deadlineDays || 0 }} günde bitirmek için günde
                  {{ requiredDailyHours.toFixed(1) }} saat çalışman gerek.
                </p>
                <p class="text-sm font-semibold text-slate-800" v-else>
                  Seçim yapıldığında süre hesaplanır.
                </p>
              </template>
            </div>
            <p class="text-xs text-slate-500">
              Planlanacak günlük süre: {{ formatDuration(state.dailyMinutes) }}
            </p>
          </div>

          <!-- Başlangıç tarihi -->
          <div class="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            <label class="space-y-1 text-sm font-medium text-slate-600">
              Başlangıç Tarihi
              <input type="date" v-model="state.startDateISO"
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </label>
          </div>

          <!-- Ders bazlı dağılım -->
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800">
                  Ders Bazlı Günlük Süre
                </p>
                <p class="text-xs text-slate-600">
                  Günde {{ (state.dailyMinutes / 60).toFixed(2) }} saatlik süreyi
                  seçtiğin derslere dağıt.
                </p>
              </div>
              <button type="button"
                class="text-xs font-semibold text-sky-600 disabled:text-slate-400 disabled:cursor-not-allowed"
                :disabled="!lessonDistributions.length" @click="rebalanceLessonAllocations">
                Eşit Dağıt
              </button>
            </div>

            <div v-if="lessonDistributions.length" class="space-y-3 max-h-72 overflow-y-auto pr-1">
              <div v-for="row in lessonDistributions" :key="row.lesson.id"
                class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid md:grid-cols-[2fr,1fr] md:items-start md:gap-4">
                <div>
                  <p class="font-semibold text-slate-800">
                    {{ row.lesson.code }} — {{ row.lesson.name }}
                  </p>
                  <p class="text-xs text-slate-500" v-if="row.sectionLabel">
                    {{ row.sectionLabel }}
                  </p>
                  <p class="text-[11px] text-slate-500 mt-1">
                    Öğretmen:
                    <span class="font-semibold" v-if="teacherSelections[row.lesson.id]">{{ teacherSelections[row.lesson.id] }}</span>
                    <span v-else>—</span>
                  </p>
                </div>
                <div class="flex flex-col gap-1 text-sm text-slate-600 md:w-64">
                  <label class="text-xs font-medium text-slate-500">Günlük süre (saat)</label>
                  <div class="flex items-center gap-2">
                    <input type="number" min="0.25" step="0.25" :value="(row.minutes || 0) / 60"
                      @input="handleAllocationInput(row.lesson.id, $event)"
                      class="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400" />
                    <span class="text-xs text-slate-500 whitespace-nowrap">
                      {{ formatDuration(row.minutes) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
              Ders seçtiğinde günlük süre dağılımı burada görünecek.
            </div>

            <div class="text-xs" :class="allocationIsBalanced ? 'text-emerald-600' : 'text-rose-500'">
              <p>
                Dağıtılan: {{ (allocationTotalMinutes / 60).toFixed(2) }} sa • Hedef:
                {{ (state.dailyMinutes / 60).toFixed(2) }} sa
              </p>
              <p v-if="!allocationIsBalanced">
                <span v-if="allocationDiffMinutes > 0">
                  {{ formatDuration(allocationDiffMinutes) }} daha paylaştır.
                </span>
                <span v-else>
                  {{ formatDuration(Math.abs(allocationDiffMinutes)) }} azalt.
                </span>
              </p>
            </div>
          </div>
        </section>

        <!-- CTA / OLUŞTUR -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-2xl font-semibold text-slate-800">Koşuyu Oluştur</h2>
              <p class="text-sm text-slate-600">
                Seçimlerinden emin olduğunda aşağıdaki tuşla planı oluşturabilirsin.
              </p>
            </div>
          </div>

          <div
            v-if="!isPremiumActive"
            class="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 md:flex-row md:items-center md:justify-between"
          >
            <p class="text-sm font-semibold">
              Koşu oluşturma premium üyeler için açık. Premium'a geçerek planlarını kaydedebilirsin.
            </p>
            <RouterLink
              to="/profil"
              class="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              Premium'a geç
            </RouterLink>
          </div>

          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button :disabled="isSubmitDisabled" @click="onCreate"
              class="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-2.5 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60">
              {{ createButtonText }}
            </button>

            <div class="text-sm space-y-1">
              <span v-if="errorMsg" class="block text-rose-600">{{ errorMsg }}</span>
              <span v-if="successMsg" class="block text-emerald-600">
                {{ successMsg }}
              </span>
            </div>
          </div>

          <p class="text-xs text-slate-500">
            Videolar, başlangıç tarihinden itibaren günlük limitlere uyarak gerektiği
            kadar haftaya yayılır.
          </p>
        </section>

        <!-- Oluşturulan Koşular -->
        <section class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-2xl font-semibold text-slate-800">Oluşturulan Koşular</h2>
              <p class="text-sm text-slate-600">
                Koşu Planlayıcı ile oluşturduğun planları burada görüntüleyebilirsin.
              </p>
            </div>
            <span v-if="sprintList.length"
              class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {{ sprintList.length }} adet
            </span>
          </div>

          <div v-if="sprintsLoading" class="text-sm text-slate-500">
            Koşular yükleniyor…
          </div>
          <div v-else-if="sprintListError" class="text-sm text-rose-600">
            {{ sprintListError }}
          </div>
          <div v-else-if="!sprintList.length" class="text-sm text-slate-500">
            Henüz koşu oluşturulmadı. Yeni bir koşu planladığında burada gözükecek.
          </div>
          <ul v-else class="space-y-3">
            <li v-for="sprint in sprintList" :key="sprint.id"
              class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div class="space-y-1">
                <p class="text-base font-semibold text-slate-800">{{ sprint.title }}</p>
                <p class="text-xs text-slate-500">
                  Başlangıç: {{ formatDate(sprint.cadence.start_date || sprint.created_at) }} •
                  Günlük süre:
                  <span v-if="sprint.cadence.daily_minutes">
                    {{ formatDuration(sprint.cadence.daily_minutes) }}
                  </span>
                  <span v-else>—</span>
                  • {{ sprint.scopeCounts.topics }} konu
                </p>
              </div>
              <button type="button"
                class="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isDeletingSprint && deletingSprintId === sprint.id"
                @click="confirmSprintDeletion(sprint.id)">
                {{
                  isDeletingSprint && deletingSprintId === sprint.id ? "Siliniyor…" : "Sil"
                }}
              </button>
            </li>
          </ul>

          <p v-if="deleteSprintError" class="text-sm text-rose-600">
            {{ deleteSprintError }}
          </p>
        </section>
      </div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { reactive, computed, watch, ref } from "vue";
import { useToast } from "vue-toastification";
import Navbar from "../components/Navbar.vue";
import { useAuthStore } from "../stores/auth.store";
import { useCurricula, useSections } from "../queries/useCurricula";
import {
  CurriculumAPI,
  type Curriculum,
  type Section,
  type Lesson,
  type Topic,
} from "../api/curriculum";
import { useGenerateSprint, useUserSprints, useDeleteSprint } from "../queries/useSprints";
import { SprintsAPI, type LessonTeacherMap } from "../api/sprints";
import { useLessonTeachers } from "../queries/useLessonTeachers";
import type { LessonTeacher } from "../api/youtubePlaylists";

/* ========== STATE ========== */
const auth = useAuthStore();
const toast = useToast();

const isPremiumActive = computed(() => auth.isPremiumActive);

type PlannerState = {
  curriculumId: string;
  sectionIds: number[];
  lessonIds: number[];
  topicIds: string[];
  startDateISO: string;
  dailyMinutes: number;
};

type SelectionSummaryState = {
  isLoading: boolean;
  totalMinutes: number;
  topicCount: number;
  videoCount: number;
  error: string;
};

type SelectionPayload = {
  curriculumId: string;
  sectionIds: number[];
  lessonIds: number[];
  topicIds: string[];
   lessonTeacherMap: LessonTeacherMap;
};

const state = reactive<PlannerState>({
  curriculumId: (auth.preferredCurriculumId ?? "") as string,
  sectionIds: [] as number[],
  lessonIds: [] as number[],
  topicIds: [] as string[],
  startDateISO: new Date().toISOString().slice(0, 10),
  dailyMinutes: 90,
});

const pacingMode = ref<"daily" | "deadline">("daily");
const dailyHours = ref(Number((state.dailyMinutes || 0) / 60) || 1.5);
const deadlineDays = ref(14);

const selectionSummary = reactive<SelectionSummaryState>({
  isLoading: false,
  totalMinutes: 0,
  topicCount: 0,
  videoCount: 0,
  error: "",
});

/** Queries */
const curricula = useCurricula();
const sections = useSections(() => state.curriculumId || null);

/* ... */

const uid = computed(() => auth.userId);

watch(
  () => auth.preferredCurriculumId,
  (val) => {
    if (!state.curriculumId && val) {
      state.curriculumId = val;
    }
  },
  { immediate: true }
);

/** Güvenli computed listeler */
const curriculumList = computed<Curriculum[]>(() => curricula.data.value ?? []);
const sectionList = computed<Section[]>(() => sections.data.value ?? []);
const selectedCurriculum = computed<Curriculum | null>(() => {
  if (!state.curriculumId) return null;
  return curriculumList.value.find((c) => c.id === state.curriculumId) ?? null;
});

/** Hierarşi cache */
const lessonMap = ref<Map<number, Lesson[]>>(new Map());
const topicMap = ref<Map<number, Topic[]>>(new Map());

let loadToken = 0;
watch(
  () => state.curriculumId,
  async (cid) => {
    state.sectionIds = [];
    state.lessonIds = [];
    state.topicIds = [];
    lessonMap.value = new Map();
    topicMap.value = new Map();
    if (!cid) return;

    // yarış koşullarına karşı token
    const token = ++loadToken;
    // sections query zaten fetchliyor; buradan derinleri doldur
    // bekle ki sections.data gelsin
    // küçük polling: 10 kez dene
    for (let i = 0; i < 10; i++) {
      if (sectionList.value.length) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (token !== loadToken) return;

    const secArr = sectionList.value;
    for (const s of secArr) {
      if (!s?.id) continue;
      const ls = await CurriculumAPI.fetchLessonsBySectionId(s.id);
      if (token !== loadToken) return;
      lessonMap.value.set(s.id, ls);
      for (const l of ls) {
        const ts = await CurriculumAPI.fetchTopicsByLessonId(l.id);
        if (token !== loadToken) return;
        topicMap.value.set(l.id, ts);
      }
    }
  },
  { immediate: true }
);

/** Güvenli getter’lar */
const getLessons = (sectionId: number) => lessonMap.value.get(sectionId) ?? [];
const getTopics = (lessonId: number) => topicMap.value.get(lessonId) ?? [];

const allLessonsMap = computed<Map<number, Lesson>>(() => {
  const map = new Map<number, Lesson>();
  for (const lessons of lessonMap.value.values()) {
    for (const lesson of lessons) {
      if (lesson?.id) {
        map.set(lesson.id, lesson);
      }
    }
  }
  return map;
});

const selectedLessonDetails = computed<Lesson[]>(() => {
  const collected = new Map<number, Lesson>();
  const allLessons = allLessonsMap.value;

  for (const lessonId of state.lessonIds) {
    const lesson = allLessons.get(lessonId);
    if (lesson) collected.set(lesson.id, lesson);
  }

  for (const sectionId of state.sectionIds) {
    const lessons = getLessons(sectionId);
    for (const lesson of lessons) {
      if (lesson?.id) {
        collected.set(lesson.id, lesson);
      }
    }
  }

  if (state.topicIds.length) {
    const topicSet = new Set(state.topicIds);
    for (const [lessonId, topics] of topicMap.value.entries()) {
      if (topics.some((t) => topicSet.has(t.uuid))) {
        const lesson = allLessons.get(lessonId);
        if (lesson) collected.set(lesson.id, lesson);
      }
    }
  }

  return [...collected.values()].sort(
    (a, b) =>
      (a.section_id ?? 0) - (b.section_id ?? 0) ||
      (a.code ?? "").localeCompare(b.code ?? "")
  );
});

const sectionMap = computed<Map<number, Section>>(() => {
  const map = new Map<number, Section>();
  for (const section of sectionList.value) {
    if (section?.id) {
      map.set(section.id, section);
    }
  }
  return map;
});

const teacherSelections = reactive<Record<number, string>>({});
const lessonTeacherQuery = useLessonTeachers(
  () => state.curriculumId || null,
  computed(() => selectedLessonDetails.value.map((lesson) => lesson.id))
);
const teacherOptionsLoading = computed(
  () =>
    Boolean(
      lessonTeacherQuery.isLoading?.value || lessonTeacherQuery.isFetching?.value
    )
);
const lessonTeacherOptions = computed<LessonTeacher[]>(
  () => lessonTeacherQuery.data?.value ?? []
);
const teacherOptionsByLesson = computed<Map<number, string[]>>(() => {
  const map = new Map<number, string[]>();
  for (const row of lessonTeacherOptions.value) {
    if (!row?.lessonId || !row.teacher) continue;
    const arr = map.get(row.lessonId) ?? [];
    const option = row.teacher.trim();
    if (!option) continue;
    if (!arr.includes(option)) {
      arr.push(option);
    }
    map.set(
      row.lessonId,
      arr.sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }))
    );
  }
  return map;
});

function getTeachersForLesson(lessonId: number) {
  return teacherOptionsByLesson.value.get(lessonId) ?? [];
}

function lessonNeedsTeacher(lessonId: number) {
  const options = getTeachersForLesson(lessonId);
  if (!options.length) return false;
  const picked = (teacherSelections[lessonId] ?? "").trim();
  return !picked;
}

watch(
  [selectedLessonDetails, teacherOptionsByLesson],
  ([lessons]) => {
    const validIds = new Set(lessons.map((lesson) => lesson.id));
    for (const key of Object.keys(teacherSelections)) {
      const id = Number(key);
      if (!validIds.has(id)) {
        delete teacherSelections[id];
      }
    }
    for (const lesson of lessons) {
      const options = getTeachersForLesson(lesson.id);
      const current = (teacherSelections[lesson.id] ?? "").trim();
      if (!current && options.length === 1) {
        teacherSelections[lesson.id] = options[0] ?? "";
      } else if (current && options.length && !options.includes(current)) {
        teacherSelections[lesson.id] = options[0] ?? "";
      }
    }
  },
  { immediate: true }
);

const lessonAllocations = reactive<Record<number, number>>({});
const allocationsTouched = ref(false);

const lessonDistributions = computed(() =>
  selectedLessonDetails.value.map((lesson) => {
    const section = lesson.section_id ? sectionMap.value.get(lesson.section_id) : null;
    const sectionLabel = section ? `${section.code} — ${section.name}` : "";
    return {
      lesson,
      sectionLabel,
      minutes: lessonAllocations[lesson.id] ?? 0,
    };
  })
);

const lessonTeacherMapPayload = computed<LessonTeacherMap>(() => {
  const payload: LessonTeacherMap = {};
  for (const lesson of selectedLessonDetails.value) {
    const teacher = (teacherSelections[lesson.id] ?? "").trim();
    if (teacher) {
      payload[lesson.id] = teacher;
    }
  }
  return payload;
});

const missingTeacherLessons = computed(() =>
  selectedLessonDetails.value.filter((lesson) => lessonNeedsTeacher(lesson.id))
);
const teachersReady = computed(() => missingTeacherLessons.value.length === 0);

const selectionPayload = computed<SelectionPayload>(() => ({
  curriculumId: state.curriculumId || "",
  sectionIds: [...state.sectionIds],
  lessonIds: [...state.lessonIds],
  topicIds: [...state.topicIds],
  lessonTeacherMap: { ...lessonTeacherMapPayload.value },
}));

let summaryToken = 0;
watch(
  selectionPayload,
  async (payload) => {
    const hasSelection =
      payload.curriculumId &&
      (payload.sectionIds.length || payload.lessonIds.length || payload.topicIds.length);
    const needsTeacher = missingTeacherLessons.value.length > 0;
    if (!hasSelection || needsTeacher) {
      summaryToken++;
      selectionSummary.isLoading = false;
      selectionSummary.totalMinutes = 0;
      selectionSummary.topicCount = 0;
      selectionSummary.videoCount = 0;
      selectionSummary.error = needsTeacher
        ? "Öğretmen seçimi tamamlanmadan süre hesaplanamaz."
        : "";
      return;
    }
    selectionSummary.isLoading = true;
    selectionSummary.error = "";
    const token = ++summaryToken;
    try {
      const res = await SprintsAPI.estimateSelection(payload);
      if (token !== summaryToken) return;
      selectionSummary.totalMinutes = res.totalMinutes;
      selectionSummary.topicCount = res.topicCount;
      selectionSummary.videoCount = res.videoCount;
    } catch (err) {
      if (token !== summaryToken) return;
      selectionSummary.totalMinutes = 0;
      selectionSummary.topicCount = 0;
      selectionSummary.videoCount = 0;
      selectionSummary.error =
        (err as Error)?.message ?? "Toplam süre hesaplanırken bir hata oluştu.";
    } finally {
      if (token === summaryToken) {
        selectionSummary.isLoading = false;
      }
    }
  },
  { immediate: true }
);

const totalVideoMinutes = computed(() => selectionSummary.totalMinutes);

const manualDailyMinutes = computed(() => {
  const hours = Number(dailyHours.value);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.max(0, Math.round(hours * 60));
});

const deadlineDayCount = computed(() => {
  const raw = Number(deadlineDays.value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.max(1, Math.round(raw));
});

const deadlineDailyMinutes = computed(() => {
  if (!totalVideoMinutes.value) return 0;
  const days = deadlineDayCount.value;
  if (!days) return 0;
  return Math.ceil(totalVideoMinutes.value / days);
});

const finishInDays = computed(() => {
  if (!totalVideoMinutes.value) return 0;
  const perDay = manualDailyMinutes.value;
  if (!perDay) return 0;
  return Math.max(1, Math.ceil(totalVideoMinutes.value / perDay));
});

const requiredDailyHours = computed(() => {
  if (!totalVideoMinutes.value) return 0;
  const days = deadlineDayCount.value;
  if (!days) return 0;
  return totalVideoMinutes.value / 60 / days;
});

watch(
  [pacingMode, () => manualDailyMinutes.value, () => deadlineDailyMinutes.value],
  ([mode, manual, deadlineVal]) => {
    const next = mode === "daily" ? manual : deadlineVal;
    state.dailyMinutes = Math.max(0, Math.round(next));
  },
  { immediate: true }
);

const allocationTotalMinutes = computed(() =>
  selectedLessonDetails.value.reduce(
    (sum, lesson) => sum + (lessonAllocations[lesson.id] ?? 0),
    0
  )
);
const allocationDiffMinutes = computed(
  () => state.dailyMinutes - allocationTotalMinutes.value
);
const allocationIsBalanced = computed(
  () => !selectedLessonDetails.value.length || Math.abs(allocationDiffMinutes.value) <= 1
);
const hasZeroAllocations = computed(() =>
  selectedLessonDetails.value.some((lesson) => (lessonAllocations[lesson.id] ?? 0) <= 0)
);

const lessonAllocationMinutesPayload = computed<Record<number, number>>(() => {
  const payload: Record<number, number> = {};
  for (const lesson of selectedLessonDetails.value) {
    const minutes = Math.max(0, Math.round(lessonAllocations[lesson.id] ?? 0));
    if (minutes > 0) {
      payload[lesson.id] = minutes;
    }
  }
  return payload;
});

let lastLessonSignature: string | null = null;
watch(
  selectedLessonDetails,
  (lessons) => {
    const ids = lessons.map((l) => l.id).sort((a, b) => a - b);
    const currentSignature = ids.join("-");
    if (currentSignature === lastLessonSignature) return;
    lastLessonSignature = currentSignature;
    syncAllocationsWithLessons(lessons);
  },
  { immediate: true }
);

watch(
  () => state.dailyMinutes,
  (next, prev) => {
    const lessons = selectedLessonDetails.value;
    if (!lessons.length) return;
    if (!prev || !allocationsTouched.value) {
      distributeAllocationsEvenly(lessons, next);
      return;
    }
    scaleAllocationsToTotal(lessons, next);
  }
);

/** Submit durumu */
const canSubmit = computed(() => {
  const picked =
    state.sectionIds.length || state.lessonIds.length || state.topicIds.length;
  const lessonsReady =
    selectedLessonDetails.value.length &&
    !hasZeroAllocations.value &&
    allocationIsBalanced.value;
  return (
    Boolean(auth.user?.id) &&
    Boolean(state.curriculumId) &&
    picked &&
    state.dailyMinutes > 0 &&
    lessonsReady &&
    teachersReady.value
  );
});

const mutation = useGenerateSprint();
const userSprintsQuery = useUserSprints(() => auth.userId);
const deleteSprint = useDeleteSprint(() => auth.userId);
const isSubmitDisabled = computed(
  () => !canSubmit.value || Boolean(mutation.isPending.value)
);
const createStatus = ref<"idle" | "creating" | "success">("idle");
let createButtonReset: any = null;
const createButtonText = computed(() => {
  if (createStatus.value === "creating" || mutation.isPending.value) {
    return "Oluşturuluyor…";
  }
  if (createStatus.value === "success") return "Oluşturuldu";
  return "Koşu Oluştur";
});
const errorMsg = computed(() => mutation.error.value?.message ?? "");
const successMsg = computed(() => {
  const weeks = mutation.data.value?.created_plan_week_starts ?? [];
  return weeks.length
    ? `Sprint oluşturuldu. Etkilenen haftalar: ${weeks.join(", ")}`
    : "";
});
const sprintList = computed(() => userSprintsQuery.data.value ?? []);
const sprintsLoading = computed(
  () => Boolean(userSprintsQuery.isLoading.value || userSprintsQuery.isFetching.value)
);
const sprintListError = computed(() => userSprintsQuery.error.value?.message ?? "");
const deleteSprintError = computed(() => deleteSprint.error.value?.message ?? "");
const isDeletingSprint = computed(() => Boolean(deleteSprint.isPending.value));
const deletingSprintId = computed(() => deleteSprint.variables?.value ?? null);

function syncAllocationsWithLessons(lessons: Lesson[]) {
  const validIds = new Set(lessons.map((lesson) => lesson.id));
  for (const key of Object.keys(lessonAllocations)) {
    const id = Number(key);
    if (!validIds.has(id)) {
      delete lessonAllocations[id];
    }
  }
  if (!lessons.length) {
    allocationsTouched.value = false;
    return;
  }
  allocationsTouched.value = false;
  distributeAllocationsEvenly(lessons, state.dailyMinutes);
}

function distributeAllocationsEvenly(lessons: Lesson[], totalMinutes: number) {
  if (!lessons.length) return;
  const normalizedTotal = Math.max(0, Math.round(totalMinutes));
  const count = lessons.length;
  const base = count ? Math.floor(normalizedTotal / count) : 0;
  let remainder = normalizedTotal - base * count;
  for (const lesson of lessons) {
    const extra = remainder > 0 ? 1 : 0;
    updateLessonAllocationMinutes(lesson.id, base + extra);
    if (extra) remainder -= 1;
  }
  adjustAllocationRemainder(lessons, remainder);
}

function scaleAllocationsToTotal(lessons: Lesson[], targetTotal: number) {
  if (!lessons.length) return;
  const normalizedTotal = Math.max(0, Math.round(targetTotal));
  const currentTotal = lessons.reduce(
    (sum, lesson) => sum + (lessonAllocations[lesson.id] ?? 0),
    0
  );
  if (!currentTotal) {
    distributeAllocationsEvenly(lessons, normalizedTotal);
    return;
  }
  const ratio = normalizedTotal / currentTotal;
  let remainder = normalizedTotal;
  for (const lesson of lessons) {
    const prev = lessonAllocations[lesson.id] ?? 0;
    const scaled = Math.max(0, Math.round(prev * ratio));
    updateLessonAllocationMinutes(lesson.id, scaled);
    remainder -= scaled;
  }
  adjustAllocationRemainder(lessons, remainder);
}

function adjustAllocationRemainder(lessons: Lesson[], remainder: number) {
  if (!lessons.length) return;
  const ids = lessons.map((lesson) => Number(lesson.id));
  let idx = 0;
  const limit = ids.length * 3;
  while (remainder !== 0 && idx < limit) {
    const direction = remainder > 0 ? 1 : -1;
    const id = ids[idx % ids.length]!;
    const current = lessonAllocations[id] ?? 0;
    if (direction < 0 && current === 0) {
      idx += 1;
      continue;
    }
    lessonAllocations[id] = current + direction;
    remainder -= direction;
    idx += 1;
  }
}

function updateLessonAllocationMinutes(
  lessonId: number,
  minutes: number,
  opts: { markTouched?: boolean } = {}
) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  lessonAllocations[lessonId] = safeMinutes;
  if (opts.markTouched) {
    allocationsTouched.value = true;
  }
}

function handleAllocationInput(lessonId: number, event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  const hours = Number(target.value);
  if (!Number.isFinite(hours)) return;
  const minutes = Math.max(0, Math.round(hours * 60));
  updateLessonAllocationMinutes(lessonId, minutes, { markTouched: true });
}

function rebalanceLessonAllocations() {
  const lessons = selectedLessonDetails.value;
  if (!lessons.length) return;
  allocationsTouched.value = false;
  distributeAllocationsEvenly(lessons, state.dailyMinutes);
}

function setCreateStatus(status: "idle" | "creating" | "success") {
  if (createButtonReset) {
    clearTimeout(createButtonReset);
    createButtonReset = null;
  }
  createStatus.value = status;
  if (status === "success") {
    createButtonReset = window.setTimeout(() => {
      createStatus.value = "idle";
      createButtonReset = null;
    }, 2000);
  }
}

async function onCreate() {
  if (!auth.userId) return;
  if (!auth.isPremiumActive) {
    toast.warning("Koşu oluşturmak için lütfen premium kullanıcısı olunuz.");
    return;
  }
  setCreateStatus("creating");
  mutation.reset();
  try {
    await mutation.mutateAsync({
      userId: auth.userId,
      title: `Sprint • ${new Date().toLocaleDateString()}`,
      startDateISO: state.startDateISO,
      dailyMinutes: state.dailyMinutes,
      lessonDailyMinutes: lessonAllocationMinutesPayload.value,
      selection: {
        curriculumId: state.curriculumId,
        sectionIds: state.sectionIds,
        lessonIds: state.lessonIds,
        topicIds: state.topicIds,
        lessonTeacherMap: lessonTeacherMapPayload.value,
      },
    });
    await userSprintsQuery.refetch();
    setCreateStatus("success");
  } catch (err) {
    setCreateStatus("idle");
    throw err;
  }
}

async function confirmSprintDeletion(sprintId: string) {
  if (!sprintId) return;
  if (
    !window.confirm(
      "Bu koşuyu silersen Koşu Planlayıcı tarafından oluşturulan tüm plan verileri silinecek. Devam etmek istiyor musun?"
    )
  ) {
    return;
  }
  await deleteSprint.mutateAsync(sprintId);
}

function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours} sa ${mins} dk`;
  if (hours) return `${hours} sa`;
  return `${mins} dk`;
}

function formatDate(isoString?: string | null) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
</script>
