import { useEffect } from 'react'
import { subscribeEvents } from '@/api/eventBus'
import type { ApiEvent, VoiceEventData } from '@/api/types'
import { useNotify } from '@/notify/notifyContext'

// Bridges the voice websocket events to the existing top-banner notifications
const LONG_MS = 20000

// fun word bank for when its transcribing
const THINKING_WORDS = [
  'Thinking...',
  'Hmm...',
  'One sec...',
  'Let me see...',
  'Working on it...',
  'On it...',
  'Looking...',
  'Hang on...',
]

function thinkingWord(): string {
  return THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)]
}

export function VoiceNotifier() {
  const notify = useNotify()

  useEffect(() => {
    return subscribeEvents((evt: ApiEvent) => {
      if (evt.type !== 'voice') return
      const { state, text } = (evt.data ?? {}) as VoiceEventData
      switch (state) {
        case 'listening':
          notify('Listening...', { variant: 'info', icon: 'microphone', durationMs: LONG_MS })
          break
        case 'thinking':
          notify(thinkingWord(), { variant: 'info', icon: 'thinking', durationMs: LONG_MS })
          break
        case 'playing':
          notify(text ? `Playing ${text}` : 'Playing', {
            variant: 'success',
            icon: 'play',
            durationMs: 4000,
          })
          break
        case 'done':
          notify(text || 'Done', { variant: 'success', durationMs: 3500 })
          break
        case 'error':
          notify(text || 'Sorry, I didnt catch that', { variant: 'warning', durationMs: 3500 })
          break
        // 'idle'
      }
    })
  }, [notify])

  return null
}
