import { useCallback } from 'react';

const useSectionSearch = (sections) => {
    
    const findSectionById = useCallback((idQuery) => {
        if (!idQuery.trim() || sections.length === 0) return [];
        
        const cleanQuery = idQuery.replace(/['"״׳]/g, '').replace(/^סעיף\s+/, '').trim();
        
        return sections.filter(section => {
            if (!section.id) return false;
            const secId = section.id.toString().replace(/['"״׳]/g, '').trim();
            
            if (secId === cleanQuery) return true;
            if (secId.startsWith(cleanQuery)) {
                // If it's a sub-section or related (e.g. 197 vs 197A)
                // We want to avoid matching 19 when searching for 1
                // But allow matching 197 when searching 19
                // Wait, logic in original code was simpler:
                const remainder = secId.slice(cleanQuery.length);
                return isNaN(parseInt(remainder)); // Ensure it's not just a digit suffix (e.g. 1 -> 12)
            }
            return false;
        }).slice(0, 10);
    }, [sections]);

    const findRelevantSectionsByText = useCallback((queryText, limit = 20) => {
        if (!queryText.trim() || sections.length === 0) return [];
        
        const terms = queryText.trim().toLowerCase().split(/\s+/).filter(t => t.length > 1);
        
        return sections.map(section => {
            let score = 0;
            const content = section.content.toLowerCase();
            const title = section.title.toLowerCase();
            
            terms.forEach(term => {
                if (title.includes(term)) score += 50;
                const matches = content.split(term).length - 1;
                score += matches;
            });
            
            return { ...section, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }, [sections]);

    const findContextForAI = useCallback((queryText, limit = 25) => {
        let results = [];
        
        // Extract section numbers if mentioned explicitly
        const sectionMatches = queryText.match(/(?:סעיף\s*)?(\d+(?:[א-ת]{1,2}|'[א-ת])?)/g);
        
        if (sectionMatches) {
            sectionMatches.forEach(match => {
                const id = match.replace(/סעיף\s*/, '').trim();
                results = [...results, ...findSectionById(id)];
            });
        }
        
        // Add text-based search results
        results = [...results, ...findRelevantSectionsByText(queryText, limit)];
        
        // Deduplicate
        const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());
        
        return uniqueResults.slice(0, limit);
    }, [findSectionById, findRelevantSectionsByText]);

    return { findSectionById, findRelevantSectionsByText, findContextForAI };
};

export default useSectionSearch;
