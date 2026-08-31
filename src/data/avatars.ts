import type { Avatar } from '../types'

export const avatars: Avatar[] = [
  { id: 'nova', skin: '#dff9ff', hair: '#002b3c', outfit: '#08bde8', accent: '#75e6ff', accessory: 'headphones' },
  { id: 'byte', skin: '#9feaff', hair: '#00394f', outfit: '#006fa8', accent: '#e9fcff', accessory: 'visor' },
  { id: 'echo', skin: '#dff9ff', hair: '#007ca8', outfit: '#04b9e6', accent: '#77e6ff', accessory: 'cap' },
  { id: 'flux', skin: '#84d9ef', hair: '#001d2a', outfit: '#0b91c3', accent: '#dff9ff', accessory: 'glasses' },
  { id: 'moss', skin: '#b8effa', hair: '#004a61', outfit: '#00b6df', accent: '#e9fcff', accessory: 'headphones' },
  { id: 'orbit', skin: '#e9fcff', hair: '#006b91', outfit: '#087fae', accent: '#72ddf7', accessory: 'visor' },
]

export function getAvatar(id: string | null | undefined): Avatar {
  return avatars.find((avatar) => avatar.id === id) ?? avatars[0]
}
