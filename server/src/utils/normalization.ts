export function toTitleCase(str: any): string {
    if (typeof str !== "string") return "";
    const trimmed = str.trim();
    if (!trimmed) return "";
    return trimmed
        .toLowerCase()
        .replace(/(?:^|[\s\-\/\(\[\{])([a-z])/g, (match) => match.toUpperCase());
}

export function toSentenceCase(str: any): string {
    if (typeof str !== "string") return "";
    const trimmed = str.trim();
    if (!trimmed) return "";

    // Check if the string is fully uppercase
    const isAllUpper = trimmed === trimmed.toUpperCase() && trimmed !== trimmed.toLowerCase();
    
    // Convert to sentence case only when the text is fully uppercase
    if (!isAllUpper) {
        return trimmed;
    }

    // Split into sentences using a regex that captures sentence-ending punctuation or end of string
    const sentenceRegex = /([^.!?]+(?:[.!?]+|$))/g;
    const matches = trimmed.match(sentenceRegex) || [trimmed];

    const processedSentences = matches.map(s => {
        let sentence = s.trim();
        if (!sentence) return "";

        // Lowercase the sentence
        sentence = sentence.toLowerCase();

        // Capitalize the first alphabetical character
        const firstCharIndex = sentence.search(/[a-zA-Z]/);
        if (firstCharIndex !== -1) {
            sentence = 
                sentence.substring(0, firstCharIndex) + 
                sentence.charAt(firstCharIndex).toUpperCase() + 
                sentence.substring(firstCharIndex + 1);
        }

        return sentence;
    });

    return processedSentences.filter(Boolean).join(" ");
}

export function normalizeUpdatePayload(update: any, schemaFields: Record<string, "title" | "sentence">): void {
    if (!update) return;

    // Normalize direct update fields (e.g. { name: "PIZZA" })
    for (const key of Object.keys(schemaFields)) {
        if (typeof update[key] === "string") {
            const val = update[key];
            update[key] = schemaFields[key] === "title" ? toTitleCase(val) : toSentenceCase(val);
        }
    }

    // Normalize fields under $set (e.g. { $set: { name: "PIZZA" } })
    if (update.$set) {
        for (const key of Object.keys(schemaFields)) {
            if (typeof update.$set[key] === "string") {
                const val = update.$set[key];
                update.$set[key] = schemaFields[key] === "title" ? toTitleCase(val) : toSentenceCase(val);
            }
        }
    }
}

export function normalizeDoc(doc: any, schemaFields: Record<string, "title" | "sentence">): void {
    if (!doc) return;
    for (const key of Object.keys(schemaFields)) {
        if (typeof doc[key] === "string") {
            const val = doc[key];
            doc[key] = schemaFields[key] === "title" ? toTitleCase(val) : toSentenceCase(val);
        }
    }
}
