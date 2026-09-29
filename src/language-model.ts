import type { Complete } from "@textoic/enlint-lsp/rewrite";
import {
  LanguageModelChatMessage,
  lm,
  type CancellationToken,
  type LanguageModelChat,
} from "vscode";
import { turnsOf } from "./language-model-turns.js";

export const availableModels = () => lm.selectChatModels();

export const modelFor = async (
  id: string,
): Promise<LanguageModelChat | undefined> => {
  const models = await availableModels();
  return models.find((model) => model.id === id) ?? models[0];
};

const asMessage = ({ role, content }: { role: string; content: string }) =>
  role === "assistant"
    ? LanguageModelChatMessage.Assistant(content)
    : LanguageModelChatMessage.User(content);

const collected = async (fragments: AsyncIterable<string>) => {
  let text = "";
  for await (const fragment of fragments) {
    text += fragment;
  }

  return text;
};

export const languageModelCompletion =
  (model: LanguageModelChat, token: CancellationToken): Complete =>
  async ({ messages }) => {
    const response = await model.sendRequest(
      turnsOf(messages).map(asMessage),
      { justification: "Textoic rewrites the paragraph the linter flagged." },
      token,
    );
    return { content: await collected(response.text), truncated: false };
  };
