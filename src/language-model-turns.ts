import type { ChatMessage } from "@textoic/enlint-lsp/rewrite";

export type Turn = { role: "user" | "assistant"; content: string };

const systemText = (messages: ChatMessage[]) =>
  messages
    .filter(({ role }) => role === "system")
    .map(({ content }) => content)
    .join("\n\n");

const conversation = (messages: ChatMessage[]): Turn[] =>
  messages
    .filter(({ role }) => role !== "system")
    .map(({ role, content }) => ({
      role: role === "assistant" ? "assistant" : "user",
      content,
    }));

const prefixed = (instructions: string, [first, ...rest]: Turn[]): Turn[] =>
  first?.role === "user"
    ? [
        { role: "user", content: `${instructions}\n\n${first.content}` },
        ...rest,
      ]
    : [
        { role: "user", content: instructions },
        ...(first ? [first] : []),
        ...rest,
      ];

export const turnsOf = (messages: ChatMessage[]): Turn[] => {
  const instructions = systemText(messages);
  const turns = conversation(messages);
  return instructions === "" ? turns : prefixed(instructions, turns);
};
