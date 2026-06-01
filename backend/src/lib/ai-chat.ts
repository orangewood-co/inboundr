import {ChatOpenRouter} from "@langchain/openrouter";
import { HumanMessage } from "@langchain/core/messages";

const model_cheap = new ChatOpenRouter({
    model: "openai/gpt-oss-120b:free",
    temperature: 0.4,
})

const model_intelligent = new ChatOpenRouter({
    model: "openai/gpt-5.5",
    temperature: 0,
    modelKwargs: {
        reasoning: {
            effort: "low",
        },
    },
})

export async function chatWithModel(type: "cheap" | "intelligent", messages: HumanMessage[]): Promise<string> {
    const model = type === "cheap" ? model_cheap : model_intelligent;
    const response = await model.invoke(
        [
            {
            role: "system",
            content: "You are a helpful assistant"
            },
        ...messages
        ]
    );
    return String(response.content);
}