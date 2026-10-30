export interface GroupTheme {
  badge: string;
  dot: string;
  border: string;
  selectedCard: string;
  unselectedCard: string;
  text: string;
}

export function getGroupColorTheme(nameOrId: string | number): GroupTheme {
  const str = String(nameOrId).trim().toLowerCase();

  if (str.includes('1') || str.endsWith('a') || str === 'g1') {
    return {
      badge: 'bg-teal-50 text-teal-800 border-teal-300 ring-teal-400/20',
      dot: 'bg-teal-500',
      border: 'border-teal-300',
      selectedCard: 'border-teal-400 ring-2 ring-teal-400/30 bg-teal-50 text-teal-900',
      unselectedCard: 'border-teal-200 bg-white hover:border-teal-300 hover:bg-teal-50/40 text-teal-800',
      text: 'text-teal-800',
    };
  }

  if (str.includes('2') || str.endsWith('b') || str === 'g2') {
    return {
      badge: 'bg-amber-50 text-amber-900 border-amber-300 ring-amber-400/20',
      dot: 'bg-amber-500',
      border: 'border-amber-300',
      selectedCard: 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50 text-amber-900',
      unselectedCard: 'border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/40 text-amber-800',
      text: 'text-amber-800',
    };
  }

  if (str.includes('3') || str.endsWith('c') || str === 'g3') {
    return {
      badge: 'bg-purple-50 text-purple-900 border-purple-300 ring-purple-400/20',
      dot: 'bg-purple-500',
      border: 'border-purple-300',
      selectedCard: 'border-purple-400 ring-2 ring-purple-400/30 bg-purple-50 text-purple-900',
      unselectedCard: 'border-purple-200 bg-white hover:border-purple-300 hover:bg-purple-50/40 text-purple-800',
      text: 'text-purple-800',
    };
  }

  if (str.includes('4') || str.endsWith('d') || str === 'g4') {
    return {
      badge: 'bg-rose-50 text-rose-900 border-rose-300 ring-rose-400/20',
      dot: 'bg-rose-500',
      border: 'border-rose-300',
      selectedCard: 'border-rose-400 ring-2 ring-rose-400/30 bg-rose-50 text-rose-900',
      unselectedCard: 'border-rose-200 bg-white hover:border-rose-300 hover:bg-rose-50/40 text-rose-800',
      text: 'text-rose-800',
    };
  }

  const palettes: GroupTheme[] = [
    {
      badge: 'bg-teal-50 text-teal-800 border-teal-300 ring-teal-400/20',
      dot: 'bg-teal-500',
      border: 'border-teal-300',
      selectedCard: 'border-teal-400 ring-2 ring-teal-400/30 bg-teal-50 text-teal-900',
      unselectedCard: 'border-teal-200 bg-white hover:border-teal-300 hover:bg-teal-50/40 text-teal-800',
      text: 'text-teal-800',
    },
    {
      badge: 'bg-amber-50 text-amber-900 border-amber-300 ring-amber-400/20',
      dot: 'bg-amber-500',
      border: 'border-amber-300',
      selectedCard: 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50 text-amber-900',
      unselectedCard: 'border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/40 text-amber-800',
      text: 'text-amber-800',
    },
    {
      badge: 'bg-purple-50 text-purple-900 border-purple-300 ring-purple-400/20',
      dot: 'bg-purple-500',
      border: 'border-purple-300',
      selectedCard: 'border-purple-400 ring-2 ring-purple-400/30 bg-purple-50 text-purple-900',
      unselectedCard: 'border-purple-200 bg-white hover:border-purple-300 hover:bg-purple-50/40 text-purple-800',
      text: 'text-purple-800',
    },
    {
      badge: 'bg-rose-50 text-rose-900 border-rose-300 ring-rose-400/20',
      dot: 'bg-rose-500',
      border: 'border-rose-300',
      selectedCard: 'border-rose-400 ring-2 ring-rose-400/30 bg-rose-50 text-rose-900',
      unselectedCard: 'border-rose-200 bg-white hover:border-rose-300 hover:bg-rose-50/40 text-rose-800',
      text: 'text-rose-800',
    },
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
  return palettes[hash % palettes.length];
}

