// src/queries/useYoutubePlaylists.ts
import {
  listSavedPlaylists,
  fetchAllPlaylistVideoIds,
  fetchVideosDetails,
  prefillFromSupabase,
  savePlaylistBundle,
  type YoutubeVideo,
  type SavedPlaylist,
} from '../api/youtubePlaylists'
import { supabase } from '../lib/supabase'
import { computed, ref } from 'vue'

export const qk = {
  yt: {
    // Strings for refreshNuxtData
    root: 'yt',
    saved: 'yt:saved',
    byPid: (pid: string) => `yt:byPid:${pid}`,
  }
}

/** Kayıtlı playlist özetleri */
export function useSavedPlaylists() {
  const { data, pending, error, refresh } = useAsyncData<SavedPlaylist[]>(
    qk.yt.saved,
    () => listSavedPlaylists(),
    {
       // staleTime equivalent is not directly available, but default deduplication works.
       // placeholderData: (prev) => prev is default behavior in Nuxt if lazy/watch? 
       // For simple use case, default is fine.
    }
  )
  
  return { 
      data, 
      isLoading: pending, 
      error, 
      refetch: refresh 
  }
}

/** YouTube’tan çek + Supabase ile prefill */
export function useFetchPlaylistFromYoutube() {
    // Mutation replacement
    async function mutateAsync(p: { playlistId: string; apiKey?: string }) {
      const key = p.apiKey ?? import.meta.env.VITE_YOUTUBE_API_KEY
      if (!key) throw new Error('YouTube API anahtarı bulunamadı (VITE_YOUTUBE_API_KEY).')
      const ids = await fetchAllPlaylistVideoIds(p.playlistId, key)
      if (!ids.length) return { videos: [] as YoutubeVideo[], prefilled: [] as YoutubeVideo[] }
      const videos = await fetchVideosDetails(ids, key)
      const prefilled = await prefillFromSupabase(p.playlistId, videos)
      return { videos, prefilled }
    }

    return {
        mutateAsync,
        // Compatibility
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false), // Dummy
        isPending: ref(false)
    }
}

/** Kaydet/Upsert */
export function useSavePlaylist() {
  async function mutateAsync(p: {
      playlistId: string
      teacher: string
      curriculumId?: string | null
      sectionId?: number | null
      lessonId?: number | null
      videos: YoutubeVideo[]
    }) {
      const res = await savePlaylistBundle(p)
      refreshNuxtData(qk.yt.saved)
      return res
  }

  return {
    mutateAsync,
    mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
    isLoading: ref(false)
  }
}

/** Var olan bir playlist’i Supabase’ten yükle (prefill için) */
export function useLoadPlaylistFromDb() {
  async function mutateAsync(playlistId: string) {
      // SELECT * FROM playlist_videos WHERE playlist_id=...
      const { data, error } = await supabase
        .from('playlist_videos')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('sort_order', { ascending: true })
        .order('video_id', { ascending: true })
      if (error) throw error
      const list: YoutubeVideo[] = (data ?? []).map((r: any) => ({
        id: String(r.video_id),
        title: String(r.title ?? ''),
        duration: String(r.duration_minutes ?? 0),
        durationMinutes: Number(r.duration_minutes ?? 0),
        url: String(r.url ?? ''),
        topicId: r.topic_uuid ?? undefined,
        code: r.topic_uuid ? String(r.topic_uuid) : '',
        sortOrder: typeof r.sort_order === 'number' ? r.sort_order : null,
      }))
      return list
  }
  
  return {
      mutateAsync,
      mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
      isLoading: ref(false)
  }
}
