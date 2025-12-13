// src/queries/useYoutubePlaylists.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
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

export const qk = {
  yt: {
    root: ['yt'] as const,
    saved: ['yt', 'saved'] as const,
    byPid: (pid: string) => ['yt', 'byPid', pid] as const,
  }
}

/** Kayıtlı playlist özetleri */
export function useSavedPlaylists() {
  return useQuery<SavedPlaylist[]>({
    queryKey: qk.yt.saved,
    queryFn: () => listSavedPlaylists(),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}

/** YouTube’tan çek + Supabase ile prefill */
export function useFetchPlaylistFromYoutube() {
  return useMutation({
    mutationFn: async (p: { playlistId: string; apiKey?: string }) => {
      const key = p.apiKey ?? import.meta.env.VITE_YOUTUBE_API_KEY
      if (!key) throw new Error('YouTube API anahtarı bulunamadı (VITE_YOUTUBE_API_KEY).')
      const ids = await fetchAllPlaylistVideoIds(p.playlistId, key)
      if (!ids.length) return { videos: [] as YoutubeVideo[], prefilled: [] as YoutubeVideo[] }
      const videos = await fetchVideosDetails(ids, key)
      const prefilled = await prefillFromSupabase(p.playlistId, videos)
      return { videos, prefilled }
    }
  })
}

/** Kaydet/Upsert */
export function useSavePlaylist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      playlistId: string
      teacher: string
      curriculumId?: string | null
      sectionId?: number | null
      lessonId?: number | null
      videos: YoutubeVideo[]
    }) => savePlaylistBundle(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.yt.saved })
    }
  })
}

/** Var olan bir playlist’i Supabase’ten yükle (prefill için) */
export function useLoadPlaylistFromDb() {
  return useMutation({
    mutationFn: async (playlistId: string) => {
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
  })
}
