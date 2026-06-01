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

// PDF-capable model. gpt-5.5 (OpenAI) supports PDF file input natively, so we use
// the "native" engine: the PDF is passed straight to the model rather than going
// through OpenRouter's separate parser (which can fail on some PDFs).
const model_pdf = new ChatOpenRouter({
    model: "openai/gpt-5.5",
    temperature: 0,
    modelKwargs: {
        plugins: [
            {
                id: "file-parser",
                pdf: {
                    engine: "native",
                },
            },
        ],
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

export interface SuggestFileNameInput {
    currentName: string;
    contentType: string;
    size: number;
    textSnippet?: string | null;
    imageUrl?: string | null;
    pdf?: { fileName: string; fileData: string } | null;
}

function cleanName(raw: string): string {
    let name = String(raw ?? "").trim();
    // Models sometimes wrap the answer in quotes or add a trailing period.
    name = name.replace(/^["'`]+|["'`]+$/g, "").trim();
    // Collapse any whitespace/newlines into single spaces.
    name = name.replace(/\s+/g, " ");
    // Drop a trailing extension the model may have appended (e.g. "Report.pdf").
    name = name.replace(/\.[A-Za-z0-9]{1,8}$/, "").trim();
    // Remove characters that are unsafe for file names.
    name = name.replace(/[\\/:*?"<>|]+/g, "").trim();
    return name.slice(0, 60).trim();
}

const NAME_INSTRUCTION =
    "Suggest ONE concise, descriptive, human-readable file name (3-8 words, natural capitalization, NO file extension, max 60 characters). Reply with ONLY the name, no quotes or explanation.";

export async function suggestFileName(input: SuggestFileNameInput): Promise<string> {
    const hints = `Current name: ${input.currentName}\nType: ${input.contentType || "unknown"}\nSize: ${input.size} bytes`;

    if (input.pdf) {
        const message = new HumanMessage({
            content: [
                { type: "text", text: `${NAME_INSTRUCTION}\n\n${hints}` },
                { type: "file", file: { filename: input.pdf.fileName, file_data: input.pdf.fileData } },
            ],
        });
        const response = await model_pdf.invoke([
            { role: "system", content: "You are a helpful assistant" },
            message,
        ]);
        return cleanName(String(response.content));
    }

    if (input.imageUrl) {
        const message = new HumanMessage({
            content: [
                { type: "text", text: `${NAME_INSTRUCTION}\n\n${hints}` },
                { type: "image_url", image_url: { url: input.imageUrl } },
            ],
        });
        return cleanName(await chatWithModel("intelligent", [message]));
    }

    const body = input.textSnippet ? `\n\nFile content (truncated):\n${input.textSnippet}` : "";
    const message = new HumanMessage(`${NAME_INSTRUCTION}\n\n${hints}${body}`);
    return cleanName(await chatWithModel("cheap", [message]));
}