// Backend Console Branding

const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    white: "\x1b[37m",
} as const

export const renderASCIILogo = () => {
    console.log(
        `${c.cyan}${c.bold}
  _       _                           _      
 (_)     | |  ${c.yellow}api.inboundr.co${c.cyan}        | |     
  _ _ __ | |__   ___  _   _ _ __   __| |_ __ 
 | | '_ \\| '_ \\ / _ \\| | | | '_ \\ / _\` | '__|
 | | | | | |_) | (_) | |_| | | | | (_| | |   
 |_|_| |_|_.__/ \\___/ \\__,_|_| |_|\\__,_|_|   
${c.reset}
${c.magenta}${c.bold}             inboundr Backend${c.reset}
${c.dim}       Copyright © ${new Date().getFullYear()} Orangewood Labs.${c.reset}
        `
    )
}

export const renderPeaceASCIILogo = () => {
    console.log(
        `${c.green}${c.bold}
   ..eeeee..
 e8"   8   "8e
d8     8     8b
8!   .dWb.   !8  ${c.yellow}PEACE!${c.green}
Y8 .e* 8 *e. 8P
 *8*   8   *8*
   **ee8ee**
${c.reset}
        `
    )
}