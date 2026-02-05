export const decodeQuotedPrintable = (input) => {
    try {
        let clean = input.replace(/=\r?\n/g, '');
        clean = clean.replace(/=([0-9A-F]{2})/gi, '%$1');
        return decodeURIComponent(clean);
    } catch (e) { return input; }
};

export const parseFileContent = (content) => {
    try {
        let htmlContent = content;
        if (content.includes("multipart/related") || content.includes("MIME-Version")) {
            const match = content.match(/<html[\s\S]*?<\/html>/i);
            if (match) {
                htmlContent = match[0];
                if (content.includes("Content-Transfer-Encoding: quoted-printable") || /=D7/i.test(htmlContent)) {
                    htmlContent = decodeQuotedPrintable(htmlContent);
                }
            }
        }
        return htmlContent;
    } catch (e) { return content; }
};

export const extractSectionsFromHTML = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    doc.querySelectorAll('script, style, meta, link, noscript').forEach(s => s.remove());
    const text = doc.body.innerText || "";
    const lines = text.split('\n');
    const extractedSections = [];
    let currentSection = { id: "intro", title: "מבוא / הגדרות", content: "" };
    
    const sectionRegex = /^\s*(?:סעיף\s+)?(\d+(?:[א-ת]{1,2}|'[א-ת])?)\.?\s*$/;
    const sectionStartRegex = /^\s*(?:סעיף\s+)?(\d+(?:[א-ת]{1,2}|'[א-ת])?)\.?\s+/;
    const chapterRegex = /^\s*(?:פרק|סימן|תוספת)\s+[א-ת]+/;

    lines.forEach(line => {
        const cleanLine = line.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim();
        if (!cleanLine) return;
        if (chapterRegex.test(cleanLine)) {
            currentSection.content += `\n[${cleanLine}]\n`;
            return;
        }
        let match = cleanLine.match(sectionRegex);
        if (!match) match = cleanLine.match(sectionStartRegex);
        
        if (match && cleanLine.length < 50) {
            if (currentSection.content.trim().length > 0) extractedSections.push({...currentSection});
            currentSection = { id: match[1], title: cleanLine, content: "" };
        } else {
            currentSection.content += cleanLine + "\n";
        }
    });
    if (currentSection.content.trim().length > 0) extractedSections.push(currentSection);
    return extractedSections;
};