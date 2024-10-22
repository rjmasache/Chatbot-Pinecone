"use client";

import { useState, useEffect, FormEvent, useRef, useCallback } from "react";
import { readStreamableValue } from "ai/rsc";
import { chat } from "./actions";
import ReactMarkdown from "react-markdown";
import AssistantFiles from "./components/AssistantFiles";
import { File, Reference, Message } from "./types";
import { v4 as uuidv4 } from "uuid";

interface HomeProps {
    initialShowAssistantFiles: boolean;
    showCitations: boolean;
}

export default function Home({
    initialShowAssistantFiles,
    showCitations,
}: HomeProps) {
    const [loading, setLoading] = useState(true);
    const [assistantExists, setAssistantExists] = useState(false);
    const [error, setError] = useState("");
    const [input, setInput] = useState("");
    const [assistantName, setAssistantName] = useState("");
    const [referencedFiles, setReferencedFiles] = useState<Reference[]>([]);
    const [showAssistantFiles, setShowAssistantFiles] = useState(
        initialShowAssistantFiles
    );
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        // Check for dark mode preference
        if (typeof window !== "undefined") {
            const isDarkMode = localStorage.getItem("darkMode") === "true";
            setDarkMode(isDarkMode);
            if (isDarkMode) {
                document.documentElement.classList.add("dark");
            }
        }
    }, []);

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
        if (typeof window !== "undefined") {
            localStorage.setItem("darkMode", (!darkMode).toString());
            document.documentElement.classList.toggle("dark");
        }
    };

    const extractReferences = (content: string): Reference[] => {
        const references: Reference[] = [];

        // Extract full file names from the content
        const fileNameRegex = /([^:\n]+\.[a-zA-Z0-9]+)/g;
        const fileMatches = content.match(fileNameRegex);

        if (fileMatches) {
            fileMatches.forEach(fileName => {
                references.push({ name: fileName.trim() });
            });
        }

        return references;
    };

    useEffect(() => {
        checkAssistant();
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const response = await fetch("/api/files");
            const data = await response.json();
            if (data.status === "success") {
                setFiles(data.files);
            } else {
                console.error("Error fetching files:", data.message);
            }
        } catch (error) {
            console.error("Error fetching files:", error);
        }
    };

    const checkAssistant = async () => {
        try {
            const response = await fetch("/api/assistants");
            const data = await response.json();

            setLoading(false);
            setAssistantExists(data.exists);
            setAssistantName(data.assistant_name);
            if (!data.exists) {
                setError("Please create an Assistant");
            }
        } catch (error) {
            setLoading(false);
            setError("Error connecting to the Assistant");
        }
    };

    const handleChat = async () => {
        if (!input.trim()) return;

        const newUserMessage: Message = {
            id: uuidv4(), // Generate a unique ID
            role: "user",
            content: input,
            timestamp: new Date().toISOString(),
        };

        setMessages(prevMessages => [...prevMessages, newUserMessage]);
        setInput("");
        setIsStreaming(true);

        try {
            const { object } = await chat([newUserMessage]);
            let accumulatedContent = "";
            const newAssistantMessage: Message = {
                id: uuidv4(),
                role: "assistant",
                content: "",
                timestamp: new Date().toISOString(),
                references: [],
            };

            setMessages(prevMessages => [...prevMessages, newAssistantMessage]);

            // Process the response stream from the Assistant that is created in the ./actions.ts Server action
            for await (const chunk of readStreamableValue(object)) {
                try {
                    const data = JSON.parse(chunk);
                    const content = data.choices[0]?.delta?.content;

                    if (content) {
                        accumulatedContent += content;
                    }

                    setMessages(prevMessages => {
                        const updatedMessages = [...prevMessages];
                        const lastMessage =
                            updatedMessages[updatedMessages.length - 1];
                        lastMessage.content = accumulatedContent;
                        return updatedMessages;
                    });
                } catch (error) {
                    console.error("Error parsing chunk:", error);
                }
            }

            // Extract references after the full message is received
            const extractedReferences = extractReferences(accumulatedContent);
            setReferencedFiles(extractedReferences);
        } catch (error) {
            console.error("Error in chat:", error);
            setError("An error occurred while chatting.");
        } finally {
            setIsStreaming(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-gray-50 dark:bg-gray-900">
            <button
                onClick={toggleDarkMode}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                aria-label={
                    darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
            >
                {darkMode ? (
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                    </svg>
                ) : (
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                    </svg>
                )}
            </button>
            {loading ? (
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-900 mb-4"></div>
                    <p className="text-gray-500">
                        Connecting to your Assistant...
                    </p>
                </div>
            ) : assistantExists ? (
                <div className="w-full max-w-6xl xl:max-w-7xl">
                    <h1 className="flex items-center text-2xl font-bold mb-4 text-[#003f72] dark:text-[#eaab00]">
                        {/* <a
                            href="https://www.pinecone.io/blog/pinecone-assistant/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                        >
                            Pinecone Assistant
                        </a>
                        : {assistantName}{" "}
                        <span className="text-green-500">●</span> */}
                        Asistente virtual UTPL
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                            className="ml-2"
                        >
                            <path
                                d="M15 12C14.2005 12.6224 13.1502 13 12 13C10.8498 13 9.79952 12.6224 9 12M9 8.01953V8M15 8.01953V8M3 20.7929V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V15C21 16.1046 20.1046 17 19 17H8.41421C8.149 17 7.89464 17.1054 7.70711 17.2929L3.85355 21.1464C3.53857 21.4614 3 21.2383 3 20.7929Z"
                                stroke={darkMode ? "#000000" : "#FFFFFF"}
                                stroke-width="1"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            ></path>
                        </svg>
                    </h1>
                    <div className="flex flex-col gap-4">
                        <div className="w-full">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg mb-5 overflow-y-auto h-[calc(100vh-10rem)]">
                                {messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={`mb-2 flex ${
                                            message.role === "user"
                                                ? "justify-end"
                                                : "justify-start"
                                        }`}
                                    >
                                        <div
                                            className={`flex items-start ${
                                                message.role === "user"
                                                    ? "flex-row-reverse"
                                                    : "flex-row"
                                            }`}
                                        >
                                            <div
                                                className={`${
                                                    message.role === "user"
                                                        ? "ml-2"
                                                        : "mr-2"
                                                }`}
                                            >
                                                {message.role === "user" ? (
                                                    // <span className="text-2xl">
                                                    //     👤
                                                    // </span>
                                                    <svg
                                                        stroke="none"
                                                        fill={
                                                            darkMode
                                                                ? "white"
                                                                : "black"
                                                        }
                                                        stroke-width="0"
                                                        viewBox="0 0 16 16"
                                                        height="20"
                                                        width="20"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                    >
                                                        <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"></path>
                                                    </svg>
                                                ) : (
                                                    <a
                                                        href="https://www.pinecone.io/blog/pinecone-assistant/"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <img
                                                            src="/pinecone-logo.png"
                                                            alt="Pinecone Assistant"
                                                            className="w-6 h-6 rounded-full object-cover"
                                                        />
                                                    </a>
                                                )}
                                            </div>
                                            <span
                                                className={`inline-block py-2 px-4 rounded-lg ${
                                                    message.role === "user"
                                                        ? "bg-[#003f72] text-white"
                                                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                                } max-w-[80%] break-words`}
                                            >
                                                <ReactMarkdown
                                                    components={{
                                                        a: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <a
                                                                {...props}
                                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                                            >
                                                                🔗{" "}
                                                                {props.children}
                                                            </a>
                                                        ),
                                                    }}
                                                >
                                                    {message.content}
                                                </ReactMarkdown>
                                                {message.references &&
                                                    showCitations && (
                                                        <div className="mt-2">
                                                            <ul>
                                                                {message.references.map(
                                                                    (
                                                                        ref,
                                                                        i
                                                                    ) => (
                                                                        <li
                                                                            key={
                                                                                i
                                                                            }
                                                                        >
                                                                            <a
                                                                                href={
                                                                                    ref.url
                                                                                }
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                                                            >
                                                                                {
                                                                                    ref.name
                                                                                }
                                                                            </a>
                                                                        </li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        </div>
                                                    )}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <form
                                onSubmit={e => {
                                    e.preventDefault();
                                    handleChat();
                                }}
                                className="flex mb-4"
                            >
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    className="flex-grow py-2 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003f72] mr-2 dark:bg-[#2D3B45] dark:focus:ring-[#eaab00] dark:border-none dark:text-white"
                                    placeholder="Escribe tu mensaje"
                                    disabled={isStreaming}
                                />
                                <button
                                    type="submit"
                                    className="bg-[#003f72] text-white px-4 py-2 rounded-lg hover:bg-[#003f72] focus:outline-none focus:ring-2 focus:ring-[#003f72]"
                                    disabled={isStreaming}
                                >
                                    {isStreaming ? "Streaming..." : "Enviar"}
                                </button>
                            </form>
                            {error && (
                                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md shadow-md">
                                    <div className="flex items-center">
                                        <svg
                                            className="h-6 w-6 mr-2"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        <p className="font-semibold">Error</p>
                                    </div>
                                    <p className="mt-2">{error}</p>
                                </div>
                            )}
                        </div>
                        {showAssistantFiles && (
                            <div className="w-full">
                                <AssistantFiles
                                    files={files}
                                    referencedFiles={referencedFiles}
                                />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-md max-w-2xl">
                    <div className="flex items-center">
                        <svg
                            className="h-6 w-6 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <p className="font-semibold">Error</p>
                    </div>
                    <p className="mt-2">{error}</p>
                    <div className="mt-4 text-sm">
                        <p className="font-semibold">To resolve this issue:</p>
                        <ol className="list-decimal list-inside mt-2 space-y-2">
                            <li>
                                Create a Pinecone Assistant at{" "}
                                <a
                                    href="https://app.pinecone.io"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    https://app.pinecone.io
                                </a>
                            </li>
                            <li>
                                Export the environment variable{" "}
                                <code className="bg-red-200 px-1 rounded">
                                    PINECONE_ASSISTANT_NAME
                                </code>{" "}
                                with the value of your assistant&apos;s name
                            </li>
                            <li>Restart your application</li>
                        </ol>
                    </div>
                </div>
            )}
            {/* <div className="mt-8 text-sm text-gray-500 flex space-x-4">
                <a
                    href="https://www.pinecone.io/blog/pinecone-assistant/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-indigo-600 transition-colors"
                >
                    ℹ️ What are Pinecone Assistants?
                </a>
                <a
                    href="https://app.pinecone.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-indigo-600 transition-colors"
                >
                    🤖 Create your own Pinecone Assistant today
                </a>
            </div> */}
        </main>
    );
}
