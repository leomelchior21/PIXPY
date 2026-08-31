import type { Avatar } from '../types'

export const avatars: Avatar[] = [
  { id: 'nova', name: 'Nova', skin: '#8f573b', hair: '#201b2f', outfit: '#5ce1b9', accent: '#f7d95c', accessory: 'headphones' },
  { id: 'byte', name: 'Byte', skin: '#d99b72', hair: '#532e48', outfit: '#7e72ff', accent: '#65e6ff', accessory: 'visor' },
  { id: 'echo', name: 'Echo', skin: '#f0bd91', hair: '#c55b45', outfit: '#ff6b71', accent: '#f8df66', accessory: 'cap' },
  { id: 'flux', name: 'Flux', skin: '#6d422e', hair: '#e1d5c7', outfit: '#ff9f43', accent: '#74efca', accessory: 'glasses' },
  { id: 'moss', name: 'Moss', skin: '#c7835b', hair: '#163c39', outfit: '#72d28a', accent: '#fff0a4', accessory: 'headphones' },
  { id: 'orbit', name: 'Orbit', skin: '#f1c6a5', hair: '#2f315c', outfit: '#4ca7ff', accent: '#ff73ba', accessory: 'visor' },
]

export function getAvatar(id: string | null | undefined): Avatar {
  return avatars.find((avatar) => avatar.id === id) ?? avatars[0]
}
