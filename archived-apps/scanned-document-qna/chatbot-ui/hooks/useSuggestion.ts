import { useSelectedImage } from "@/components/GalleryBar/SelectedImageContext";
import { useCallback, useEffect, useState } from "react";
type Suggestions = {
    questions: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const useSuggestion = (selectedImage: string | null) => {

    const [suggestion, setSuggestion] = useState<string[]>([]);
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);


    const fetchSuggestions = useCallback(async () => {
        try {
            setLoadingSuggestion(true);
            const response = await fetch(
                `${API_URL}/api/suggested_question?selectedImage=${selectedImage}`,
            );
            setLoadingSuggestion(false);
            if (response.ok) {
                const { questions } = (await response.json()) as Suggestions;
                console.log(questions);

                if (questions) {
                    setSuggestion(questions);
                }
            } else {
                console.error('Error fetching text.');
            }
        } catch (error) {
            setLoadingSuggestion(false);
            console.error('Error fetching text:', error);
        }
    }, [selectedImage]);

    useEffect(() => {
        const fetchData = async () => {
            if (!loadingSuggestion && selectedImage) { await fetchSuggestions(); }
        }

        fetchData()

    }, [selectedImage, fetchSuggestions]);



    return {
        suggestion,
        loadingSuggestion
    }
}