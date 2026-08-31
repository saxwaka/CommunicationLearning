/**
 * Câu luyện tạm cho cuối tuần 2.
 *
 * Nội dung thật sẽ nằm ở `content/*.yaml` từ cuối tuần 3 — xem docs/SPEC.md mục 6.
 * Ở đây cố ý chọn câu chứa những âm người Việt hay vấp: /θ/ /ð/, cặp /s/–/ʃ/,
 * các âm cuối /t/ /d/ /s/ /z/ hay bị nuốt, cặp /l/–/n/, và /r/.
 */
export const PRACTICE_SENTENCES = [
  "Can I have a coffee, please?",
  "I think this is the right one.",
  "She sells three fresh shirts.",
  "Where is the nearest bus stop?",
  "He finished his lunch at noon.",
  "Could you say that again, slowly?",
  "I would like a table for two.",
  "The weather is really nice today.",
  "My name is Minh and I live in Hanoi.",
  "How much does this cost?",
] as const;

/** 20 câu đọc để hiệu chỉnh ngưỡng theo giọng của chính bạn. */
export const CALIBRATION_SENTENCES = [
  "The cat sat on the mat.",
  "I have a red book.",
  "She likes hot tea.",
  "We walk to school every day.",
  "This is my new phone.",
  "He works in a big office.",
  "They went home early.",
  "Please open the window.",
  "I need some help with this.",
  "The food tastes very good.",
  "My brother plays football.",
  "Can you hear me now?",
  "It is raining outside.",
  "She bought three apples.",
  "We watched a long movie.",
  "The train leaves at eight.",
  "I forgot my keys again.",
  "That was a great idea.",
  "He speaks English quite well.",
  "Thank you for your time.",
] as const;
