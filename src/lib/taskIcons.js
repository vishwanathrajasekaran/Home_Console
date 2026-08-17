const RULES = [
  [/water|tank|drink/i, '💧'],
  [/wash|laundry/i, '🧺'],
  [/sweep|mop|clean/i, '🧹'],
  [/light/i, '💡'],
  [/gate|lock|door/i, '🔒'],
  [/outdoor|garden|plant/i, '🌿'],
  [/ac\b|inverter|battery|electric/i, '⚡'],
]

export function iconFor(name) {
  const hit = RULES.find(([re]) => re.test(name))
  return hit ? hit[1] : '🗂️'
}

export function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const CATEGORY_ICON = {
  Outside: '🌳',
  Room: '🛏️',
  Kitchen: '🍳',
  Hall: '🛋️',
  Balcony: '🪴',
  'Office Room': '💼',
  Other: '🗂️',
}

export function categoryIcon(category) {
  return CATEGORY_ICON[category] || '🗂️'
}

export const CATEGORIES = ['Outside', 'Room', 'Kitchen', 'Hall', 'Balcony', 'Office Room']
