const homeQuotes = {
  hasReviews: [
    "先把今天的复习清空，就是在给未来的自己省时间。",
    "复习不是重复，是加固。",
    "遗忘是大脑的默认设置，复习是对抗它的唯一武器。",
  ],
  hasNewCards: [
    "每一个新词，都是理解世界的一块新拼图。",
    "新词像种子，今天埋下，未来会在某个句子中突然开花。",
    "词汇量不是数字，是你能抵达的世界边界。",
  ],
  allDone: [
    "保持这个节奏，词汇量会在不经意间质变。",
    "今天没有新任务，但已有的记忆正在大脑里自动巩固。",
    "休息也是学习的一部分。",
  ],
};

const studyEntryQuotes = [
  "复习是记忆的唯一捷径。",
  "今天多花 5 分钟，明天少背半小时。",
  "记忆的本质是提取，而不是存储。",
  "间隔重复不是技巧，是顺应大脑规律。",
];

const studyDoneQuotes = {
  formal: [
    "今天的坚持，是明天流利表达的底气。",
    "你刚才击败的每一张卡片，大脑都真正记住了。",
    "完成比完美更重要。",
    "进步不需要轰轰烈烈，只需要日复一日。",
  ],
  review: [
    "加练不改动计划，但会加深印象。",
    "重复是记忆之母。",
    "每一次额外的提取，都在让记忆更牢固。",
  ],
};

const emptyStateQuotes = {
  noDecks: [
    "千里之行，始于足下。",
    "每一个伟大的词库，都是从第一张卡片开始的。",
  ],
  noCards: [
    "种一棵树最好的时间是十年前，其次是现在。",
    "空牌组不是终点，是起点。",
  ],
};

const settingsQuotes = [
  "每天进步 1%，一年后你会强大 37 倍。",
  "Language is the archive of history.",
  "习惯的力量在于它看不见，却决定一切。",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getHomeQuote(reviews: number, newCards: number): string {
  if (reviews > 0) return pickRandom(homeQuotes.hasReviews);
  if (newCards > 0) return pickRandom(homeQuotes.hasNewCards);
  return pickRandom(homeQuotes.allDone);
}

export function getStudyEntryQuote(): string {
  return pickRandom(studyEntryQuotes);
}

export function getStudyDoneQuote(isFormal: boolean): string {
  return pickRandom(isFormal ? studyDoneQuotes.formal : studyDoneQuotes.review);
}

export function getEmptyStateQuote(type: "noDecks" | "noCards"): string {
  return pickRandom(emptyStateQuotes[type]);
}

export function getSettingsQuote(): string {
  return pickRandom(settingsQuotes);
}
