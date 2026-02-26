import { useState, useCallback, useMemo } from 'react'
import type { MentionItem, MentionType } from '../types'

// Mock data - in production, this would come from the story bible API
const MOCK_CHARACTERS: MentionItem[] = [
  { id: '1', type: 'character', name: 'John Smith', description: 'Protagonist' },
  { id: '2', type: 'character', name: 'Sarah Connor', description: 'Supporting character' },
  { id: '3', type: 'character', name: 'Dr. Marcus', description: 'Antagonist' },
  { id: '4', type: 'character', name: 'Emily Rose', description: 'Love interest' },
  { id: '5', type: 'character', name: 'Detective Brown', description: 'Minor character' },
]

const MOCK_LOCATIONS: MentionItem[] = [
  { id: '1', type: 'location', name: 'Downtown Office', description: 'Main headquarters' },
  { id: '2', type: 'location', name: 'Central Park', description: 'Meeting point' },
  { id: '3', type: 'location', name: 'Abandoned Warehouse', description: 'Climax location' },
  { id: '4', type: 'location', name: 'Coffee Shop', description: 'Recurring location' },
  { id: '5', type: 'location', name: 'Hospital', description: 'Crisis location' },
]

type UseMentionsOptions = {
  projectId?: string
  characters?: MentionItem[]
  locations?: MentionItem[]
}

type UseMentionsReturn = {
  isActive: boolean
  mentionType: MentionType | null
  query: string
  suggestions: MentionItem[]
  activateMention: (type: MentionType) => void
  updateQuery: (query: string) => void
  selectMention: (item: MentionItem) => MentionItem
  deactivate: () => void
  detectMentionTrigger: (text: string, cursorPosition: number) => { type: MentionType; query: string; startPos: number } | null
}

export function useMentions(options: UseMentionsOptions = {}): UseMentionsReturn {
  const {
    characters = MOCK_CHARACTERS,
    locations = MOCK_LOCATIONS,
  } = options

  const [isActive, setIsActive] = useState(false)
  const [mentionType, setMentionType] = useState<MentionType | null>(null)
  const [query, setQuery] = useState('')

  // Filter suggestions based on query
  const suggestions = useMemo(() => {
    if (!mentionType) return []
    
    const items = mentionType === 'character' ? characters : locations
    
    if (!query) return items.slice(0, 10)
    
    const lowerQuery = query.toLowerCase()
    return items
      .filter((item) => 
        item.name.toLowerCase().includes(lowerQuery) ||
        item.description?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 10)
  }, [mentionType, query, characters, locations])

  const activateMention = useCallback((type: MentionType) => {
    setIsActive(true)
    setMentionType(type)
    setQuery('')
  }, [])

  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery)
  }, [])

  const selectMention = useCallback((item: MentionItem): MentionItem => {
    setIsActive(false)
    setMentionType(null)
    setQuery('')
    return item
  }, [])

  const deactivate = useCallback(() => {
    setIsActive(false)
    setMentionType(null)
    setQuery('')
  }, [])

  // Detect mention trigger in text (@ or #)
  const detectMentionTrigger = useCallback((
    text: string,
    cursorPosition: number
  ): { type: MentionType; query: string; startPos: number } | null => {
    // Look backwards from cursor for trigger character
    let startPos = cursorPosition - 1
    
    while (startPos >= 0) {
      const char = text[startPos]
      
      // Found a trigger character
      if (char === '@' || char === '#') {
        // Check if it's at the start or preceded by whitespace
        if (startPos === 0 || /\s/.test(text[startPos - 1])) {
          const type: MentionType = char === '@' ? 'character' : 'location'
          const query = text.slice(startPos + 1, cursorPosition)
          
          // Only activate if query doesn't contain spaces (single word)
          if (!/\s/.test(query)) {
            return { type, query, startPos }
          }
        }
        break
      }
      
      // Stop at whitespace or start of text
      if (/\s/.test(char)) break
      
      startPos--
    }
    
    return null
  }, [])

  return {
    isActive,
    mentionType,
    query,
    suggestions,
    activateMention,
    updateQuery,
    selectMention,
    deactivate,
    detectMentionTrigger,
  }
}
