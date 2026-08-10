

export const startChatSession = async () => {
    const url = `${import.meta.env.VITE_BACKEND_URL}/api/v1/session/create`;
    console.log(url)
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'X-API-Key': import.meta.env.VITE_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
};

export const askDocument = async (query: string, sessionId: string) => {
    const url = `${import.meta.env.VITE_BACKEND_URL}/api/v1/chat/generate`;
    const payload = {
        session_id: sessionId,
        input_data: query
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'X-API-Key': import.meta.env.VITE_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
};

export const downloadPdf = async () => {
    const url = `${import.meta.env.VITE_BACKEND_URL}/download/report`;
    console.log(url)
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-Key': import.meta.env.VITE_API_KEY,
                'Content-Type': 'application/pdf'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.blob();
    } catch (error) {
        throw error;
    }
};

