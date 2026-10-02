window.PvData = {
  chapters: [
    { title: 'The Letter', status: 'final', words: '3.2k' },
    { title: 'Fog on the Sava', status: 'final', words: '2.8k' },
    { title: "Grandmother's Keys", status: 'revising', words: '1.4k' },
    { title: 'The Attic', status: 'draft', words: '640' },
    { title: '', status: 'empty', words: '0' }
  ],
  pages: {
    2: { label: 'Chapter Three', folio: 'III', title: "Grandmother's Keys", paras: [
      'The keys hung on a nail behind the pantry door, eleven of them on a ring of brass gone soft and brown with handling. Nobody in the family could say what half of them opened.',
      'Ana took them down the morning after the funeral. They were heavier than she expected, and colder, as if they had been waiting in the dark for someone to remember them.',
      '"Start with the attic," her mother said from the kitchen, without turning around.'
    ] }
  },
  notes: [
    { group: 'Characters', title: 'Ana Novak', sub: '34, restorer in Ljubljana', kind: 'Character', edited: 'Edited yesterday',
      fields: [['Age', '34'], ['Lives', 'Ljubljana, alone, above the workshop'], ['Wants', 'To sell the house and be done with it'], ['Fears', 'Becoming her mother']],
      body: ['Restores furniture for a living, so she notices hinges, locks and old varnish before faces. Has not been back to ', { link: 'The Lantern House' }, ' since her father left in 2009. Keeps ', { link: 'Grandmother Marija' }, "'s letters unopened in a shoebox."],
      todos: [{ text: 'Decide what she does with the letters', state: 'doing', meta: 'Chapter 4' }, { text: 'Give her one habit she hides from Vera', state: 'open' }, { text: 'Settle her age', state: 'done' }],
      appears: [['1 · The Letter', '14×'], ["3 · Grandmother's Keys", '22×'], ['4 · The Attic', '6×']], links: ['The Lantern House', 'Grandmother Marija', 'Vera, her mother'] },
    { group: 'Characters', title: 'Vera, her mother', sub: 'Never goes upstairs', kind: 'Character', edited: 'Edited last week', fields: [['Lives', 'The Lantern House, ground floor']], body: ['Answers questions with chores.'], todos: [], appears: [['1 · The Letter', '9×'], ["3 · Grandmother's Keys", '4×']], links: ['Ana Novak'] },
    { group: 'Characters', title: 'Grandmother Marija', sub: 'Died in March; kept the keys', kind: 'Character', edited: 'Edited 3 days ago', fields: [['Died', 'March']], body: ['Kept the keys on a nail behind the pantry door.'], todos: [], appears: [['3 · Grandmother\'s Keys', '11×']], links: ['Ana Novak', 'The attic'] },
    { group: 'Places', title: 'The Lantern House', sub: 'Riverside house near Krško', kind: 'Place', edited: 'Edited 2 days ago', fields: [['Where', 'Near Krško, on the Sava']], body: ['Riverside house with one lamp always lit.'], todos: [], appears: [['1 · The Letter', '6×'], ['2 · Fog on the Sava', '8×']], links: ['The attic'] },
    { group: 'Places', title: 'The attic', sub: 'Low beams, one round window', kind: 'Place', edited: 'Edited today', fields: [], body: ['Low beams, one round window.'], todos: [], appears: [['4 · The Attic', '12×']], links: ['The Lantern House'] },
    { group: 'Research', title: 'Ljubljana trams, 1950s', sub: 'Routes, colours, fares', kind: 'Research', edited: 'Edited in September', fields: [], body: ['Routes, colours, fares.'], todos: [{ text: 'Check 1950s Ljubljana tram routes', state: 'doing', meta: 'Chapter 3' }], appears: [], links: [] }
  ],
  todos: [
    { text: 'Decide which key opens the trunk', col: 'todo', tags: [{ label: "3 · Grandmother's Keys" }], ch: 3 },
    { text: 'Give Ana one habit she hides from Vera', col: 'todo', tags: [{ label: 'Ana Novak', kind: 'note' }], ch: 0 },
    { text: "Check the ending of chapter 1 against the letter's date", col: 'todo', tags: [{ label: '1 · The Letter' }], ch: 1 },
    { text: 'Find a name for the river ferryman', col: 'todo', tags: [{ label: 'Whole book' }], ch: 0 },
    { text: 'Decide what Ana does with the letters', col: 'doing', tags: [{ label: '4 · The Attic' }, { label: 'Ana Novak', kind: 'note' }], ch: 4 },
    { text: 'Check 1950s Ljubljana tram routes', col: 'doing', tags: [{ label: "3 · Grandmother's Keys" }, { label: 'Ljubljana trams', kind: 'note' }], ch: 3 },
    { text: 'Rename the mother', col: 'done', tags: [{ label: 'Whole book' }], ch: 0 },
    { text: "Settle Ana's age", col: 'done', tags: [{ label: 'Ana Novak', kind: 'note' }], ch: 0 }
  ]
};
