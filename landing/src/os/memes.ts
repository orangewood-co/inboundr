export interface Meme {
  /** File name as shown in Explorer. */
  name: string
  src: string
}

/** Images live in public/os/memes/ — drop a file there and add a line here. */
export const MEMES: Meme[] = [
  { name: "10x.png", src: "/os/memes/10x.png" },
  { name: "be-like-a-programmer.png", src: "/os/memes/be-like-a-programmer.png" },
  { name: "browser.png", src: "/os/memes/browser.png" },
  { name: "c.png", src: "/os/memes/c.png" },
]
