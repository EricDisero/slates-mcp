/** Original free starter examples. Model choices and costs resolve at use time.
 * Evidence and source coverage: second-brain/business/projects/slates/research/script-craft/.
 * Preview readiness is explicit; importing a draft never claims a tested output. */
export const AD_PRESETS = [
  {
    id: 'catch-the-small-problem', revision: 1, name: 'Catch the small problem',
    tags: ['product demonstration', 'spoken', 'everyday'], techniques: ['sc-event', 'sc-proof', 'sc-bridge'],
    description: 'A small everyday frustration becomes a visible product demonstration. An original fictional keys-tray example.',
    adaptation: 'Replace the object, familiar frustration and observable demonstration. Supply real product facts and the destination for the invitation. Compare the opening and its bridge together; keep the demonstration fixed.',
    sections: [
      { label: 'Opening', alternatives: [
        { label: 'Question', text: 'Where do your keys go when you get home?\nMine used to land wherever my hand stopped.', action: 'A hand drops a key ring onto a cluttered entrance table. The keys stop near the edge. An ordinary moment, filmed close enough to see the key ring.' },
        { label: 'Search', text: 'I checked my coat, my bag, and the table.\nThey were under the receipt.', action: 'The same hand checks a coat pocket, opens a bag, then lifts a receipt to reveal the keys. Let the last action answer the search.' },
        { label: 'Objection', text: 'A tray just for keys?\nThat was my question too.', action: 'A small tray sits beside a scattered key ring. A hand turns the tray once, then puts it down by the door.' },
      ] },
      { label: 'Demonstration', alternatives: [
        { label: 'A place to land', text: 'Now I leave this by the door.\nKeys go in when I arrive. I pick them up when I leave.', action: 'The hand places the keys inside the shallow tray. Match the next departure gesture to the same framing: the hand finds the keys in that tray. Show only the behavior described.' },
      ] },
      { label: 'Invitation', alternatives: [
        { label: 'See the product', text: 'Give the small things a place to land.', action: 'Hold a clear view of the tray with the keys inside. Keep the product unobstructed. The destination and offer are supplied by the creator; no price or claim appears in the image.' },
      ] },
    ],
  },
  {
    id: 'silent-small-demonstration', revision: 1, name: 'Let the object explain',
    tags: ['silent', 'product demonstration', 'modular'], techniques: ['sc-event', 'sc-proof', 'sc-modular'],
    description: 'An original silent tray demonstration. The opening event changes while the product action stays fixed.',
    adaptation: 'Choose a real product action that reads without speech. Replace the sample object and place. Keep the physical setup legible; a different opening must still lead naturally into the same demonstration. Add sound only when wanted.',
    sections: [
      { label: 'Opening event', alternatives: [
        { label: 'Almost lost', text: '', action: 'Silent overhead view of an entrance table. A key ring slides toward the edge and stops. A hand enters with a shallow tray. No dialogue or on-screen text.' },
        { label: 'Found it', text: '', action: 'Silent overhead view of an entrance table. A hand lifts a small stack of receipts, revealing a key ring underneath. The hand brings an empty shallow tray into the same space. No dialogue or on-screen text.' },
      ] },
      { label: 'Demonstration', alternatives: [
        { label: 'In reach', text: '', action: 'Silent overhead view of the same table and tray. A hand puts the keys inside the tray, leaves the frame, then returns and picks them up directly. Keep the object and gesture visible. No dialogue or on-screen text.' },
      ] },
      { label: 'Closing view', alternatives: [
        { label: 'The result', text: '', action: 'Silent close view of the same tray holding the key ring on the table. Hold the still composition so the result is easy to read. No dialogue or on-screen text.' },
      ] },
    ],
  },
] as const
