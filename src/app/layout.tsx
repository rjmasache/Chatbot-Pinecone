import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Lato } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const lato = Lato({
    weight: ["400"],
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Pinecone Assistant Sample App",
    description: "Connect a chat interface to an existing Pinecone Assistant",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={lato.className}>{children}</body>
        </html>
    );
}
