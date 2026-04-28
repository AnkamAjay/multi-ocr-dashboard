import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export interface BatchUploadResponse {
    document_ids: number[];
    file_paths: string[];
    filenames: string[];
    is_batch: boolean;
}

export const uploadDocument = async (file: File): Promise<BatchUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const processDocument = async (documentId: number, language: string, modality: string) => {
    const response = await axios.post(`${API_BASE_URL}/process?document_id=${documentId}&language=${language}&modality=${modality}`);
    return response.data;
};

export const saveAnnotation = async (ocrResultId: number, editedText: string) => {
    const response = await axios.post(`${API_BASE_URL}/save?ocr_result_id=${ocrResultId}`, {
        edited_text: editedText
    });
    return response.data;
};

export const getBestModel = async (documentId: number) => {
    const response = await axios.get(`${API_BASE_URL}/best-model/${documentId}`);
    return response.data;
};

export const getResults = async (documentId: number) => {
    const response = await axios.get(`${API_BASE_URL}/results/${documentId}`);
    return response.data;
};
