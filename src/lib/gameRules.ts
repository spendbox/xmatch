import type { GameKind } from "@/lib/games";

/**
 * How to play each game, in plain words. Shown when a player taps "Rules" in a game.
 * Keep these matching the real rules in src/lib/boardgames (and the database for the others).
 */
export type GameRules = {
  /** One line: how you win */
  goal: string;
  sections: { title: string; points: string[] }[];
};

export const RULES: Record<GameKind, GameRules> = {
  ayo: {
    goal: "Collect more seeds than the other player. The first to 25 seeds wins.",
    sections: [
      {
        title: "The board",
        points: [
          "There are 12 holes. The 6 on the right are yours. The 6 on the left are theirs.",
          "Every hole starts with 4 seeds (48 seeds in all).",
        ],
      },
      {
        title: "Your turn",
        points: [
          "Tap one of your holes that has seeds. Holes you can play glow.",
          "All the seeds in that hole are picked up and dropped one at a time into the next holes: up your side, then across and down their side, round and round. The app does the dropping for you.",
          "If the hole you pick has 12 seeds or more, the seeds go all the way round, skipping the hole they came from.",
        ],
      },
      {
        title: "Taking seeds",
        points: [
          "Watch the hole where your LAST seed lands.",
          "If it is on THEIR side and now has exactly 2 or 3 seeds, you take those seeds.",
          "Then look at the hole before it (the one just above it on their side). If that one also has 2 or 3, you take those too. Keep going until a hole doesn't have 2 or 3.",
          "If your last seed lands on your own side, or the hole ends up with 1 or 4+ seeds, you take nothing this turn.",
          "Example: their hole has 2 seeds. Your last seed drops in, making 3. You take all 3.",
          "You can't wipe them out in one go. If a move would take every seed on their side, you take nothing that turn.",
        ],
      },
      {
        title: "When they have no seeds",
        points: ["If their side is empty, you must play a hole that drops seeds onto their side. Only those holes will glow."],
      },
      {
        title: "End of the game",
        points: [
          "First to 25 seeds wins. 24 each is a draw.",
          "If a player can't move, the game ends: each player keeps the seeds left on their own side, and the higher total wins.",
        ],
      },
    ],
  },

  whot: {
    goal: "Be the first to play all your cards.",
    sections: [
      {
        title: "Playing",
        points: [
          "You each get 5 cards. One card starts the pile in the middle.",
          "On your turn, play a card with the SAME SHAPE or the SAME NUMBER as the top card.",
          "A Whot card (number 20) can go on anything. When you play it, you choose the shape the next card must be.",
          "Can't play? Tap the market to pick one card. Your turn ends.",
        ],
      },
      {
        title: "Special cards",
        points: [
          "1 · Hold on: play again.",
          "8 · Suspension: they miss a turn, so you play again.",
          "14 · General market: they pick 1 card from the market, and you play again.",
          "5 · Pick three: they pick 3 cards, and you play again.",
          "2 · Pick two: they must pick 2 cards. Or they can play their own 2 to pass it back to you as pick 4 (it grows by 2 each time). Whoever picks takes all of them and misses their go.",
        ],
      },
      {
        title: "End of the game",
        points: [
          "Play your last card and you win.",
          "If the market runs out, the game ends. Add up the numbers on your cards: the lowest total wins. Stars count double. A Whot card counts 20.",
        ],
      },
    ],
  },

  lastcard: {
    goal: "Be the first to play all your cards.",
    sections: [
      {
        title: "Playing",
        points: [
          "You each get 7 cards. One card starts the pile.",
          "On your turn, play a card with the SAME COLOUR or the SAME NUMBER or symbol as the top card.",
          "Can't play, or don't want to? Draw one card. If it fits, you can play it straight away or keep it. If it doesn't fit, your turn ends.",
        ],
      },
      {
        title: "Special cards",
        points: [
          "Skip and Reverse: you play again.",
          "Wild: goes on anything. You choose the next colour.",
          "+2: they draw 2 cards. Or they can play a +2 or +4 on top to pass it back, bigger (+2 then +2 = 4 to draw).",
          "+4 (wild): goes on anything, you choose the colour, and they draw 4. Only another +4 can pass it back.",
          "Drawing the cards ends your turn.",
        ],
      },
      {
        title: "Say “Last card!”",
        points: [
          "When you play your second-to-last card, tap “Last card!” as you play it.",
          "Forget, and the other player can tap Catch before your next turn. You draw 2 cards.",
        ],
      },
      {
        title: "End of the game",
        points: ["Play your last card and you win. If the deck runs out, the pile is shuffled to make a new one."],
      },
    ],
  },

  xo: {
    goal: "Win 3 rounds first.",
    sections: [
      {
        title: "Playing",
        points: [
          "Take turns putting your mark in an empty square.",
          "Get 3 of your marks in a row (across, down or corner to corner) to win the round.",
        ],
      },
      {
        title: "The twist: only 3 marks each",
        points: [
          "You can only have 3 marks on the board.",
          "When you place a 4th, your OLDEST mark disappears. The mark about to go fades so you can see it coming.",
          "So there are no draws. Someone always wins the round.",
        ],
      },
      {
        title: "Rounds",
        points: ["Whoever loses a round starts the next one. First to win 3 rounds wins the game."],
      },
    ],
  },

  ludo: {
    goal: "Get all 4 of your tokens home first.",
    sections: [
      {
        title: "Getting started",
        points: [
          "You each have 4 tokens, waiting in your corner. Yours are at the bottom right.",
          "Tap the dice to roll. You need a 6 to bring a token out onto the board.",
          "Then tap a token to move it forward by the number you rolled.",
          "If no token can move, your turn passes.",
        ],
      },
      {
        title: "Extra rolls",
        points: ["You roll again if you roll a 6, capture a token, or get a token home.", "Roll three 6s in a row and your turn ends."],
      },
      {
        title: "Capturing",
        points: [
          "Land on their token and it goes back to their corner. It needs a 6 to come out again.",
          "Squares with a star, and the start squares, are safe. Nobody can be captured there.",
          "Two of their tokens on the same square make a block. You can't capture them.",
        ],
      },
      {
        title: "Getting home",
        points: [
          "Go once round the board, then up your own coloured lane to the middle.",
          "You need the exact number to reach home. First with all 4 tokens home wins.",
          "Dashpad rolls the dice for both players, so it's fair.",
        ],
      },
    ],
  },

  snakes: {
    goal: "Be the first to reach square 100.",
    sections: [
      {
        title: "Playing",
        points: [
          "Both players start off the board. Tap the dice to roll, and your token moves that many squares.",
          "Land at the bottom of a ladder and you climb up it.",
          "Land on a snake's head and you slide down to its tail.",
          "Roll a 6 and you roll again.",
        ],
      },
      {
        title: "Winning",
        points: [
          "You need the exact number to land on 100. If your roll is too big, you stay where you are.",
          "Dashpad rolls the dice for both players, so it's fair.",
        ],
      },
    ],
  },

  checkers: {
    goal: "Take all their pieces, or leave them with no move.",
    sections: [
      {
        title: "Moving",
        points: [
          "You each have 12 pieces on the dark squares. You start at the bottom.",
          "Pieces move one square diagonally forward, onto an empty square.",
        ],
      },
      {
        title: "Capturing",
        points: [
          "Jump diagonally over their piece onto the empty square just behind it to take it. Normal pieces capture forward only.",
          "If you can capture, you must.",
          "After a jump, if the same piece can jump again, it must keep going.",
        ],
      },
      {
        title: "Kings",
        points: [
          "Reach the far side and your piece becomes a king (your turn ends there).",
          "Kings move any number of squares diagonally, forwards or backwards. They can capture from a distance and land on any empty square past the piece.",
        ],
      },
      {
        title: "Draws",
        points: ["If 80 moves go by with no capture and no new king, the game is a draw."],
      },
    ],
  },

  chess: {
    goal: "Checkmate their king: attack it so it has no way to escape.",
    sections: [
      {
        title: "Playing",
        points: [
          "Normal chess rules. White moves first.",
          "Tap a piece to see where it can go, then tap a square to move there.",
          "When your king is attacked (check), you must get it out of danger.",
        ],
      },
      {
        title: "Special moves",
        points: [
          "Castling, en passant and pawn promotion all work. A pawn that reaches the far side becomes the piece you choose.",
        ],
      },
      {
        title: "Draws",
        points: [
          "Stalemate (no legal move but not in check), the same position three times, 50 moves each with no capture or pawn move, or too few pieces left to checkmate.",
        ],
      },
    ],
  },

  bomb: {
    goal: "Win 2 rounds by finding their 6 safe tiles before you set off their 3 bombs.",
    sections: [
      {
        title: "Hide",
        points: ["Each of you has a field of 9 tiles. Secretly tap 3 of yours to hide your bombs, then tap “Lock them in”."],
      },
      {
        title: "Hunt",
        points: [
          "Take turns tapping one tile in THEIR field.",
          "A safe tile is good. A bomb blows up on you.",
          "Find all 6 safe tiles first and you win the round.",
          "Set off all 3 of their bombs and you lose the round.",
        ],
      },
      {
        title: "Rounds",
        points: ["Everyone hides new bombs each round, and the other player goes first. First to win 2 rounds wins."],
      },
    ],
  },

  gems: {
    goal: "Score more points than them after 5 turns each.",
    sections: [
      {
        title: "Playing",
        points: [
          "You both play on the same board and take turns. Each turn is 2 swaps.",
          "Swap two gems next to each other to make a line of 3 or more of the same colour. They pop and you score.",
          "New gems fall in. If they make more lines, you score even more.",
        ],
      },
      {
        title: "Power-ups",
        points: [
          "Match 4 in a line: a striped gem. It clears a whole row or column.",
          "Match in an L or T shape: a bomb gem. It clears the squares around it.",
          "Match 5 in a line: a star. Swap it with any gem to clear every gem of that colour.",
          "Making a power-up gives you an extra swap.",
          "Swap two power-ups together for a huge blast.",
        ],
      },
    ],
  },

  c4: {
    goal: "Get 4 of your discs in a row. Best of 3 games.",
    sections: [
      {
        title: "Playing",
        points: [
          "Take turns tapping a column. Your disc drops to the lowest empty space.",
          "Get 4 in a row across, up and down, or on a slant to win the game.",
          "If the board fills up with no 4 in a row, that game is a draw.",
        ],
      },
      {
        title: "The match",
        points: ["Up to 3 games. Whoever starts swaps each game. First to win 2 wins the match."],
      },
    ],
  },

  words: {
    goal: "Find more words than them in 80 seconds.",
    sections: [
      {
        title: "Playing",
        points: [
          "You both get the same grid of letters.",
          "Slide your finger across letters that touch (sideways, up, down or corner to corner) to spell a word, then let go.",
          "Words need at least 3 letters. You can't use the same letter twice in one word.",
        ],
      },
      {
        title: "Points",
        points: ["Longer words score much more: 3 letters 100, 4 letters 400, 5 letters 800, 6 letters 1,400, and more after that.", "Each word only counts once."],
      },
    ],
  },

  truths: {
    goal: "Spot their lie, and fool them with yours.",
    sections: [
      {
        title: "Write",
        points: ["Write 3 things about yourself. Two are true, one is a lie. Mark which one is the lie."],
      },
      {
        title: "Guess",
        points: ["Read their 3 and tap the one you think is the lie.", "When you've both guessed, the answers are shown."],
      },
    ],
  },

  tot: {
    goal: "See how alike you are. There's no winner.",
    sections: [
      {
        title: "Playing",
        points: [
          "You both get the same 10 questions, each with two choices.",
          "Tap the one you like more. After you both pick, you see if you matched.",
          "At the end you see how many picks you had in common.",
        ],
      },
    ],
  },
};
